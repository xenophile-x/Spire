/**
 * Queries LRCLIB API for synced or plain text lyrics with smart fallbacks.
 */
export async function fetchLyrics({ title, artist, duration }) {
  if (!title) return { synced: null, plain: null, isSynced: false };

  // Helper to normalize strings for comparisons
  const cleanTitle = title.replace(/\s*\(.*?\)\s*/g, " ").trim();
  const cleanArtist = artist ? artist.replace(/\s*\(.*?\)\s*/g, " ").trim() : "";

  // Strategy 1: Direct Exact Match via /api/get
  try {
    const params = new URLSearchParams({
      track_name: cleanTitle,
      artist_name: cleanArtist,
    });

    if (duration > 0) {
      params.append("duration", Math.round(duration));
    }

    const res = await fetch(`https://lrclib.net/api/get?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      return {
        synced: data.syncedLyrics || null,
        plain: data.plainLyrics || null,
        isSynced: Boolean(data.syncedLyrics),
      };
    }
  } catch (err) {
    console.warn("Exact LRCLIB search failed, trying fallback search...", err);
  }

  // Strategy 2: Fallback Search via /api/search
  try {
    const query = `${cleanTitle} ${cleanArtist}`.trim();
    const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`);
    if (res.ok) {
      const results = await res.json();
      if (Array.isArray(results) && results.length > 0) {
        // Find best match with synced lyrics
        const bestMatch = results.find((r) => r.syncedLyrics) || results[0];
        return {
          synced: bestMatch.syncedLyrics || null,
          plain: bestMatch.plainLyrics || null,
          isSynced: Boolean(bestMatch.syncedLyrics),
        };
      }
    }
  } catch (err) {
    console.warn("Fallback LRCLIB search failed:", err);
  }

  return { synced: null, plain: null, isSynced: false };
}