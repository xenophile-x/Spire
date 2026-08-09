import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

import FloatingBar from "@/components/FloatingBar";
import GlassSearchBar from "@/components/GlassSearchBar";
import MusicBar from "@/components/MusicBar";
import AudioPlayer from "@/components/AudioPlayer";
import UploadModal from "@/components/UploadModal";
import TemperedGlassCard from "@/components/ui/TemperedGlassCard";
import { GlassButton } from "@/components/ui/glasscn/glass-button";

import Opening from "@/components/Opening";
import Landing from "@/components/Landing";

import HomeView from "@/views/HomeView";
import ExploreView from "@/views/ExploreView";
import PlaylistsView from "@/views/PlaylistsView";
import ExpandedLyricsView from "@/views/ExpandedLyricsView";
import SettingsView from "@/views/SettingsView";

import { processAudioUpload, fetchArtworkFromITunes } from "@/services/uploadPipeline";

import { uploadBackgroundToDrive } from "@/services/driveService";

import {
  getUserLibrary,
  getListeningHistoryWithGenres,
  recordListen,
  getLikedSongs,
  toggleLikedSong,
  getUserPlaylists,
  addTrackToPlaylist,
  createPlaylist,
  renamePlaylist,
  deletePlaylist,
  removeTrackFromPlaylist,
} from "@/services/supabaseService";

const DEFAULT_BG_IMAGE =
  "https://images.unsplash.com/photo-1778789172863-a137613623e0?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

const WALLPAPERS = [
  DEFAULT_BG_IMAGE,
  "https://images.unsplash.com/photo-1501854140801-50d01698950b?q=80&w=2175&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1785679339355-36cd3f065f7b?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHx0b3BpYy1mZWVkfDZ8NnNNVmpUTFNrZVF8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1785344468724-9f06e2534056?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHx0b3BpYy1mZWVkfDE4fDZzTVZqVExTa2VRfHxlbnwwfHx8fHw%3D",
  "https://images.unsplash.com/photo-1764140608148-80e010804af8?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHx0b3BpYy1mZWVkfDI1fDZzTVZqVExTa2VRfHxlbnwwfHx8fHw%3D",
  "https://images.unsplash.com/photo-1780715017688-a50312a5a249?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1777712081090-d335e662dce6?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1782848796142-88a50598df91?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1777978206855-cbc9508b4f6d?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1785199879496-23409f65d45c?q=80&w=2076&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1781817388497-bd831004913b?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1784704564341-d09f0023d30f?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1777849077481-a6a18ecc4552?q=80&w=1925&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://pixabay.com/videos/download/video-340838_medium.mp4",
];

const getBgUrlFromUser = (user, presetIdx, isPreset) => {
  const driveId = user?.user_metadata?.bg_drive_id;
  const usingPreset = isPreset ?? user?.user_metadata?.is_using_preset ?? !driveId;
  const idx = presetIdx ?? user?.user_metadata?.wallpaper_index ?? 0;

  if (usingPreset) {
    return WALLPAPERS[idx] || DEFAULT_BG_IMAGE;
  }
  if (driveId) {
    return `https://drive.google.com/thumbnail?id=${driveId}&sz=w2560`;
  }
  return WALLPAPERS[idx] || DEFAULT_BG_IMAGE;
};

function AppContent() {
  const [likedTrackIds, setLikedTrackIds] = useState(new Set());
  const [playlists, setPlaylists] = useState([]);

  const { user, loading, googleAccessToken, signInWithGoogle, signOut, refreshGoogleToken } = useAuth();
  const navigate = useNavigate();

  const [activeTrack, setActiveTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seekTime, setSeekTime] = useState(null);
  const [volume, setVolume] = useState(70);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [activePlaylistId, setActivePlaylistId] = useState(null);

  const [playedTrackIds, setPlayedTrackIds] = useState([]);
  const [listeningHistory, setListeningHistory] = useState([]);

  const [isExpandedViewOpen, setIsExpandedViewOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");

  // NEW: tracks whether the Google Drive token could not be silently refreshed,
  // meaning the user needs to reconnect via signInWithGoogle().
  const [needsReauth, setNeedsReauth] = useState(false);

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
        image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80",
        songIds: Array.from(likes),
      };

      setPlaylists([favoritePlaylist, ...userPlaylists]);
    } catch (err) {
      console.error("Failed to load user preferences:", err);
    }
  }, [user?.id]);

  useEffect(() => {
    setPlaylists((prev) =>
      prev.map((pl) =>
        pl.id === "1" ? { ...pl, songIds: Array.from(likedTrackIds) } : pl
      )
    );
  }, [likedTrackIds]);

  const [userTracks, setUserTracks] = useState([]);

  const continueListening = useMemo(
    () =>
      playedTrackIds
        .map((id) => userTracks.find((t) => t.id === id))
        .filter(Boolean),
    [userTracks, playedTrackIds]
  );

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadStep, setUploadStep] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");

  const customBgDriveId = user?.user_metadata?.bg_drive_id;
  const initialIsPreset = user?.user_metadata?.is_using_preset ?? !customBgDriveId;
  const initialPresetIdx = user?.user_metadata?.wallpaper_index ?? 0;

  const [wallpaperIndex, setWallpaperIndex] = useState(initialPresetIdx);
  const [isUsingPreset, setIsUsingPreset] = useState(initialIsPreset);
  const [bgUploading, setBgUploading] = useState(false);
  const [localBgUrl, setLocalBgUrl] = useState(null);

  const targetBgUrl = useMemo(() => {
    if (localBgUrl) return localBgUrl;
    if (isUsingPreset) {
      return WALLPAPERS[wallpaperIndex] || DEFAULT_BG_IMAGE;
    }
    if (customBgDriveId) {
      return `https://drive.google.com/thumbnail?id=${customBgDriveId}&sz=w2560`;
    }
    return WALLPAPERS[wallpaperIndex] || DEFAULT_BG_IMAGE;
  }, [isUsingPreset, wallpaperIndex, localBgUrl, customBgDriveId]);

  const initialBgUrl = getBgUrlFromUser(user, initialPresetIdx, initialIsPreset);
  const [currentBg, setCurrentBg] = useState(initialBgUrl);
  const [prevBg, setPrevBg] = useState(initialBgUrl);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    if (user?.user_metadata) {
      const metaIsPreset = user.user_metadata.is_using_preset ?? !user.user_metadata.bg_drive_id;
      const metaIdx = user.user_metadata.wallpaper_index ?? 0;

      setIsUsingPreset(metaIsPreset);
      setWallpaperIndex(metaIdx);

      if (!localBgUrl) {
        const loadedUrl = getBgUrlFromUser(user, metaIdx, metaIsPreset);
        setCurrentBg(loadedUrl);
        setPrevBg(loadedUrl);
      }
    }
  }, [user, localBgUrl]);

  useEffect(() => {
    if (targetBgUrl === currentBg) return;

    let isMounted = true;
    const img = new Image();
    img.src = targetBgUrl;

    img.onload = () => {
      if (!isMounted) return;

      setPrevBg(currentBg);
      setCurrentBg(targetBgUrl);
      setIsFading(true);

      const timer = setTimeout(() => {
        if (isMounted) setIsFading(false);
      }, 50);

      return () => clearTimeout(timer);
    };

    if (targetBgUrl.startsWith("blob:")) {
      setPrevBg(currentBg);
      setCurrentBg(targetBgUrl);
    }

    return () => {
      isMounted = false;
    };
  }, [targetBgUrl, currentBg]);

  const handleThemeToggle = useCallback(async () => {
    const nextIndex = (wallpaperIndex + 1) % WALLPAPERS.length;
    setLocalBgUrl(null);
    setIsUsingPreset(true);
    setWallpaperIndex(nextIndex);

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          is_using_preset: true,
          wallpaper_index: nextIndex,
        },
      });
      if (error) throw error;
      await supabase.auth.refreshSession();
    } catch (err) {
      console.error("Failed to persist preset wallpaper:", err);
    }
  }, [wallpaperIndex]);

  const handleBackgroundUpload = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!googleAccessToken) {
        alert("Google Access Token missing. Please sign out and log back in.");
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      setLocalBgUrl(previewUrl);
      setIsUsingPreset(false);

      try {
        setBgUploading(true);
        const driveFileId = await uploadBackgroundToDrive(
          file,
          googleAccessToken,
          customBgDriveId
        );

        if (!driveFileId) {
          throw new Error("Failed to receive Google Drive file ID.");
        }

        const { error } = await supabase.auth.updateUser({
          data: {
            bg_drive_id: driveFileId,
            is_using_preset: false,
          },
        });

        if (error) throw error;
        await supabase.auth.refreshSession();
      } catch (err) {
        console.error("Background upload failed:", err);
        alert(`Failed to save background: ${err.message || err}`);
      } finally {
        setBgUploading(false);
      }
    },
    [googleAccessToken, customBgDriveId]
  );

  const loadLibrary = useCallback(async () => {
    if (!user?.id) return;
    try {
      const records = await getUserLibrary(user.id);

      const formattedPromises = records.map(async (rec) => {
        const trackObj = rec.tracks || {};

        const meta = Array.isArray(trackObj.track_metadata)
          ? trackObj.track_metadata[0] || {}
          : trackObj.track_metadata || {};

        const lyricsObj = Array.isArray(trackObj.track_lyrics)
          ? trackObj.track_lyrics[0] || {}
          : trackObj.track_lyrics || {};

        const title = trackObj.canonical_title || rec.uploaded_filename || "Untitled Track";
        const artist = trackObj.canonical_artist || "Unknown Artist";

        let coverUrl = meta.artwork_url || meta.artworkUrl;

        if (!coverUrl || coverUrl === DEFAULT_BG_IMAGE) {
          const iTunesCover = await fetchArtworkFromITunes(title, artist);
          coverUrl = iTunesCover || `https://picsum.photos/seed/${encodeURIComponent(title)}/400/400`;
        }

        return {
          id: trackObj.id || rec.track_id || rec.id,
          user_track_id: rec.id,
          drive_file_id: rec.drive_file_id || rec.driveFileId,
          uploaded_filename: rec.uploaded_filename || rec.uploadedFilename || "",
          uploadedAt: rec.created_at,
          title,
          artist,
          genre: meta.primary_genre || meta.primaryGenre || "Unknown",
          cover: coverUrl,
          artworkUrl: coverUrl,
          synced_lyrics: lyricsObj.synced_lyrics || lyricsObj.syncedLyrics || "",
          duration: trackObj.duration_seconds || 0,
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
    }
  }, [user?.id]);

  const loadContinueListening = useCallback(async () => {
    if (!user?.id) return;
    try {
      const history = await getListeningHistoryWithGenres(user.id, 50);
      setListeningHistory(history);
      setPlayedTrackIds(history.map((h) => h.track_id));
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

  const handlePlayTrack = useCallback((track, playlistId = null) => {
    setActiveTrack({
      id: track.id,
      title: track.title,
      artist: track.artist,
      cover: track.cover || track.artworkUrl,
      artworkUrl: track.artworkUrl || track.cover,
      synced_lyrics: track.synced_lyrics || track.syncedLyrics || "",
      driveFileId: track.drive_file_id || track.driveFileId,
      genre: track.genre || track.primary_genre || "Unknown",
    });
    setActivePlaylistId(playlistId);
    setPlayedTrackIds((prev) => {
      const filtered = prev.filter((id) => id !== track.id);
      return [track.id, ...filtered].slice(0, 8);
    });
    if (user?.id) {
      recordListen(user.id, track.id, track.genre || track.primary_genre || "Unknown");
    }
    setCurrentTime(0);
    setSeekTime(0);
    setIsPlaying(true);
  }, [user?.id]);

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handleSeek = useCallback((time) => {
    setSeekTime(time);
    setCurrentTime(time);
  }, []);

  const handleNextTrack = useCallback(() => {
    if (!activeTrack || userTracks.length === 0) return;
    const idx = userTracks.findIndex((t) => t.id === activeTrack.id);

    if (isShuffle && userTracks.length > 1) {
      let r;
      do {
        r = Math.floor(Math.random() * userTracks.length);
      } while (r === idx);
      handlePlayTrack(userTracks[r]);
      return;
    }

    const nextIdx = idx >= 0 ? (idx + 1) % userTracks.length : 0;
    handlePlayTrack(userTracks[nextIdx]);
  }, [activeTrack, userTracks, isShuffle, handlePlayTrack]);

  const handlePreviousTrack = useCallback(() => {
    if (!activeTrack || userTracks.length === 0) return;
    const idx = userTracks.findIndex((t) => t.id === activeTrack.id);
    const prevIdx = idx >= 0 ? (idx - 1 + userTracks.length) % userTracks.length : 0;
    handlePlayTrack(userTracks[prevIdx]);
  }, [activeTrack, userTracks, handlePlayTrack]);

  const handleTrackEnded = useCallback(() => {
    if (isRepeat) {
      handlePlayTrack(activeTrack);
      return;
    }
    handleNextTrack();
  }, [isRepeat, activeTrack, handlePlayTrack, handleNextTrack]);

  useEffect(() => {
    const onKeyDown = (e) => {
      const el = e.target;
      const tag = el && el.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (el && el.isContentEditable)
      ) {
        return;
      }

      switch (e.key) {
        case "k":
        case "K":
          e.preventDefault();
          handleTogglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          handleSeek(Math.max(0, Math.min(duration, currentTime - 10)));
          break;
        case "ArrowRight":
          e.preventDefault();
          handleSeek(Math.max(0, Math.min(duration, currentTime + 10)));
          break;
        case "ArrowUp":
          e.preventDefault();
          setVolume((v) => Math.min(100, v + 5));
          break;
        case "ArrowDown":
          e.preventDefault();
          setVolume((v) => Math.max(0, v - 5));
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentTime, duration, handleTogglePlay, handleSeek, setVolume]);

  const handleFileUpload = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!googleAccessToken) {
        alert("Please login with Google first.");
        return;
      }

      const existing = userTracks.find((t) => t.uploaded_filename === file.name);
      if (existing) {
        const reupload = window.confirm(
          `"${file.name}" is already in your library.\n\nUpload again?`
        );
        if (!reupload) return;
      }

      setUploadFile(file);
      setIsUploadModalOpen(true);
      setUploadStep(1);
      setUploadError("");
      setUploadProgress(25);

      try {
        await processAudioUpload(file, user, googleAccessToken, (progress) => {
          setUploadStep(progress.step);
          setUploadProgress(progress.percent);
        });
        await loadLibrary();
      } catch (err) {
        console.error("Upload error:", err);
        setUploadError(err.message || "Upload failed");
      }
    },
    [googleAccessToken, user, loadLibrary, userTracks]
  );

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

      let alreadyThere = false;
      setPlaylists((prev) =>
        prev.map((pl) => {
          if (pl.id === playlistId) {
            const songIds = pl.songIds || [];
            if (songIds.includes(trackId)) {
              alreadyThere = true;
              return pl;
            }
            return { ...pl, songIds: [...songIds, trackId] };
          }
          return pl;
        })
      );

      if (alreadyThere) return;

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
    [toggleLikeTrack]
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

  const handlePlaylistPlay = useCallback(
    (playlistId, track) => {
      setActivePlaylistId(playlistId);
      handlePlayTrack(track, playlistId);
    },
    [handlePlayTrack]
  );

  // NEW: wraps refreshGoogleToken so AudioPlayer's retry-on-401 can surface
  // a clear "reconnect" prompt instead of failing silently when Supabase
  // cannot produce a genuinely fresh Google provider_token.
  const handleRefreshToken = useCallback(async () => {
    const fresh = await refreshGoogleToken();
    if (!fresh) {
      setNeedsReauth(true);
    } else {
      setNeedsReauth(false);
    }
    return fresh;
  }, [refreshGoogleToken]);

  // NEW: clear the reauth banner once the user reconnects successfully.
  useEffect(() => {
    if (googleAccessToken) {
      setNeedsReauth(false);
    }
  }, [googleAccessToken]);

  if (!user && !loading) {
    return (
      <div
        className="h-screen w-screen bg-cover bg-center bg-no-repeat text-white flex flex-col items-center justify-center p-4 relative"
        style={{ backgroundImage: `url("${DEFAULT_BG_IMAGE}")` }}
      >
        <div className="absolute inset-0 z-0 bg-black/30 gap-2" />
        <TemperedGlassCard className="z-10 w-full max-w-md space-y-6 p-10 text-center">
          <div className="flex flex-col items-center gap-3">
             <img src="/spire.png" alt="spire logo " className="w-8 h-8" />
            <h1 className="text-2xl font-bold  text-white/80">Welcome back!</h1>
            <p className="text-white/50 text-[0.675rem] mb-2 font-light">Please continue with google to start using spire</p>
          </div>
          <GlassButton
            onClick={signInWithGoogle}
            glassVariant="liquid-refract"
            className="w-full rounded-xl py-5 font-semibold text-white hover:bg-white/10 transition duration-300 flex items-center justify-center gap-2"
          >
            Continue with Google
          </GlassButton>
        </TemperedGlassCard>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen w-screen bg-black text-white flex items-center justify-center">
        <div className="text-sm text-white/70">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen text-white font-sans flex flex-col relative overflow-hidden select-none">
      {/* Background Layers */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none z-0"
        style={{ backgroundImage: `url("${prevBg}")` }}
      />
      <div
        className={`absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none z-0 transition-opacity duration-1000 ease-in-out ${
          isFading ? "opacity-0" : "opacity-100"
        }`}
        style={{ backgroundImage: `url("${currentBg}")` }}
      />
      <div className="absolute inset-0 pointer-events-none z-0 bg-black/10 backdrop-blur-[1px]" />

      {/* NEW: Reauth banner — shown when Google Drive token refresh genuinely fails */}
      {needsReauth && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[999] flex items-center gap-2 bg-red-500/90 text-white text-xs sm:text-sm px-4 py-2 rounded-full shadow-lg backdrop-blur-md">
          <span>Your Google session expired.</span>
          <button
            onClick={signInWithGoogle}
            className="underline font-semibold hover:text-white/80 transition-colors"
          >
            Reconnect
          </button>
        </div>
      )}

      {/* Audio Engine */}
      <AudioPlayer
        activeTrack={activeTrack}
        googleAccessToken={googleAccessToken}
        isPlaying={isPlaying}
        volume={volume}
        seekTime={seekTime}
        onTimeUpdate={setCurrentTime}
        onDurationChange={setDuration}
        onEnded={handleTrackEnded}
        onRefreshToken={handleRefreshToken}
      />

      {isExpandedViewOpen ? (
        <ExpandedLyricsView
          activeTrack={activeTrack}
          isPlaying={isPlaying}
          onTogglePlay={handleTogglePlay}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          setVolume={setVolume}
          onSeek={handleSeek}
          onNext={handleNextTrack}
          onPrevious={handlePreviousTrack}
          isShuffle={isShuffle}
          onToggleShuffle={() => setIsShuffle((v) => !v)}
          isRepeat={isRepeat}
          onToggleRepeat={() => setIsRepeat((v) => !v)}
          onClose={() => setIsExpandedViewOpen(false)}
          isLiked={activeTrack?.id ? likedTrackIds.has(activeTrack.id) : false}
          onToggleLike={() => toggleLikeTrack(activeTrack?.id)}
          onNavigateToPlaylists={() => {
            setIsExpandedViewOpen(false);
            navigate("/playlists");
          }}
          playlists={playlists}
          onAddToPlaylist={handleAddToPlaylist}
           onPlayTrack={handlePlayTrack}
           userTracks={userTracks}
         />
      ) : (
        <>
          {/* Floating Left Bar */}
          <FloatingBar />

          <main className="flex-1 min-h-0 h-full overflow-hidden max-w-6xl w-full mx-auto px-6 pl-20 pt-6 pb-2 flex flex-col relative z-10">

            <div className="shrink-0 mb-4 relative z-[100]">
   <GlassSearchBar
     onSelectSong={(selectedTrack) => {
      handlePlayTrack(selectedTrack);
      navigate("/");
    }}
     onSearch={(query) => {
       setSearchQuery(query);
       navigate("/");
     }}
     onThemeToggle={handleThemeToggle}
  />
</div>
            <TemperedGlassCard surfaceClassName="flex flex-col h-full" className="relative z-10 flex min-h-0 w-full flex-1 flex-col overflow-hidden">

              <div className="flex-1 min-h-0 overflow-y-auto p-6 sm:p-8 custom-scrollbar">
                <Routes>
                  <Route
                    path="/"
                    element={
                      <HomeView
                        userTracks={userTracks}
                        searchQuery={searchQuery}
                        isUploading={uploadStep > 0 && uploadStep < 4}
                        onFileUpload={handleFileUpload}
                        onPlayTrack={handlePlayTrack}
                        playlists={playlists}
                        onAddToPlaylist={handleAddToPlaylist}
                      />
                    }
                  />
                  <Route
                    path="/explore"
                    element={
                       <ExploreView
                         userTracks={userTracks}
                         onPlayTrack={handlePlayTrack}
                         currentTrack={activeTrack}
                         continueListening={continueListening}
                         playlists={playlists}
                         onAddToPlaylist={handleAddToPlaylist}
                         listeningHistory={listeningHistory}
                       />
                    }
                  />
                  <Route
                    path="/playlists"
                    element={
                      <PlaylistsView
                        playlists={playlists}
                        userTracks={userTracks}
                        onPlayTrack={handlePlayTrack}
                        onPlaylistPlay={handlePlaylistPlay}
                        onCreatePlaylist={handleCreatePlaylist}
                        onDeletePlaylist={handleDeletePlaylist}
                        onRenamePlaylist={handleRenamePlaylist}
                        onRemoveTrackFromPlaylist={handleRemoveTrackFromPlaylist}
                        onAddToPlaylist={handleAddToPlaylist}
                      />
                    }
                  />

                  <Route
                    path="/settings"
                    element={
                      <SettingsView
                        user={user}
                        isUploading={bgUploading}
                        onBackgroundUpload={handleBackgroundUpload}
                        onSignOut={signOut}
                      />
                    }
                  />
                </Routes>
              </div>
            </TemperedGlassCard>
          </main>

          {/* FIXED FOOTER PLAYER */}
          <footer className="shrink-0 z-40 p-2 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
            <MusicBar
              activeTrack={activeTrack}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              currentTime={currentTime}
              duration={duration}
              volume={volume}
              setVolume={setVolume}
              isShuffle={isShuffle}
              onToggleShuffle={() => setIsShuffle((v) => !v)}
              isRepeat={isRepeat}
              onToggleRepeat={() => setIsRepeat((v) => !v)}
              onSeek={handleSeek}
              onNext={handleNextTrack}
              onPrevious={handlePreviousTrack}
              onOpenExpandedView={() => setIsExpandedViewOpen(true)}
              onNavigateToPlaylists={() => navigate("/playlists")}
              isLiked={activeTrack?.id ? likedTrackIds.has(activeTrack.id) : false}
              onToggleLike={() => toggleLikeTrack(activeTrack?.id)}
              playlists={playlists}
              onAddToPlaylist={handleAddToPlaylist}
            />
          </footer>
        </>
      )}

      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => {
          setIsUploadModalOpen(false);
          setUploadStep(0);
        }}
        file={uploadFile}
        currentStep={uploadStep}
        uploadProgress={uploadProgress}
        errorMessage={uploadError}
      />
    </div>
  );
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState(() => {
    return sessionStorage.getItem("spire_screen") || "opening";
  });

  const handleScreenChange = (screen) => {
    sessionStorage.setItem("spire_screen", screen);
    setCurrentScreen(screen);
  };

  if (currentScreen === "opening") {
    return <Opening onComplete={() => handleScreenChange("landing")} />;
  }

  if (currentScreen === "landing") {
    return <Landing onLaunchSpire={() => handleScreenChange("app")} />;
  }

  return <AppContent />;
}