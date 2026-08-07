import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

// Components & Services
import FloatingBar from "@/components/FloatingBar";
import GlassSearchBar from "@/components/GlassSearchBar";
import AppleMusicBar from "@/components/AppleMusicBar";
import AudioPlayer from "@/components/AudioPlayer";
import UploadModal from "@/components/UploadModal";
import TemperedGlassCard from "@/components/ui/TemperedGlassCard";
import { GlassButton } from "@/components/ui/glasscn/glass-button";

import HomeView from "@/views/HomeView";
import ExploreView from "@/views/ExploreView";
import PlaylistsView from "@/views/PlaylistsView";
import ExpandedLyricsView from "@/views/ExpandedLyricsView";
import SettingsView from "@/views/SettingsView";

import { processAudioUpload, fetchArtworkFromITunes } from "@/services/uploadPipeline";
import { getUserLibrary, getListeningHistoryTrackIds, recordListen } from "@/services/supabaseService";
import { uploadBackgroundToDrive } from "@/services/driveService";

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
  const { user, loading, googleAccessToken, signInWithGoogle, signOut, refreshGoogleToken } = useAuth();
  const navigate = useNavigate();

  // Player state
  const [activeTrack, setActiveTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seekTime, setSeekTime] = useState(null);
  const [volume, setVolume] = useState(70);
  const [likedTrackIds, setLikedTrackIds] = useState(() => new Set());
  const [activePlaylistId, setActivePlaylistId] = useState(null);

   // Played-track history (ordered track ids, most-recent-first) backing
  // "Continue Listening" — sourced from the listening_history table.
  const [playedTrackIds, setPlayedTrackIds] = useState([]);

  // Views state
  const [isExpandedViewOpen, setIsExpandedViewOpen] = useState(false);

  // Global search query (drives HomeView filtering)
  const [searchQuery, setSearchQuery] = useState("");

  // Playlists state synced with localStorage
  const [playlists, setPlaylists] = useState(() => {
    const saved = localStorage.getItem("spire_playlists");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse playlists:", e);
      }
    }
    return [
      {
        id: "1",
        title: "Favorite Songs",
        isFavorite: true,
        isStarIcon: true,
        image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80",
        songIds: [],
      },
      {
        id: "2",
        title: "Work",
        subtitle: " Playlist",
        isFolder: true,
        covers: ["https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=200&auto=format&fit=crop&q=80"],
        songIds: [],
      },
      {
        id: "3",
        title: "Kids stuff",
        image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
        songIds: [],
      },
      {
        id: "4",
        title: "Olivia's Best",
        image: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&auto=format&fit=crop&q=80",
        songIds: [],
      },
      {
        id: "5",
        title: "The Best for Work",
        image: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=400&auto=format&fit=crop&q=80",
        songIds: [],
      },
      {
        id: "6",
        title: "Pop Chill",
        image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=80",
        songIds: [],
      },
    ];
  });

  useEffect(() => {
    localStorage.setItem("spire_playlists", JSON.stringify(playlists));
  }, [playlists]);

  useEffect(() => {
    const favoritePlaylist = playlists.find((pl) => pl.id === "1");
    if (favoritePlaylist) {
      setLikedTrackIds(new Set(favoritePlaylist.songIds || []));
    }
  }, [playlists]);

  // Library & History state
  const [userTracks, setUserTracks] = useState([]);

  // "Continue Listening": only tracks that have actually been played,
  // matched against the loaded library so each card carries full metadata.
  const continueListening = useMemo(
    () =>
      playedTrackIds
        .map((id) => userTracks.find((t) => t.id === id))
        .filter(Boolean),
    [userTracks, playedTrackIds]
  );

  // Upload modal state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadStep, setUploadStep] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");

  // Wallpaper state initialized from user metadata
  const customBgDriveId = user?.user_metadata?.bg_drive_id;
  const initialIsPreset = user?.user_metadata?.is_using_preset ?? !customBgDriveId;
  const initialPresetIdx = user?.user_metadata?.wallpaper_index ?? 0;

  const [wallpaperIndex, setWallpaperIndex] = useState(initialPresetIdx);
  const [isUsingPreset, setIsUsingPreset] = useState(initialIsPreset);
  const [bgUploading, setBgUploading] = useState(false);
  const [localBgUrl, setLocalBgUrl] = useState(null);

  // Compute active target background URL
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

  // Layers for Cross-Fade setup
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
  }, [user]);

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
  }, [targetBgUrl]);

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
      setPlayedTrackIds(await getListeningHistoryTrackIds(user.id, 8));
    } catch (err) {
      console.error("Failed to load continue listening:", err);
    }
  }, [user?.id]);

  useEffect(() => {
    const load = async () => {
      await loadLibrary();
      await loadContinueListening();
    };
    load();
  }, [loadLibrary, loadContinueListening]);

  const handlePlayTrack = useCallback((track, playlistId = null) => {
    setActiveTrack({
      id: track.id,
      title: track.title,
      artist: track.artist,
      cover: track.cover || track.artworkUrl,
      artworkUrl: track.artworkUrl || track.cover,
      synced_lyrics: track.synced_lyrics || track.syncedLyrics || "",
      driveFileId: track.drive_file_id || track.driveFileId,
    });
    setActivePlaylistId(playlistId);
    setPlayedTrackIds((prev) => {
      const filtered = prev.filter((id) => id !== track.id);
      return [track.id, ...filtered].slice(0, 8);
    });
    recordListen(track.id, track.primary_genre || null);
    setCurrentTime(0);
    setSeekTime(0);
    setIsPlaying(true);
  }, []);

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
    const nextIdx = idx >= 0 ? (idx + 1) % userTracks.length : 0;
    handlePlayTrack(userTracks[nextIdx]);
  }, [activeTrack, userTracks, handlePlayTrack]);

  const handlePreviousTrack = useCallback(() => {
    if (!activeTrack || userTracks.length === 0) return;
    const idx = userTracks.findIndex((t) => t.id === activeTrack.id);
    const prevIdx = idx >= 0 ? (idx - 1 + userTracks.length) % userTracks.length : 0;
    handlePlayTrack(userTracks[prevIdx]);
  }, [activeTrack, userTracks, handlePlayTrack]);

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

  const handleAddToPlaylist = useCallback((playlistId, trackId) => {
    if (!trackId) return;
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id === playlistId) {
          const songIds = pl.songIds || [];
          if (songIds.includes(trackId)) {
            alert(`Song is already in playlist "${pl.title}"`);
            return pl;
          }
          return { ...pl, songIds: [...songIds, trackId] };
        }
        return pl;
      })
    );
  }, []);

  const toggleLikeTrack = useCallback((trackId) => {
    if (!trackId) return;
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id === "1") {
          const songIds = pl.songIds || [];
          const nextIds = songIds.includes(trackId)
            ? songIds.filter((id) => id !== trackId)
            : [...songIds, trackId];
          return { ...pl, songIds: nextIds };
        }
        return pl;
      })
    );
  }, []);

  if (!user && !loading) {
    return (
      <div
        className="h-screen w-screen bg-cover bg-center bg-no-repeat text-white flex flex-col items-center justify-center p-4 relative"
        style={{ backgroundImage: `url("${DEFAULT_BG_IMAGE}")` }}
      >
        <div className="absolute inset-0 z-0 bg-black/30" />
        <TemperedGlassCard className="z-10 w-full max-w-md space-y-6 p-8 text-center">
          <GlassButton
            onClick={signInWithGoogle}
            glassVariant="liquid-refract"
            className="w-full rounded-xl py-3 font-semibold text-white hover:text-black"
          >
            Sign in with Google
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

      {/* Audio Engine */}
      <AudioPlayer
        activeTrack={activeTrack}
        googleAccessToken={googleAccessToken}
        isPlaying={isPlaying}
        volume={volume}
        seekTime={seekTime}
        onTimeUpdate={setCurrentTime}
        onDurationChange={setDuration}
        onEnded={() => setIsPlaying(false)}
        onRefreshToken={refreshGoogleToken}
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
          <div className="fixed left-35 top-1/2 -translate-y-1/2 z-50">
            <FloatingBar />
          </div>

          <main className="flex-1 min-h-0 max-w-6xl w-full mx-auto px-6 pl-24 pt-6 pb-2 flex flex-col relative z-10">
            
            {/* FIXED SEARCH BAR Z-INDEX FIX: z-[100] and relative ensure dropdown is on top */}
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
            {/* CARD CONTAINER: Explicitly kept z-10 so it stays beneath the search bar */}
            <TemperedGlassCard className="relative z-10 flex min-h-0 w-full flex-1 flex-col overflow-hidden">
              
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
                       />
                    }
                  />
                  <Route
                    path="/playlists"
                    element={
                      <PlaylistsView
                        playlists={playlists}
                        setPlaylists={setPlaylists}
                        userTracks={userTracks}
                        onPlayTrack={handlePlayTrack}
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
            <AppleMusicBar
              activeTrack={activeTrack}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              currentTime={currentTime}
              duration={duration}
              volume={volume}
              setVolume={setVolume}
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
  return <AppContent />;
}