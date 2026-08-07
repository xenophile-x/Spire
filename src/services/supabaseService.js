import { supabase } from "@/lib/supabaseClient";

export async function registerTrackInSupabase({ userId, driveFileId, filename, trackInfo, lyricsData, trackId: providedTrackId }) {
  let activeUserId = userId;
  
  const { data: authData } = await supabase.auth.getUser();
  if (authData?.user?.id) {
    activeUserId = authData.user.id;
  }

  if (!activeUserId) {
    throw new Error("User must be logged in with Supabase Auth to upload tracks.");
  }

  const titleToUse = trackInfo?.title || filename.replace(/\.[^/.]+$/, "");
  const artistToUse = trackInfo?.artist || "Unknown Artist";

  let trackId = null;

  // 1. Check if track already exists
  const { data: existingTrack } = await supabase
    .from("tracks")
    .select("id")
    .eq("canonical_title", titleToUse)
    .eq("canonical_artist", artistToUse)
    .maybeSingle();

  if (existingTrack?.id) {
    trackId = existingTrack.id;
  } else {
    // 2. Insert new track — id is TEXT PK, must be provided explicitly
    // Use iTunes trackId if available, otherwise generate a deterministic slug
    const generatedId =
      providedTrackId ||
      `${artistToUse.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${titleToUse.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${Date.now()}`;

    const { data: trackData, error: trackError } = await supabase
      .from("tracks")
      .insert([
        {
          id: generatedId,
          canonical_title: titleToUse,
          canonical_artist: artistToUse,
          duration_seconds: trackInfo?.durationSeconds || 0,
        },
      ])
      .select()
      .maybeSingle();

    if (trackData?.id) {
      trackId = trackData.id;
    } else {
      const { data: fallbackTrack } = await supabase
        .from("tracks")
        .select("id")
        .eq("canonical_title", titleToUse)
        .maybeSingle();

      trackId = fallbackTrack?.id;
    }
  }

  if (!trackId) {
    throw new Error("Could not create or reference track in 'tracks' table.");
  }

  // 3. Upsert track_metadata (only columns that exist in schema)
  await supabase.from("track_metadata").upsert(
    [
      {
        track_id: trackId,
        album_name: trackInfo?.album || "Uploaded Single",
        artwork_url: trackInfo?.artworkUrl || null,
        primary_genre: trackInfo?.primaryGenre || "Unknown",
      },
    ],
    { onConflict: "track_id" }
  );

  // 4. Upsert fetched lyrics into track_lyrics table
  await supabase.from("track_lyrics").upsert(
    [
      {
        track_id: trackId,
        synced_lyrics: lyricsData?.syncedLyrics || "",
        plain_lyrics: lyricsData?.plainLyrics || "",
        is_synced: lyricsData?.isSynced || false,
      },
    ],
    { onConflict: "track_id" }
  );

  // 5. Link track in user_tracks
  const { data: userTrackData, error: userTrackError } = await supabase
    .from("user_tracks")
    .insert([
      {
        user_id: activeUserId,
        track_id: trackId,
        drive_file_id: driveFileId,
        uploaded_filename: filename,
      },
    ])
    .select()
    .single();

  if (userTrackError) {
    console.error("user_tracks link error detail:", JSON.stringify(userTrackError, null, 2));
    throw userTrackError;
  }

  return userTrackData;
}

export async function getUserLibrary(userId) {
  let activeUserId = userId;
  if (!activeUserId) {
    const { data } = await supabase.auth.getUser();
    activeUserId = data?.user?.id;
  }

  // Ensure activeUserId is a non-empty string to avoid 400 Bad Request
  if (!activeUserId || typeof activeUserId !== "string") return [];

  try {
    // Attempt standard PostgREST nested join
    const { data: userTracks, error } = await supabase
      .from("user_tracks")
      .select(`
        id,
        user_id,
        track_id,
        drive_file_id,
        uploaded_filename,
        created_at,
        tracks!inner (
          id,
          canonical_title,
          canonical_artist,
          duration_seconds
        )
      `)
      .eq("user_id", activeUserId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Primary user_tracks query failed, attempting manual join fallback:", error);
      return await getLibraryFallback(activeUserId);
    }

    if (!userTracks || userTracks.length === 0) return [];

    // Extract track IDs to fetch metadata and lyrics in parallel
    const trackIds = userTracks.map((ut) => ut.track_id).filter(Boolean);

    const [metadataRes, lyricsRes] = await Promise.all([
      supabase.from("track_metadata").select("*").in("track_id", trackIds),
      supabase.from("track_lyrics").select("*").in("track_id", trackIds),
    ]);

    const metadataMap = new Map((metadataRes.data || []).map((m) => [m.track_id, m]));
    const lyricsMap = new Map((lyricsRes.data || []).map((l) => [l.track_id, l]));

    // Combine into uniform structure matching your React application state
    return userTracks.map((ut) => {
      const trackObj = ut.tracks || {};
      const metaObj = metadataMap.get(ut.track_id) || {};
      const lyricsObj = lyricsMap.get(ut.track_id) || {};

      return {
        id: ut.id,
        user_id: ut.user_id,
        drive_file_id: ut.drive_file_id,
        uploaded_filename: ut.uploaded_filename,
        created_at: ut.created_at,
        tracks: {
          id: trackObj.id,
          canonical_title: trackObj.canonical_title,
          canonical_artist: trackObj.canonical_artist,
          duration_seconds: trackObj.duration_seconds,
          track_metadata: metaObj,
          track_lyrics: lyricsObj,
        },
      };
    });
  } catch (err) {
    console.error("Supabase library fetch error:", err);
    return [];
  }
}

// ------------------ Listening History (Continue Listening) ------------------

// Returns the ids of tracks the user has played, ordered by most recent play.
// Each listen event is a row in listening_history; duplicates are collapsed
// client-side (first = most recent) and capped to `limit` distinct tracks.
export async function getListeningHistoryTrackIds(userId, limit = 8) {
  if (!userId || typeof userId !== "string") return [];

  try {
    const { data, error } = await supabase
      .from("listening_history")
      .select("track_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit * 8);

    if (error || !data || data.length === 0) return [];

    const ids = [];
    const seen = new Set();
    for (const row of data) {
      if (row.track_id && !seen.has(row.track_id)) {
        seen.add(row.track_id);
        ids.push(row.track_id);
      }
      if (ids.length >= limit) break;
    }
    return ids;
  } catch (err) {
    console.error("getListeningHistoryTrackIds error:", err);
    return [];
  }
}

// Records a single play event for the given track (resolves the active user).
export async function recordListen(trackId, genre = null) {
  let activeUserId = null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    activeUserId = user?.id;
  } catch {
    return null;
  }

  if (!activeUserId || !trackId) return null;

  const { data, error } = await supabase
    .from("listening_history")
    .insert([{ user_id: activeUserId, track_id: trackId, genre }])
    .select();

  if (error) {
    console.warn("recordListen failed:", error.message);
    return null;
  }
  return data;
}

// Fallback method if foreign key relations are missing in Supabase schema
async function getLibraryFallback(userId) {
  const { data: userTracks } = await supabase
    .from("user_tracks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (!userTracks || userTracks.length === 0) return [];

  const trackIds = userTracks.map((ut) => ut.track_id).filter(Boolean);

  const [tracksRes, metaRes, lyricsRes] = await Promise.all([
    supabase.from("tracks").select("*").in("id", trackIds),
    supabase.from("track_metadata").select("*").in("track_id", trackIds),
    supabase.from("track_lyrics").select("*").in("track_id", trackIds),
  ]);

  const tracksMap = new Map((tracksRes.data || []).map((t) => [t.id, t]));
  const metaMap = new Map((metaRes.data || []).map((m) => [m.track_id, m]));
  const lyricsMap = new Map((lyricsRes.data || []).map((l) => [l.track_id, l]));

  return userTracks.map((ut) => {
    const trackObj = tracksMap.get(ut.track_id) || {};
    return {
      ...ut,
      tracks: {
        ...trackObj,
        track_metadata: metaMap.get(ut.track_id) || {},
        track_lyrics: lyricsMap.get(ut.track_id) || {},
      },
    };
  });
}

// ------------------ Liked Songs ------------------

export async function getUserLikedSongs(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("liked_songs")
    .select("track_id")
    .eq("user_id", userId);

  if (error) {
    console.error("Error fetching liked songs:", error);
    return [];
  }
  return data.map((d) => d.track_id);
}

export async function addLikedSongInSupabase(userId, trackId) {
  if (!userId || !trackId) return false;
  const { error } = await supabase
    .from("liked_songs")
    .upsert({ user_id: userId, track_id: trackId, liked_at: new Date().toISOString() }, { onConflict: "user_id,track_id" });

  if (error) {
    console.error("Error adding liked song:", error);
    return false;
  }
  return true;
}

export async function removeLikedSongFromSupabase(userId, trackId) {
  if (!userId || !trackId) return false;
  const { error } = await supabase
    .from("liked_songs")
    .delete()
    .eq("user_id", userId)
    .eq("track_id", trackId);

  if (error) {
    console.error("Error removing liked song:", error);
    return false;
  }
  return true;
}

// ------------------ Playlists ------------------

export async function getUserPlaylists(userId) {
  if (!userId) return [];
  const { data: playlists, error: playlistsError } = await supabase
    .from("playlists")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (playlistsError) {
    console.error("Error fetching user playlists:", playlistsError);
    return [];
  }

  // For each playlist, fetch its tracks (track IDs)
  const formattedPlaylists = await Promise.all(
    playlists.map(async (pl) => {
      const { data: tracks, error: tracksError } = await supabase
        .from("playlist_tracks")
        .select("track_id")
        .eq("playlist_id", pl.id)
        .order("position", { ascending: true });

      return {
        id: pl.id,
        title: pl.title,
        description: pl.description || "",
        is_public: pl.is_public ?? true,
        songIds: (tracks || []).map((t) => t.track_id),
        isFavorite: pl.title === "Favorite Songs", // Mark Favorite Songs specifically
        isStarIcon: pl.title === "Favorite Songs",
      };
    })
  );

  return formattedPlaylists;
}

export async function createPlaylistInSupabase(userId, title, description = "") {
  if (!userId || !title) return null;
  const { data, error } = await supabase
    .from("playlists")
    .insert({
      user_id: userId,
      title,
      description,
      is_public: true,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating playlist:", error);
    return null;
  }

  return {
    id: data.id,
    title: data.title,
    description: data.description || "",
    is_public: data.is_public ?? true,
    songIds: [],
  };
}

export async function deletePlaylistFromSupabase(playlistId) {
  if (!playlistId) return false;
  // Delete tracks from playlist first
  await supabase.from("playlist_tracks").delete().eq("playlist_id", playlistId);

  const { error } = await supabase
    .from("playlists")
    .delete()
    .eq("id", playlistId);

  if (error) {
    console.error("Error deleting playlist:", error);
    return false;
  }
  return true;
}

export async function addTrackToPlaylistInSupabase(playlistId, trackId) {
  if (!playlistId || !trackId) return false;

  // Get current max position to append
  const { data } = await supabase
    .from("playlist_tracks")
    .select("position")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = data && data.length > 0 ? (data[0].position || 0) + 1 : 1;

  const { error } = await supabase
    .from("playlist_tracks")
    .insert({
      playlist_id: playlistId,
      track_id: trackId,
      position: nextPosition,
      added_at: new Date().toISOString(),
    });

  if (error) {
    console.error("Error adding track to playlist:", error);
    return false;
  }
  return true;
}

export async function removeTrackFromPlaylistInSupabase(playlistId, trackId) {
  if (!playlistId || !trackId) return false;
  const { error } = await supabase
    .from("playlist_tracks")
    .delete()
    .eq("playlist_id", playlistId)
    .eq("track_id", trackId);

  if (error) {
    console.error("Error removing track from playlist:", error);
    return false;
  }
  return true;
}