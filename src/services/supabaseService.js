import { supabase } from "@/lib/supabaseClient";


export const getAcceptedLibraryShares = async (userId) => {
  const { data, error } = await supabase
    .from("library_shares")
    .select("owner_id, users:owner_id ( full_name, email, avatar_url )")
    .eq("grantee_id", userId)
    .eq("status", "accepted")
    .or("expires_at.is.null,expires_at.gt.now()");

  if (error) throw error;
  return (data || []).map((share) => ({
    owner_id: share.owner_id,
    shared_by: share.users?.full_name || share.users?.email || "A Friend",
    shared_by_avatar: share.users?.avatar_url || null,
  }));
};

export const getUserLibrary = async (userId) => {
  const { data, error } = await supabase
    .from("user_tracks")
    .select(`
      id,
      user_id,
      track_id,
      drive_file_id,
      uploaded_filename,
      created_at,
      tracks (
        id,
        canonical_title,
        canonical_artist,
        duration_seconds,
        artist_id,
        artists!tracks_artist_id_fkey ( name, photo_url, bio, favorite_artists ( artist_id ) ),
        track_metadata ( artwork_url, primary_genre, album_name, release_year ),
        track_lyrics ( synced_lyrics )
      )
    `)
    .eq("user_id", userId);

  if (error) throw error;
  return data;
};


export const getArtistsWithSampleTrack = async (userId) => {
  try {
    const { data, error } = await supabase
      .from("user_tracks")
      .select(`
        tracks (
          canonical_title,
          canonical_artist,
          artist_id,
          artists!tracks_artist_id_fkey ( id, name, photo_url, bio )
        )
      `)
      .eq("user_id", userId);

    if (error) throw error;

    const map = new Map();
    for (const rec of data || []) {
      const t = rec?.tracks;
      if (!t) continue;
      const artistRow = Array.isArray(t.artists) ? t.artists[0] : t.artists;
      const artistId = artistRow?.id || t.artist_id;
      const name = artistRow?.name || t.canonical_artist;
      if (!artistId || !name) continue;
      if (!map.has(artistId)) {
        map.set(artistId, {
          id: artistId,
          name,
          photo_url: artistRow?.photo_url || null,
          bio: artistRow?.bio || null,
          sampleTrack: t.canonical_title || "",
        });
      }
    }
    return Array.from(map.values());
  } catch (err) {
    console.warn("[Supabase] Artists table not available yet (run the artists migration):", err);
    return [];
  }
};

export const getDistinctArtistsWithIds = async (userId) => {
  try {
    const { data, error } = await supabase
      .from("user_tracks")
      .select(`
      tracks (
        artist_id,
        canonical_artist,
        artists!tracks_artist_id_fkey ( id, name, photo_url )
      )
    `)
      .eq("user_id", userId);

    if (error) throw error;

    const map = new Map();
    for (const rec of data || []) {
      const t = rec?.tracks;
      if (!t) continue;
      const artistRow = Array.isArray(t.artists) ? t.artists[0] : t.artists;
      const artistId = artistRow?.id || t.artist_id;
      const name = artistRow?.name || t.canonical_artist;
      if (!artistId || !name) continue;
      if (!map.has(artistId)) {
        map.set(artistId, { id: artistId, name, photo_url: artistRow?.photo_url || null });
      }
    }
    return Array.from(map.values());
  } catch (err) {
    console.warn("[Supabase] Artists table not available yet (run the artists migration):", err);
    return [];
  }
};

export const updateArtistPhoto = async (artistId, photoUrl) => {
  const { error } = await supabase
    .from("artists")
    .update({ photo_url: photoUrl })
    .eq("id", artistId);
  if (error) throw error;
};

export const updateArtistProfile = async (artistId, { photoUrl, bio } = {}) => {
  const payload = {};
  if (photoUrl !== undefined) payload.photo_url = photoUrl;
  if (bio !== undefined) payload.bio = bio;
  if (!artistId || Object.keys(payload).length === 0) return;

  const { error } = await supabase
    .from("artists")
    .update(payload)
    .eq("id", artistId);
  if (error) throw error;
};

// Persist a resolved cover URL so every future load reads it straight from
// the DB instead of re-querying iTunes/MusicBrainz (single source of truth).
export const updateTrackArtwork = async (trackId, artworkUrl) => {
  if (!trackId || !artworkUrl) return;
  const { error } = await supabase
    .from("track_metadata")
    .upsert(
      { track_id: trackId, artwork_url: artworkUrl },
      { onConflict: "track_id" }
    );
  if (error) {
    if (error.code === '42P10') {
      console.warn("[Supabase] track_metadata missing primary key — run migration 20260831000000_ensure_track_metadata_pkey.sql");
      return;
    }
    throw error;
  }
};


export const toggleArtistFavorite = async (userId, artistName) => {
  const { data: artist } = await supabase
    .from("artists")
    .select("id")
    .eq("name", artistName)
    .limit(1)
    .maybeSingle();
  if (!artist) return false;

  const { data: existing } = await supabase
    .from("favorite_artists")
    .select("artist_id")
    .eq("user_id", userId)
    .eq("artist_id", artist.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("favorite_artists")
      .delete()
      .eq("user_id", userId)
      .eq("artist_id", artist.id);
    if (error) throw error;
    return false;
  }

  const { error } = await supabase
    .from("favorite_artists")
    .insert({ user_id: userId, artist_id: artist.id });
  if (error) throw error;
  return true;
};


export const searchCatalog = async (query, limit = 8) => {
  const sanitized = (query || "").replace(/[,()%_\\]/g, " ").trim();
  if (!sanitized) {
    return { tracks: [], artists: [] };
  }
  const q = `%${sanitized.replace(/"/g, "")}%`;
  const [tracksRes, artistsRes] = await Promise.all([
    supabase
      .from("tracks")
      .select(`
        id,
        canonical_title,
        canonical_artist,
        artist_id,
        artists!tracks_artist_id_fkey ( id, name, photo_url ),
        track_metadata ( artwork_url )
      `)
      .or(`canonical_title.ilike.${q},canonical_artist.ilike.${q}`)
      .limit(limit),
    supabase
      .from("artists")
      .select("id, name, photo_url")
      .ilike("name", q)
      .limit(6),
  ]);

  if (tracksRes.error) {
    console.warn("[Catalog] Track search failed:", tracksRes.error.message);
  }
  if (artistsRes.error) {
    console.warn("[Catalog] Artist search failed:", artistsRes.error.message);
  }

  return {
    tracks: (tracksRes.data || []).map((t) => {
      const artistRow = Array.isArray(t.artists) ? t.artists[0] : t.artists;
      const meta = Array.isArray(t.track_metadata) ? t.track_metadata[0] : t.track_metadata;
      return {
        id: t.id,
        title: t.canonical_title,
        artist: artistRow?.name || t.canonical_artist,
        artist_id: t.artist_id,
        artistPhotoUrl: artistRow?.photo_url || "",
        cover: meta?.artwork_url || "",
      };
    }),
    artists: (artistsRes.data || []).map((a) => ({
      id: a.id,
      name: a.name,
      photo_url: a.photo_url || "",
    })),
  };
};


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


export const getLikedSongs = async (userId) => {
  const { data, error } = await supabase
    .from("liked_songs")
    .select("track_id")
    .eq("user_id", userId);

  if (error) throw error;
  return new Set(data.map((row) => row.track_id));
};

export const getRecentlyLikedSongs = async (userId, limit = 10) => {
  const { data, error } = await supabase
    .from("liked_songs")
    .select("track_id, liked_at")
    .eq("user_id", userId)
    .order("liked_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
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
    image: null,
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
    image: null,
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

export const deleteUserTrack = async (userTrackId) => {
  const { error } = await supabase
    .from("user_tracks")
    .delete()
    .eq("id", userTrackId);

  if (error) throw error;
};


export const registerTrackInSupabase = async ({
  userId,
  driveFileId,
  filename,
  trackInfo,
  lyricsData,
  itunesTrackId = null,
}) => {
  const { data, error } = await supabase.rpc("register_track", {
    p_user_id: userId,
    p_drive_file_id: driveFileId,
    p_filename: filename,
    p_title: trackInfo.title,
    p_artist: trackInfo.artist,
    p_duration_seconds: trackInfo.durationSeconds,
    p_itunes_artist_id: trackInfo.itunesArtistId || null,
    p_itunes_track_id: itunesTrackId,
    p_artwork_url: trackInfo.artworkUrl || null,
    p_primary_genre: trackInfo.primaryGenre || null,
    p_synced_lyrics: lyricsData?.syncedLyrics || null,
    p_plain_lyrics: lyricsData?.plainLyrics || null,
    p_is_synced: lyricsData?.isSynced || false,
  });

  if (error) throw error;
  return data;
};