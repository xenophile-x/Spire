import { DEFAULT_COVER } from "@/utils/trackMetadata";

// Session-scoped caches: positive results cache the URL/bio, misses cache
// "NONE" so we never retry a known-dead lookup within the session.
const WIKI_PREFIX = "wiki_bio_";
const ARTIST_IMG_PREFIX = "artist_img_res_";
const COVER_PREFIX = "cover_res_";

const MUSIC_KEYWORDS =
  /singer|songwriter|musician|band|rapper|hip-?hop|dj\b|composer|producer|guitarist|pianist|drummer|bassist|vocalist|duo|trio|quartet|quintet|orchestra|rock|pop\b|jazz|country|metal|punk|blues|folk|electronic|indie|rap\b|album|music|group/i;

const NEGATIVE = "NONE";

function readCache(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeCache(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Storage full or unavailable — caching is best-effort only.
  }
}

// Deduplicates concurrent identical lookups. Without this, rendering the same
// artist three times inside the infinite carousel fires three parallel
// requests before any of them can populate the session cache.
const inflight = new Map();

function withDedupe(key, task) {
  if (inflight.has(key)) return inflight.get(key);
  const promise = task().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

// --- WIKIPEDIA (TEXT ONLY) ---

export async function fetchWikipediaBioText(artistName, signal) {
  if (!artistName || artistName.toLowerCase() === "unknown artist") return null;

  const cacheKey = WIKI_PREFIX + artistName.toLowerCase();
  const cached = readCache(cacheKey);
  if (cached !== null) {
    if (cached === NEGATIVE) return null;
    try {
      return JSON.parse(cached);
    } catch {
      writeCache(cacheKey, NEGATIVE);
      return null;
    }
  }

  return withDedupe(cacheKey, async () => {
    // NOTE: the shared task must never close over a specific caller's
    // AbortController. Under StrictMode the first mount is aborted before the
    // second one starts, so a signal-bound promise would resolve null for the
    // surviving caller. Callers observe their own signal after the await.
    const fetchSummary = async (title) => {
      const res = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
      );
      return res.ok ? res.json() : null;
    };

    try {
      let summary = await fetchSummary(artistName);

      // Direct hit was a miss, disambiguation page, or non-music article:
      // fall back to Wikipedia search restricted to music-flavored results.
      if (
        !summary ||
        summary.type === "disambiguation" ||
        !MUSIC_KEYWORDS.test((summary.description || "") + (summary.extract || ""))
      ) {
        const searchRes = await fetch(
          `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
            artistName + " musician"
          )}&format=json&origin=*`
        );
        if (!searchRes.ok) throw new Error(`search failed (${searchRes.status})`);
        const searchData = await searchRes.json();

        const hits = (searchData?.query?.search || []).slice(0, 3);
        for (const hit of hits) {
          if (hit.title?.toLowerCase().includes("disambiguation")) continue;
          const candidate = await fetchSummary(hit.title);
          if (
            candidate &&
            candidate.type !== "disambiguation" &&
            MUSIC_KEYWORDS.test(
              (candidate.description || "") + (candidate.extract || "")
            )
          ) {
            summary = candidate;
            break;
          }
        }
      }

      if (summary && summary.extract) {
        // Text only — never surface Wikipedia lead images as artwork.
        const bioData = {
          extract: summary.extract,
          url: summary.content_urls?.desktop?.page,
        };
        writeCache(cacheKey, JSON.stringify(bioData));
        return bioData;
      }

      writeCache(cacheKey, NEGATIVE);
      return null;
    } catch (err) {
      console.warn("Wiki fetch failed:", err);
      return null;
    }
  }).then((result) => (signal?.aborted ? null : result));
}

// --- MULTI-LEVEL IMAGE FALLBACKS ---

// iTunes returns 100x100 thumbnails; request the 600x600 rendition instead.
function getHighResiTunes(url) {
  return url ? url.replace("100x100bb", "600x600bb") : null;
}

async function itunesSearch(term, entity) {
  const res = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=${entity}&limit=1`
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.results?.[0]?.artworkUrl100
    ? getHighResiTunes(data.results[0].artworkUrl100)
    : null;
}

export function fetchArtistImageFallback(artistName) {
  if (!artistName || artistName.toLowerCase() === "unknown artist") {
    return Promise.resolve(null);
  }

  const cacheKey = ARTIST_IMG_PREFIX + artistName.toLowerCase();
  const cached = readCache(cacheKey);
  if (cached !== null) {
    return Promise.resolve(cached === NEGATIVE ? null : cached);
  }

  return withDedupe(cacheKey, async () => {
    try {
      // iTunes has no artist-photo endpoint; their top song's album art is
      // the closest stable proxy. MusicBrainz exposes no artist images via
      // its API, so there is no second hop worth the latency here.
      const highRes = await itunesSearch(artistName, "song");
      if (highRes) {
        writeCache(cacheKey, highRes);
        return highRes;
      }
    } catch (e) {
      console.warn("Artist fallback fetch failed", e);
    }

    writeCache(cacheKey, NEGATIVE);
    return null;
  });
}

export function fetchTrackCoverFallback(title, artist) {
  if (!title) return Promise.resolve(null);

  const cacheKey =
    COVER_PREFIX + `${title}`.toLowerCase() + "_" + (artist || "").toLowerCase();
  const cached = readCache(cacheKey);
  if (cached !== null) {
    return Promise.resolve(cached === NEGATIVE ? null : cached);
  }

  return withDedupe(cacheKey, async () => {
    try {
      const highRes = await itunesSearch(`${title} ${artist || ""}`, "song");
      if (highRes) {
        writeCache(cacheKey, highRes);
        return highRes;
      }
    } catch {
      // Swallow — a missing cover is cosmetic, not fatal.
    }

    writeCache(cacheKey, NEGATIVE);
    return null;
  });
}

export { DEFAULT_COVER };
