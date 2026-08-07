// src/utils/trackMetadata.js

export const DEFAULT_COVER =
  "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=600";

/**
 * Safely extracts cover artwork URL from Supabase data structure
 */
export function extractCoverUrl(trackObj) {
  if (!trackObj) return DEFAULT_COVER;

  // 1. Check direct artwork_url on track object
  if (trackObj.artwork_url) return trackObj.artwork_url;
  if (trackObj.cover) return trackObj.cover;

  // 2. Safely extract metadata from Supabase join (handles Array vs Object)
  let meta = trackObj.track_metadata;
  if (Array.isArray(meta)) {
    meta = meta[0]; // Extract first metadata record from array
  }

  // 3. Extract artwork URL from metadata
  const artwork = meta?.artwork_url || meta?.cover;
  if (artwork && typeof artwork === "string" && artwork.trim() !== "") {
    return artwork;
  }

  return DEFAULT_COVER;
}

/**
 * Normalizes raw Supabase user_tracks data using direct server values.
 */
export function formatUserTrack(userTrack) {
  if (!userTrack) return null;

  // Handle case where userTrack is passed directly or nested inside tracks
  const trackObj = userTrack.tracks || userTrack;

  // Unwrap metadata properly
  let meta = trackObj.track_metadata;
  if (Array.isArray(meta)) {
    meta = meta[0];
  }

  let lyrics = trackObj.track_lyrics;
  if (Array.isArray(lyrics)) {
    lyrics = lyrics[0];
  }

  // Extract true cover photo link from Supabase server
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
    cover: coverUrl,            // Exact artwork link from database
    artworkUrl: coverUrl,       // Alias fallback
    duration: trackObj.duration_seconds || 0,
    synced_lyrics: lyrics?.synced_lyrics || "",
    plain_lyrics: lyrics?.plain_lyrics || "",
    uploadedAt: userTrack.created_at,
  };
}

export function formatUserTracks(userTracks = []) {
  return userTracks.map(formatUserTrack).filter(Boolean);
}