import { runFallbackChain, withTimeout } from "../utils/fallbackRunner.ts";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "http://localhost:5173";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Vary": "Origin",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Per-provider ceilings. MusicBrainz gets extra headroom because its API
// contract forces a ~1.1s sleep between the lookup and the relation call.
const DEFAULT_PROVIDER_TIMEOUT_MS = 3000;
const MUSICBRAINZ_TIMEOUT_MS = 6000;

interface ArtistProfile {
  photo_url: string;
  bio: string;
}

type ProfileResult = ArtistProfile | null;

const MUSIC_KEYWORDS = [
  "rapper",
  "musician",
  "singer",
  "hip hop artist",
  "record producer",
  "band",
];

function isMusicDescription(text: string): boolean {
  const lower = String(text || "").toLowerCase();
  return MUSIC_KEYWORDS.some((kw) => lower.includes(kw));
}

function titleMatchesArtist(hitTitle: string, artistName: string): boolean {
  const hitLower = hitTitle.toLowerCase();
  const artistLower = artistName.toLowerCase();
  return (
    hitLower === artistLower ||
    hitLower.startsWith(artistLower + " (") ||
    hitLower.startsWith(artistLower + ",")
  );
}

async function fetchSummary(title: string, signal: AbortSignal) {
  const res = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
    { headers: { "User-Agent": "Spire/1.0 (music app)" }, signal },
  );
  return res.ok ? res.json() : null;
}

// Wikipedia gives us both the image and the bio extract in a single call.
async function wikipediaProfile(artistName: string): Promise<ProfileResult> {
  return withTimeout(async (signal) => {
    const clean = artistName.trim();
    try {
      const data = await fetchSummary(clean, signal);
      if (data && data.type !== "disambiguation") {
        const image = data.originalimage?.source || data.thumbnail?.source || "";
        const bio = String(data.extract || "").slice(0, 500);
        if (image || bio) {
          return { photo_url: image, bio };
        }
      }

      const queries = [clean, `${clean} musician`, `${clean} (band)`];
      for (const query of queries) {
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
        const searchRes = await fetch(searchUrl, { signal });
        if (!searchRes.ok) continue;
        const searchData = await searchRes.json();
        const hits = (searchData?.query?.search || []).slice(0, 5);

        for (const hit of hits) {
          if (hit.title?.toLowerCase().includes("disambiguation")) continue;
          if (!titleMatchesArtist(hit.title, clean)) continue;

          const summary = await fetchSummary(hit.title, signal);
          if (!summary || summary.type === "disambiguation") continue;
          const image = summary.originalimage?.source || summary.thumbnail?.source || "";
          const bio = String(summary.extract || "").slice(0, 500);
          if (!image && !bio) continue;
          if (!isMusicDescription(bio)) continue;
          return { photo_url: image, bio };
        }
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        console.error("wikipedia profile error:", err);
      }
      throw err;
    }
    return null;
  }, DEFAULT_PROVIDER_TIMEOUT_MS);
}

// Apple Music artist pages expose the artist photo as their og:image.
async function itunesProfile(artistName: string): Promise<ProfileResult> {
  return withTimeout(async (signal) => {
    try {
      const clean = artistName.trim();
      const searchRes = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(clean)}&entity=musicArtist&limit=1`,
        { signal },
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const artist = searchData.results?.[0];
        if (artist?.artistId) {
          const artistUrl =
            artist.artistLinkUrl ||
            `https://music.apple.com/us/artist/${artist.artistId}`;

          const pageRes = await fetch(artistUrl, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
              "Accept-Language": "en-US,en;q=0.9",
            },
            signal,
          });
          if (pageRes.ok) {
            const html = await pageRes.text();
            const match = html.match(/<meta\s+property="og:image"\s+content="(.*?)"/i);
            if (match) {
              const photoUrl = match[1].replace(/\d+x\d+[a-z]*/i, "600x600bb");
              return { photo_url: photoUrl, bio: "" };
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        console.error("itunes profile error:", err);
      }
      throw err;
    }
    return null;
  }, DEFAULT_PROVIDER_TIMEOUT_MS);
}

// Deezer's keyless artist search returns picture_xl (~1000x1000).
async function deezerProfile(artistName: string): Promise<ProfileResult> {
  return withTimeout(async (signal) => {
    try {
      const res = await fetch(
        `https://api.deezer.com/search/artist?q=${encodeURIComponent(artistName.trim())}`,
        { signal },
      );
      if (!res.ok) return null;
      const data = await res.json();
      const picture = data?.data?.[0]?.picture_xl;
      return picture ? { photo_url: picture, bio: "" } : null;
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        console.error("deezer profile error:", err);
      }
      throw err;
    }
  }, DEFAULT_PROVIDER_TIMEOUT_MS);
}

// MusicBrainz exposes no images directly; resolve the Wikidata P18 claim.
async function musicBrainzProfile(artistName: string): Promise<ProfileResult> {
  return withTimeout(async (signal) => {
    try {
      const clean = artistName.trim();
      const mbRes = await fetch(
        `https://musicbrainz.org/ws/2/artist/?query=artist:${encodeURIComponent(clean)}&fmt=json&limit=1`,
        { headers: { "User-Agent": "Spire/1.0 (music app)" }, signal },
      );
      if (!mbRes.ok) return null;
      const mbData = await mbRes.json();
      const artistId = mbData.artists?.[0]?.id;
      if (!artistId) return null;

      // MusicBrainz rate-limits to ~1 req/sec.
      await new Promise((r) => setTimeout(r, 1100));

      const relRes = await fetch(
        `https://musicbrainz.org/ws/2/artist/${artistId}?inc=url-rels&fmt=json`,
        { headers: { "User-Agent": "Spire/1.0 (music app)" }, signal },
      );
      if (!relRes.ok) return null;
      const relData = await relRes.json();
      const wikiRelation = relData.relations?.find((r: { type: string }) => r.type === "wikidata");
      const wikidataId = wikiRelation?.url?.resource?.split("/").pop();
      if (!wikidataId) return null;

      const wdRes = await fetch(
        `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${wikidataId}&property=P18&format=json&origin=*`,
        { signal },
      );
      if (!wdRes.ok) return null;
      const wdData = await wdRes.json();
      const imageName = wdData?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
      if (!imageName) return null;

      const cleanImageName = String(imageName).trim().replace(/ /g, "_");
      const imageUrl = `https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/${cleanImageName}&width=500`;
      return { photo_url: imageUrl, bio: "" };
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        console.error("musicbrainz profile error:", err);
      }
      throw err;
    }
  }, MUSICBRAINZ_TIMEOUT_MS);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const responseCors = origin && origin === ALLOWED_ORIGIN
    ? { ...corsHeaders, "Access-Control-Allow-Origin": origin }
    : corsHeaders;

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: responseCors });
  }

  try {
    const { artistName } = await req.json();
    if (!artistName || typeof artistName !== "string") {
      return json({ error: "Missing artistName" }, 400);
    }

    // Wikipedia first: it owns the bio, and its lead image is preferred.
    const wiki = await wikipediaProfile(artistName);
    let photoUrl = wiki?.photo_url || "";

    // Wiki article exists but has no usable image — let the other
    // providers compete for the photo while keeping the wiki bio.
    if (!photoUrl) {
      const result = await runFallbackChain<ArtistProfile>(artistName, [
        { name: "itunes", fetcher: () => itunesProfile(artistName) },
        { name: "deezer", fetcher: () => deezerProfile(artistName) },
        { name: "musicbrainz", fetcher: () => musicBrainzProfile(artistName) },
      ]);
      photoUrl = result?.data?.photo_url || "";
    }

    return json({
      photo_url: photoUrl,
      bio: wiki?.bio || "",
    });
  } catch (err) {
    console.error("fetch-artist-photo error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});