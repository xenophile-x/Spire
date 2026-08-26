

export const DEFAULT_COVER =
  "https://cdn.saleminteractivemedia.com/shared/images/default-cover-art.png";

export function extractCoverUrl(trackObj) {
  if (!trackObj) return DEFAULT_COVER;

  if (trackObj.artwork_url) return trackObj.artwork_url;
  if (trackObj.cover) return trackObj.cover;

  let meta = trackObj.track_metadata;
  if (Array.isArray(meta)) {
    meta = meta[0];
  }

  const artwork = meta?.artwork_url || meta?.cover;
  if (artwork && typeof artwork === "string" && artwork.trim() !== "") {
    return artwork;
  }

  return DEFAULT_COVER;
}

export function formatUserTrack(userTrack) {
  if (!userTrack) return null;

  const trackObj = userTrack.tracks || userTrack;

  let meta = trackObj.track_metadata;
  if (Array.isArray(meta)) {
    meta = meta[0];
  }

  let lyrics = trackObj.track_lyrics;
  if (Array.isArray(lyrics)) {
    lyrics = lyrics[0];
  }

  const coverUrl = extractCoverUrl(trackObj);

  const displayTitle =
    trackObj.canonical_title ||
    userTrack.uploaded_filename?.replace(/\.[^/.]+$/, "") ||
    "Untitled Track";

  const displayArtist = trackObj.canonical_artist || "Unknown Artist";

  return {
    id: userTrack.id || trackObj.id,
    track_id: trackObj.id || userTrack.id,
    drive_file_id: userTrack.drive_file_id,
    title: displayTitle,
    artist: displayArtist,
    album: meta?.album_name || "Single",
    primary_genre: meta?.primary_genre || "Pop",
    release_year: meta?.release_year || null,
    cover: coverUrl,
    artworkUrl: coverUrl,
    duration: trackObj.duration_seconds || 0,
    synced_lyrics: lyrics?.synced_lyrics || "",
    plain_lyrics: lyrics?.plain_lyrics || "",
    uploadedAt: userTrack.created_at,
  };
}

export function formatUserTracks(userTracks = []) {
  return userTracks.map(formatUserTrack).filter(Boolean);
}