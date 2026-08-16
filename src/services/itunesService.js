

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
      )}`
    );
    if (!response.ok) return "";
    const data = await response.json();
    return data?.originalimage?.source || data?.thumbnail?.source || "";
  } catch (error) {
    console.warn(`[Wikipedia] No photo for "${artistName}":`, error);
    return "";
  }
}

export async function fetchArtistPhoto(artistName) {
  if (!artistName) return "";

  // 1. Preferred: iTunes/Apple Music photo (server-side og:image resolution)
  try {
    const { data, error } = await supabase.functions.invoke("fetch-artist-photo", {
      body: { artistName },
    });
    if (!error && data?.photo_url) return data.photo_url;
  } catch (err) {
    console.warn(`[iTunes] Edge Function fetch failed for "${artistName}":`, err);
  }

  // 2. Fallback: iTunes Search API musicArtist artwork (rarely populated)
  try {
    const response = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(
        artistName.trim()
      )}&entity=musicArtist&limit=1`
    );

    if (!response.ok) {
      throw new Error(`iTunes API responded with status ${response.status}`);
    }

    const data = await response.json();
    const match = data.results && data.results[0];

    if (match?.artworkUrl100) {
      return match.artworkUrl100.replace("100x100bb", "600x600bb");
    }
  } catch (error) {
    console.warn(`[iTunes] No artist photo for "${artistName}":`, error);
  }

  // 3. Last resort: Wikipedia artist photo
  const wikiPhoto = await fetchWikipediaPhoto(artistName);
  if (wikiPhoto) return wikiPhoto;

  return "";
}