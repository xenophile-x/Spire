import { supabase } from "@/lib/supabaseClient";

export async function registerTrackInSupabase({ userId, driveFileId, filename, trackInfo, lyricsData }) {
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
    // 2. Insert new track
    const { data: trackData, error: trackError } = await supabase
      .from("tracks")
      .insert([
        {
          canonical_title: titleToUse,
          canonical_artist: artistToUse,
          duration_seconds: Math.round(trackInfo?.durationSeconds || 0),
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

  // 3. Upsert track_metadata
  await supabase.from("track_metadata").upsert(
    [
      {
        track_id: trackId,
        album_name: trackInfo?.album || "Uploaded Single",
        artwork_url: trackInfo?.artworkUrl || null,
        artist_photo_url: trackInfo?.artistPhotoUrl || trackInfo?.artworkUrl || null,
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