

import { supabase } from "@/lib/supabaseClient";

export function cleanTrackTitle(rawTitle) {
  if (!rawTitle) return "";
  return rawTitle
    .replace(/\.[^/.]+$/, "")
    .replace(/\[\s*(official|music|video|audio|lyric|hd|4k)\s*.*?\]/gi, "")
    .replace(/\(\s*(official|music|video|audio|lyric|hd|4k)\s*.*?\)/gi, "")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function matchItunesMetadata(rawQuery) {
  const cleanedQuery = cleanTrackTitle(rawQuery);
  if (!cleanedQuery) return null;

  try {
    const response = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(cleanedQuery)}&media=music&entity=song&limit=1`
    );

    if (!response.ok) {
      throw new Error(`iTunes API responded with status ${response.status}`);
    }

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const match = data.results[0];
      const artworkUrl = match.artworkUrl100
        ? match.artworkUrl100.replace("100x100bb", "600x600bb")
        : null;

      return {
        trackName: match.trackName,
        artistName: match.artistName,
        // Stable provider identity — lets the DB merge artists by entity
        // instead of trusting display strings.
        artistId: match.artistId ? String(match.artistId) : null,
        collectionName: match.collectionName || "Uploaded Single",
        artworkUrl,
        primaryGenreName: match.primaryGenreName || "Music",
        trackTimeMillis: match.trackTimeMillis || 0,
      };
    }

    return null;
  } catch (error) {
    console.warn("Error fetching iTunes metadata:", error);
    return null;
  }
}

export async function fetchWikipediaPhoto(artistName) {
  if (!artistName) return "";
  try {
    const response = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
        artistName.trim()
      )}`,
      {
        headers: {
          "User-Agent": "SpireMusicApp/1.0.0 ( contact@spire.app )",
          Accept: "application/json",
        },
      }
    );
    if (!response.ok) return "";
    const data = await response.json();


    if (data?.type === "disambiguation") {
      return fetchWikipediaPhotoFromSearch(artistName);
    }

    return data?.originalimage?.source || data?.thumbnail?.source || "";
  } catch (error) {
    console.warn(`[Wikipedia] No photo for "${artistName}":`, error);
    return "";
  }
}


async function fetchWikipediaPhotoFromSearch(artistName) {
  const clean = artistName.trim();
  const queries = [clean, `${clean} musician`, `${clean} (band)`];

  for (const query of queries) {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      query
    )}&format=json&origin=*`;
    try {
      const searchRes = await fetch(searchUrl);
      if (!searchRes.ok) continue;
      const searchData = await searchRes.json();
      const hits = (searchData?.query?.search || []).slice(0, 5);

      for (const hit of hits) {
        if (hit.title?.toLowerCase().includes("disambiguation")) continue;
        const hitLower = hit.title.toLowerCase();
        const cleanLower = clean.toLowerCase();

        const matches =
          hitLower === cleanLower ||
          hitLower.startsWith(cleanLower + " (") ||
          hitLower.startsWith(cleanLower + ",");
        if (!matches) continue;

        const summaryRes = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`,
          {
            headers: {
              "User-Agent": "SpireMusicApp/1.0.0 ( contact@spire.app )",
              Accept: "application/json",
            },
          }
        );
        if (!summaryRes.ok) continue;
        const summaryData = await summaryRes.json();
        const img = summaryData?.originalimage?.source || summaryData?.thumbnail?.source;
        if (img) return img;
      }
    } catch (err) {
      console.warn(`[Wikipedia] Search failed for "${query}":`, err);
    }
  }
  return "";
}

export async function fetchArtistPhoto(artistName) {
  if (!artistName) return "";


  try {
    const { data, error } = await supabase.functions.invoke("fetch-artist-photo", {
      body: { artistName },
    });
    if (!error && data?.photo_url) return data.photo_url;
  } catch (err) {
    console.warn(`[iTunes] Edge Function fetch failed for "${artistName}":`, err);
  }


  // Browser direct iTunes fetch is blocked by CORS (No ACAO) — the edge
  // function already tried iTunes server-side. Skip client fetch entirely
  // and fall back to Wikipedia only.

  const wikiPhoto = await fetchWikipediaPhoto(artistName);
  if (wikiPhoto) return wikiPhoto;

  return "";
}

// Artist profile lookup: the fetch-artist-photo edge function first
// (Wikipedia photo + bio). If Wikipedia has nothing for the artist,
// fall back to iTunes for the photo.
export async function fetchArtistProfile(artistName) {
  if (!artistName) return { photo_url: "", bio: "" };

  try {
    const { data, error } = await supabase.functions.invoke("fetch-artist-photo", {
      body: { artistName },
    });
    if (!error && (data?.photo_url || data?.bio)) {
      return {
        photo_url: data?.photo_url || "",
        bio: data?.bio || "",
      };
    }
  } catch (err) {
    console.warn(`[Artist] Profile fetch failed for "${artistName}":`, err);
  }

  // Browser iTunes fallback removed — CORS blocked. Edge function
  // already tried iTunes server-side, so just return empty.
  return { photo_url: "", bio: "" };
}