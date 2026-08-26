import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  getUserLibrary,
  getAcceptedLibraryShares,
  getListeningHistoryWithGenres,
  getLikedSongs,
  toggleLikedSong,
  getUserPlaylists,
  addTrackToPlaylist,
  createPlaylist,
  renamePlaylist,
  deletePlaylist,
  removeTrackFromPlaylist,
  getArtistsWithSampleTrack,
  updateArtistPhoto,
  updateArtistProfile,
  updateTrackArtwork,
} from "@/services/supabaseService";
import { fetchArtworkFromITunes } from "@/services/uploadPipeline";
import { fetchArtistProfile } from "@/services/itunesService";
import { deleteTrackAndDriveFile } from "@/lib/deleteTrack";
import { splitArtistNames } from "@/utils/artistNames";

const DEFAULT_BG_IMAGE =
  "https://images.unsplash.com/photo-1778789172863-a137613623e0?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

const LibraryContext = React.createContext(null);

// Bump to force every client to run one photo-refresh pass with the current
// chain (Wikipedia-first), then the per-artist records go dormant again.
const ARTIST_PHOTO_SYNC_VERSION = "v9-wiki-first";
// Artists whose profile lookup came back empty are remembered for a week so
// we stop re-calling the metadata service on every session.
const ARTIST_PROFILE_ATTEMPTS_KEY = "spire:artist-profile-attempts";
const ARTIST_PROFILE_RETRY_MS = 7 * 24 * 60 * 60 * 1000;

export function LibraryProvider({ children }) {
  const { user } = useAuth();

  const [likedTrackIds, setLikedTrackIds] = useState(new Set());
  const [playlists, setPlaylists] = useState([]);
  const [userTracks, setUserTracks] = useState([]);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [listeningHistory, setListeningHistory] = useState([]);
  const [playedTrackIds, setPlayedTrackIds] = useState([]);
  const [recommendedPlaylist, setRecommendedPlaylist] = useState(() => {
    try {
      const raw = localStorage.getItem("spire:rec:songIds");
      if (!raw) return null;
      const ids = JSON.parse(raw);
      if (!Array.isArray(ids) || ids.length === 0) return null;
      return {
        id: "recommended",
        title: "Made for you",
        isRecommended: true,
        songIds: ids,
      };
    } catch {
      return null;
    }
  });
  const [recommendedGeneratedAt, setRecommendedGeneratedAt] = useState(() =>
    Number(localStorage.getItem("spire:rec:generatedAt") || 0)
  );


  useEffect(() => {
    setPlaylists((prev) =>
      prev.map((pl) =>
        pl.id === "1" ? { ...pl, songIds: Array.from(likedTrackIds) } : pl
      )
    );
  }, [likedTrackIds]);


  useEffect(() => {
    setPlaylists((prev) => {
      const others = prev.filter(
        (pl) => pl.id !== "recently-played" && pl.id !== "recently-added"
      );
      const recentlyPlayed = {
        id: "recently-played",
        title: "Recently Played",
        isSmartPlaylist: true,
        songIds: playedTrackIds.slice().reverse(),
      };
      const recentlyAdded = {
        id: "recently-added",
        title: "Recently Added",
        isSmartPlaylist: true,
        songIds: [...userTracks]
          .sort(
            (a, b) =>
              new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0)
          )
          .slice(0, 25)
          .map((t) => t.id),
      };
      return [...others, recentlyPlayed, recentlyAdded];
    });
  }, [playedTrackIds, userTracks]);

  const loadUserPreferences = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [likes, userPlaylists] = await Promise.all([
        getLikedSongs(user.id),
        getUserPlaylists(user.id)
      ]);
      setLikedTrackIds(likes);

      const favoritePlaylist = {
        id: "1",
        title: "Favorite Songs",
        isFavorite: true,
        isStarIcon: true,
        image: "https://static.vecteezy.com/system/resources/previews/005/293/180/non_2x/a-star-with-rounded-corners-free-vector.jpg",
        songIds: Array.from(likes),
      };

      setPlaylists([favoritePlaylist, ...userPlaylists]);
    } catch (err) {
      console.error("Failed to load user preferences:", err);
    }
  }, [user?.id]);

  const loadLibrary = useCallback(async () => {
    setLibraryLoaded(false);
    if (!user?.id) return;
    try {
      const [records, shares] = await Promise.all([
        getUserLibrary(user.id),


        getAcceptedLibraryShares(user.id).catch((err) => {
          console.warn("[Library] Failed to load accepted shares:", err);
          return [];
        }),
      ]);

      const sharedLibraries = await Promise.all(
        shares.map(async (share) => {
          try {
            return {
              records: await getUserLibrary(share.owner_id),
              sharedBy: share.shared_by,
            };
          } catch (err) {
            console.warn("[Library] Failed to load shared library:", err);
            return { records: [], sharedBy: null };
          }
        })
      );

      const allRecords = [
        ...records.map((rec) => ({ rec, sharedBy: null })),
        ...sharedLibraries.flatMap((lib) =>
          lib.records.map((rec) => ({ rec, sharedBy: lib.sharedBy }))
        ),
      ];

      const formattedPromises = allRecords.map(async ({ rec, sharedBy }) => {
        const trackObj = rec.tracks || {};

        const meta = Array.isArray(trackObj.track_metadata)
          ? trackObj.track_metadata[0] || {}
          : trackObj.track_metadata || {};

        const lyricsObj = Array.isArray(trackObj.track_lyrics)
          ? trackObj.track_lyrics[0] || {}
          : trackObj.track_lyrics || {};

        const artistObj = Array.isArray(trackObj.artists)
          ? trackObj.artists[0] || {}
          : trackObj.artists || {};

        const title = trackObj.canonical_title || rec.uploaded_filename || "Untitled Track";
        const artist = artistObj.name || trackObj.canonical_artist || "Unknown Artist";

        let coverUrl = meta.artwork_url || meta.artworkUrl;

        if (!coverUrl || coverUrl === DEFAULT_BG_IMAGE) {
          try {
            const iTunesCover = await fetchArtworkFromITunes(title, artist);
            if (iTunesCover) {
              coverUrl = iTunesCover;
              // Persist so the DB stays the single source of truth — next
              // loads skip the iTunes lookup entirely and every view shows
              // the same artwork.
              if (trackObj.id) {
                updateTrackArtwork(trackObj.id, iTunesCover).catch(() => {});
              }
            } else {
              coverUrl = `https://picsum.photos/seed/${encodeURIComponent(title)}/400/400`;
            }
          } catch (err) {
            console.warn("[Library] iTunes artwork fetch failed for", title, err);
            coverUrl = `https://picsum.photos/seed/${encodeURIComponent(title)}/400/400`;
          }
        }

        return {
          id: trackObj.id || rec.track_id || rec.id,
          user_track_id: rec.id,
          drive_file_id: rec.drive_file_id || rec.driveFileId,
          uploaded_filename: rec.uploaded_filename || rec.uploadedFilename || "",
          uploadedAt: rec.created_at,
          title,
          artist,
          artist_id: trackObj.artist_id || null,
          artistPhotoUrl: artistObj.photo_url || artistObj.photoUrl || "",
          artistBio: artistObj.bio || "",
          artistIsFavorite: !!(
            Array.isArray(artistObj.favorite_artists)
              ? artistObj.favorite_artists.length
              : artistObj.favorite_artists
          ),
          genre: meta.primary_genre || meta.primaryGenre || "Unknown",
          cover: coverUrl,
          artworkUrl: coverUrl,
          synced_lyrics: lyricsObj.synced_lyrics || lyricsObj.syncedLyrics || "",
          duration: trackObj.duration_seconds || 0,
          isShared: Boolean(sharedBy),
          sharedBy: sharedBy || null,
        };
      });

      const formatted = await Promise.all(formattedPromises);

      const uniqueTracks = [];
      const seenIds = new Set();
      for (const track of formatted) {
        if (!track.id || seenIds.has(track.id)) continue;
        seenIds.add(track.id);
        uniqueTracks.push(track);
      }
      setUserTracks(uniqueTracks);
    } catch (err) {
      console.error("Failed to load library:", err);
    } finally {
      setLibraryLoaded(true);
    }
  }, [user?.id]);

  const loadContinueListening = useCallback(async () => {
    if (!user?.id) return;
    try {
      const history = await getListeningHistoryWithGenres(user.id, 50);
      const seen = new Set();
      const unique = [];
      for (const h of history) {
        if (!h.track_id || seen.has(h.track_id)) continue;
        seen.add(h.track_id);
        unique.push(h);
      }
      setListeningHistory(unique);
      setPlayedTrackIds(unique.map((h) => h.track_id));
    } catch (err) {
      console.error("Failed to load continue listening:", err);
    }
  }, [user?.id]);

  useEffect(() => {
    const load = async () => {
      await loadLibrary();
      await loadContinueListening();
      await loadUserPreferences();
    };
    load();
  }, [loadLibrary, loadContinueListening, loadUserPreferences]);

  const toggleLikeTrack = useCallback(
    async (trackId) => {
      if (!trackId || !user?.id) return;
      const wasLiked = likedTrackIds.has(trackId);

      setLikedTrackIds((prev) => {
        const next = new Set(prev);
        if (wasLiked) next.delete(trackId);
        else next.add(trackId);
        return next;
      });

      try {
        await toggleLikedSong(user.id, trackId, wasLiked);
      } catch (err) {
        console.error("Failed to toggle like:", err);
        setLikedTrackIds((prev) => {
          const next = new Set(prev);
          if (wasLiked) next.add(trackId);
          else next.delete(trackId);
          return next;
        });
      }
    },
    [user?.id, likedTrackIds]
  );

  const handleAddToPlaylist = useCallback(
    async (playlistId, trackId) => {
      if (!trackId) return;

      if (playlistId === "1") {
        await toggleLikeTrack(trackId);
        return;
      }


      const playlist = playlists.find((pl) => pl.id === playlistId);
      if (playlist && (playlist.songIds || []).includes(trackId)) return;

      setPlaylists((prev) =>
        prev.map((pl) => {
          if (pl.id === playlistId && !(pl.songIds || []).includes(trackId)) {
            return { ...pl, songIds: [...(pl.songIds || []), trackId] };
          }
          return pl;
        })
      );

      try {
        await addTrackToPlaylist(playlistId, trackId);
      } catch (err) {
        console.error("Failed to add to playlist:", err);
        setPlaylists((prev) =>
          prev.map((pl) =>
            pl.id === playlistId
              ? { ...pl, songIds: (pl.songIds || []).filter((id) => id !== trackId) }
              : pl
          )
        );
      }
    },
    [playlists, toggleLikeTrack]
  );

  const handleCreatePlaylist = useCallback(
    async (title) => {
      if (!user?.id || !title.trim()) return;
      try {
        const newPlaylist = await createPlaylist(user.id, title.trim());
        setPlaylists((prev) => [...prev, newPlaylist]);
      } catch (err) {
        console.error("Failed to create playlist:", err);
      }
    },
    [user?.id]
  );

  const handleDeletePlaylist = useCallback(
    async (playlistId) => {
      if (playlistId === "1") return;
      setPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
      try {
        await deletePlaylist(playlistId);
      } catch (err) {
        console.error("Failed to delete playlist:", err);
        await loadUserPreferences();
      }
    },
    [loadUserPreferences]
  );

  const handleRenamePlaylist = useCallback(
    async (playlistId, newTitle) => {
      if (playlistId === "1") return;
      const trimmed = (newTitle || "").trim();
      if (!trimmed) return;
      setPlaylists((prev) =>
        prev.map((p) => (p.id === playlistId ? { ...p, title: trimmed } : p))
      );
      try {
        await renamePlaylist(playlistId, trimmed);
      } catch (err) {
        console.error("Failed to rename playlist:", err);
        await loadUserPreferences();
      }
    },
    [loadUserPreferences]
  );

  const handleRemoveTrackFromPlaylist = useCallback(
    async (playlistId, trackId) => {
      if (playlistId === "1") {
        await toggleLikeTrack(trackId);
        return;
      }
      setPlaylists((prev) =>
        prev.map((pl) =>
          pl.id === playlistId
            ? { ...pl, songIds: (pl.songIds || []).filter((id) => id !== trackId) }
            : pl
        )
      );
      try {
        await removeTrackFromPlaylist(playlistId, trackId);
      } catch (err) {
        console.error("Failed to remove track from playlist:", err);
        await loadUserPreferences();
      }
    },
    [toggleLikeTrack, loadUserPreferences]
  );

  const handleDeleteTrack = useCallback(
    async (trackOrId) => {
      // Callers pass either a track object (TrackCard, ArtistOverview) or an id.
      const trackId =
        trackOrId && typeof trackOrId === "object" ? trackOrId.id : trackOrId;
      const track = userTracks.find((t) => t.id === trackId);


      if (!track || track.isShared) return;

      setUserTracks((prev) => prev.filter((t) => t.id !== trackId));
      try {
        if (track.user_track_id) {


          await deleteTrackAndDriveFile(track.user_track_id);
        }
      } catch (err) {
        console.error("Failed to delete track:", err);
        await loadLibrary();
      }
    },
    [userTracks, loadLibrary]
  );

  const handleSaveRecommendedPlaylist = useCallback(async () => {
    if (!user?.id || !recommendedPlaylist?.songIds?.length) return;
    try {
      const newPlaylist = await createPlaylist(user.id, "Made for you");
      for (const trackId of recommendedPlaylist.songIds) {
        await addTrackToPlaylist(newPlaylist.id, trackId);
      }
      setPlaylists((prev) => [
        ...prev,
        { ...newPlaylist, songIds: recommendedPlaylist.songIds },
      ]);
    } catch (err) {
      console.error("Failed to save recommended playlist:", err);
    }
  }, [user?.id, recommendedPlaylist]);

  const genrePlaylists = useMemo(() => {
    const byGenre = new Map();
    for (const t of userTracks) {
      const genre = String(t.genre || "Unknown").trim();
      if (genre === "Unknown" || genre === "Music") continue;
      if (!byGenre.has(genre)) byGenre.set(genre, []);
      byGenre.get(genre).push(t.id);
    }
    const list = [];
    for (const [genre, songIds] of byGenre) {
      if (songIds.length < 2) continue;
      list.push({
        id: `genre:${genre.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        title: genre,
        isGenrePlaylist: true,
        songIds,
      });
    }
    return list;
  }, [userTracks]);


  const readProfileAttempts = () => {
    try {
      return JSON.parse(localStorage.getItem(ARTIST_PROFILE_ATTEMPTS_KEY)) || {};
    } catch {
      return {};
    }
  };
  const writeProfileAttempts = (map) => {
    try {
      localStorage.setItem(ARTIST_PROFILE_ATTEMPTS_KEY, JSON.stringify(map));
    } catch {}
  };

  const artistSyncInFlight = useRef(false);
  const artistAutoSyncDone = useRef({});
  const [artistSyncState, setArtistSyncState] = useState({
    status: "idle",
    total: 0,
    done: 0,
    updated: 0,
    current: "",
  });

  const runArtistPhotoSync = useCallback(
    async ({ force = false } = {}) => {
      if (!user?.id || artistSyncInFlight.current) return;
      artistSyncInFlight.current = true;
      let syncOk = true;
      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      try {
        const artists = await getArtistsWithSampleTrack(user.id);
        setArtistSyncState({ status: "syncing", total: artists.length, done: 0, updated: 0, current: "" });
        const updates = new Map();
        const attempts = readProfileAttempts();
        let attemptsDirty = false;
        let doneCount = 0;
        for (let i = 0; i < artists.length; i++) {
          const artist = artists[i];
          setArtistSyncState((s) => ({ ...s, done: doneCount, current: artist.name }));


          if (splitArtistNames(artist.name).length > 1) {
            if (artist.photo_url) {
              await updateArtistPhoto(artist.id, null);
              updates.set(artist.id, null);
            }
            await delay(300);
            doneCount += 1;
            continue;
          }


          // Attempts record. Legacy entries were bare timestamps; current
          // entries are { ts, ok, v } so every photo-chain upgrade triggers
          // exactly one refresh pass before going dormant again.
          const rawAttempt = attempts[artist.id];
          const attemptRec =
            typeof rawAttempt === "number"
              ? { ts: rawAttempt, ok: false, v: null }
              : rawAttempt || null;

          // Settled: successfully synced under the current chain version and
          // holding a photo/bio — keep it. Older-version photos get one
          // re-fetch here so they migrate onto the wiki-first chain; `force`
          // (Settings refresh) bypasses regardless.
          if (
            !force &&
            attemptRec?.ok &&
            attemptRec?.v === ARTIST_PHOTO_SYNC_VERSION &&
            (artist.photo_url || artist.bio)
          ) {
            doneCount += 1;
            continue;
          }

          // Recently failed — don't hammer the metadata service again.
          if (!force && !attemptRec?.ok && Date.now() - (attemptRec?.ts || 0) < ARTIST_PROFILE_RETRY_MS) {
            doneCount += 1;
            continue;
          }

          const profile = await fetchArtistProfile(artist.name);
          const photoUrl = profile.photo_url || null;
          const bioText = profile.bio || null;

          const photoChanged = photoUrl && artist.photo_url !== photoUrl;
          const bioChanged = bioText && artist.bio !== bioText;

          if (photoChanged || bioChanged) {
            await updateArtistProfile(artist.id, {
              ...(photoChanged ? { photoUrl } : {}),
              ...(bioChanged ? { bio: bioText } : {}),
            });
            updates.set(artist.id, {
              photo: photoChanged ? photoUrl : artist.photo_url ?? null,
              bio: bioChanged ? bioText : artist.bio ?? null,
            });
          }

          if (photoUrl || bioText) {
            attempts[artist.id] = {
              ts: Date.now(),
              ok: true,
              v: ARTIST_PHOTO_SYNC_VERSION,
            };
          } else {
            attempts[artist.id] = { ts: Date.now(), ok: false };
          }
          attemptsDirty = true;


          await delay(1000);
          doneCount += 1;
        }

        if (attemptsDirty) writeProfileAttempts(attempts);

        if (updates.size > 0) {
          setUserTracks((prev) =>
            prev.map((t) => {
              const upd = updates.get(t.artist_id);
              return upd
                ? { ...t, artistPhotoUrl: upd.photo ?? t.artistPhotoUrl, artistBio: upd.bio ?? t.artistBio }
                : t;
            })
          );
        }
        setArtistSyncState({ status: "done", total: artists.length, done: artists.length, updated: updates.size, current: "" });
      } catch (err) {
        console.error("Auto artist photo sync failed:", err);
        syncOk = false;
        setArtistSyncState((s) => ({ ...s, status: "error" }));
      } finally {


        if (syncOk || force) artistAutoSyncDone.current[user.id] = ARTIST_PHOTO_SYNC_VERSION;
        artistSyncInFlight.current = false;
      }
    },
    [user?.id]
  );

  const resyncArtistPhotos = useCallback(() => {
    runArtistPhotoSync({ force: true });
  }, [runArtistPhotoSync]);

  useEffect(() => {
    if (!user?.id || userTracks.length === 0) return;
    if (artistAutoSyncDone.current[user.id] === ARTIST_PHOTO_SYNC_VERSION) return;
    runArtistPhotoSync({ force: false });
  }, [user?.id, userTracks.length, runArtistPhotoSync]);

  const value = {
    userTracks,
    setUserTracks,
    libraryLoaded,
    playlists,
    setPlaylists,
    likedTrackIds,
    listeningHistory,
    playedTrackIds,
    setPlayedTrackIds,
    recommendedPlaylist,
    setRecommendedPlaylist,
    recommendedGeneratedAt,
    setRecommendedGeneratedAt,
    genrePlaylists,
    toggleLikeTrack,
    handleAddToPlaylist,
    handleCreatePlaylist,
    handleDeletePlaylist,
    handleRenamePlaylist,
    handleRemoveTrackFromPlaylist,
    handleDeleteTrack,
    handleSaveRecommendedPlaylist,
    loadUserPreferences,
    resyncArtistPhotos,
    artistSyncState,
  };

  return (
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
  );
}

export function useLibrary() {
  const ctx = React.useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used within a LibraryProvider");
  return ctx;
}