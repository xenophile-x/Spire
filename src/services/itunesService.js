

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