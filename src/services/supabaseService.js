import { supabase } from "@/lib/supabaseClient";

// --- LIBRARY ---
export const getUserLibrary = async (userId) => {
  const { data, error } = await supabase
    .from("user_tracks")
    .select(`
      id,
      track_id,
      drive_file_id,
      uploaded_filename,
      created_at,
      tracks (
        id,
        canonical_title,
        canonical_artist,
        duration_seconds,
        track_metadata ( artwork_url, primary_genre ),
        track_lyrics ( synced_lyrics )
      )
    `)
    .eq("user_id", userId);

  if (error) throw error;
  return data;
};

// --- LISTENING HISTORY ---
export const getListeningHistoryTrackIds = async (userId, limit = 8) => {
  const { data, error } = await supabase
    .from("listening_history")
    .select("track_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data.map((record) => record.track_id);
};

export const getListeningHistoryWithGenres = async (userId, limit = 50) => {
  const { data, error } = await supabase
    .from("listening_history")
    .select("track_id, genre")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
};

export const recordListen = async (userId, trackId, genre = "Unknown") => {
  if (!userId || !trackId) return;
  const { error } = await supabase
    .from("listening_history")
    .insert([{ user_id: userId, track_id: trackId, genre }]);

  if (error) console.error("Failed to record listen:", error);
};

// --- LIKED SONGS ---
export const getLikedSongs = async (userId) => {
  const { data, error } = await supabase
    .from("liked_songs")
    .select("track_id")
    .eq("user_id", userId);

  if (error) throw error;
  return new Set(data.map((row) => row.track_id));
};

export const toggleLikedSong = async (userId, trackId, isCurrentlyLiked) => {
  if (isCurrentlyLiked) {
    const { error } = await supabase
      .from("liked_songs")
      .delete()
      .match({ user_id: userId, track_id: trackId });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("liked_songs")
      .insert([{ user_id: userId, track_id: trackId }]);
    if (error) throw error;
  }
};

// --- PLAYLISTS ---
export const getUserPlaylists = async (userId) => {
  const { data, error } = await supabase
    .from("playlists")
    .select(`
      id,
      title,
      description,
      is_public,
      playlist_tracks ( track_id )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return data.map((pl) => ({
    id: pl.id,
    title: pl.title,
    description: pl.description,
    isFolder: false,
    songIds: pl.playlist_tracks.map((pt) => pt.track_id),
    image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80",
  }));
};

export const addTrackToPlaylist = async (playlistId, trackId) => {
  const { error } = await supabase
    .from("playlist_tracks")
    .insert([{ playlist_id: playlistId, track_id: trackId }]);

  if (error && error.code !== '23505') {
    throw error;
  }
};

export const createPlaylist = async (userId, title, description = "") => {
  const { data, error } = await supabase
    .from("playlists")
    .insert([{ user_id: userId, title, description, is_public: false }])
    .select()
    .single();

  if (error) throw error;
  return {
    id: data.id,
    title: data.title,
    description: data.description,
    isFolder: false,
    songIds: [],
    image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80",
  };
};

export const renamePlaylist = async (playlistId, newTitle) => {
  const { error } = await supabase
    .from("playlists")
    .update({ title: newTitle })
    .eq("id", playlistId);

  if (error) throw error;
};

export const deletePlaylist = async (playlistId) => {
  const { error } = await supabase
    .from("playlists")
    .delete()
    .eq("id", playlistId);

  if (error) throw error;
};

export const removeTrackFromPlaylist = async (playlistId, trackId) => {
  const { error } = await supabase
    .from("playlist_tracks")
    .delete()
    .match({ playlist_id: playlistId, track_id: trackId });

  if (error) throw error;
};

// --- TRACK REGISTRATION PIPELINE ---
export const registerTrackInSupabase = async ({
  userId,
  driveFileId,
  filename,
  trackInfo,
  lyricsData,
  itunesTrackId = null, // reference metadata only — never used as tracks.id
}) => {
  // ALWAYS resolve the real Supabase track row via lookup-or-create.
  // We never trust an external ID (like iTunes's trackId) as our own primary key.
  const { data: existingTrack, error: lookupError } = await supabase
    .from("tracks")
    .select("id")
    .ilike("canonical_title", trackInfo.title)
    .ilike("canonical_artist", trackInfo.artist)
    .maybeSingle();

  if (lookupError) throw lookupError;

  let finalTrackId = existingTrack?.id;

  if (!finalTrackId) {
    const { data: newTrack, error: trackError } = await supabase
      .from("tracks")
      .insert([
        {
          canonical_title: trackInfo.title,
          canonical_artist: trackInfo.artist,
          duration_seconds: trackInfo.durationSeconds,
          // Optional: store the iTunes ID for future dedupe/matching.
          // Only include this if you've added an `itunes_id` column to `tracks`.
          ...(itunesTrackId ? { itunes_id: itunesTrackId } : {}),
        },
      ])
      .select("id")
      .single();

    if (trackError) throw trackError;
    finalTrackId = newTrack.id;
  }

  // Insert or update track metadata (artwork, genre, etc.)
  const { error: metadataError } = await supabase.from("track_metadata").upsert(
    {
      track_id: finalTrackId,
      artwork_url: trackInfo.artworkUrl,
      primary_genre: trackInfo.primaryGenre,
    },
    { onConflict: "track_id" }
  );
  if (metadataError) throw metadataError;

  // Insert or update track lyrics
  if (lyricsData?.plainLyrics || lyricsData?.syncedLyrics) {
    const { error: lyricsError } = await supabase.from("track_lyrics").upsert(
      {
        track_id: finalTrackId,
        plain_lyrics: lyricsData.plainLyrics,
        synced_lyrics: lyricsData.syncedLyrics,
        is_synced: lyricsData.isSynced,
      },
      { onConflict: "track_id" }
    );
    if (lyricsError) throw lyricsError;
  }

  // Link track to the user's personal library in user_tracks
  const { data: userTrack, error: userTrackError } = await supabase
    .from("user_tracks")
    .insert([
      {
        user_id: userId,
        track_id: finalTrackId,
        drive_file_id: driveFileId,
        uploaded_filename: filename,
      },
    ])
    .select()
    .single();

  if (userTrackError) throw userTrackError;

  return userTrack;
};