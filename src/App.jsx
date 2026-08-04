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

import HomeView from "@/views/HomeView";
import ExploreView from "@/views/ExploreView";
import PlaylistsView from "@/views/PlaylistsView";
import AnalyticsView from "@/views/AnalyticsView";
import ExpandedLyricsView from "@/views/ExpandedLyricsView";
import SettingsView from "@/views/SettingsView";

import { processAudioUpload, fetchArtworkFromITunes } from "@/services/uploadPipeline";
import { getUserLibrary } from "@/services/supabaseService";
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
  const { user, googleAccessToken, signInWithGoogle, signOut } = useAuth();
  const navigate = useNavigate();

  // Player state
  const [activeTrack, setActiveTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(70);
  const [parsedLyrics, setParsedLyrics] = useState([]);
  const [activeLyricIdx, setActiveLyricIdx] = useState(-1);
  const [likedTrackIds, setLikedTrackIds] = useState(() => new Set());

  // Views state
  const [isExpandedViewOpen, setIsExpandedViewOpen] = useState(false);

  // Library & History state
  const [userTracks, setUserTracks] = useState([]);
  const [listeningHistory, setListeningHistory] = useState([]);

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
          id: rec.id,
          drive_file_id: rec.drive_file_id || rec.driveFileId,
          title,
          artist,
          cover: coverUrl,
          artworkUrl: coverUrl,
          synced_lyrics: lyricsObj.synced_lyrics || lyricsObj.syncedLyrics || "",
          duration: trackObj.duration_seconds || 0,
        };
      });

      const formatted = await Promise.all(formattedPromises);
      setUserTracks(formatted);
    } catch (err) {
      console.error("Failed to load library:", err);
    }
  }, [user?.id]);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  const handlePlayTrack = useCallback((track) => {
    setActiveTrack({
      id: track.id,
      title: track.title,
      artist: track.artist,
      cover: track.cover || track.artworkUrl,
      artworkUrl: track.artworkUrl || track.cover,
      synced_lyrics: track.synced_lyrics || track.syncedLyrics || "",
      driveFileId: track.drive_file_id || track.driveFileId,
    });
    setIsPlaying(true);
    setListeningHistory((prev) => [
      { title: track.title, artist: track.artist, played_at: new Date().toISOString() },
      ...prev,
    ]);
  }, []);

  const handleFileUpload = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!googleAccessToken) {
        alert("Please login with Google first.");
        return;
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
    [googleAccessToken, user, loadLibrary]
  );

  const toggleLikeTrack = useCallback((trackId) => {
    if (!trackId) return;
    setLikedTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  }, []);

  if (!user) {
    return (
      <div
        className="h-screen w-screen bg-cover bg-center bg-no-repeat text-white flex flex-col items-center justify-center p-4 relative"
        style={{ backgroundImage: `url("${DEFAULT_BG_IMAGE}")` }}
      >
        <div className="absolute inset-0 z-0 bg-black/30" />
        <TemperedGlassCard className="p-8 max-w-md w-full text-center space-y-6 z-10 border border-white/20 bg-white/10 backdrop-blur-xl">
          <button
            onClick={signInWithGoogle}
            className="w-full bg-white/10 hover:bg-white text-white hover:text-black border border-white/20 font-semibold py-3 px-4 rounded-xl transition-all cursor-pointer shadow-lg"
          >
            Sign in with Google
          </button>
        </TemperedGlassCard>
      </div>
    );
  }

  return (
    /* 1. ROOT APP CONTAINER: Fixed viewport (h-screen, overflow-hidden) */
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
      <div className="absolute inset-0 pointer-events-none z-0 backdrop-blur-[1px]" />

      {/* Audio Engine */}
      <AudioPlayer
        activeTrack={activeTrack}
        googleAccessToken={googleAccessToken}
        isPlaying={isPlaying}
        volume={volume}
        currentTime={currentTime}
        onTimeUpdate={setCurrentTime}
        onDurationChange={setDuration}
        onEnded={() => setIsPlaying(false)}
        onLyricsParsed={setParsedLyrics}
        onActiveLyricChange={setActiveLyricIdx}
      />

      {isExpandedViewOpen ? (
        <ExpandedLyricsView
          activeTrack={activeTrack}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          currentTime={currentTime}
          duration={duration}
          onSeek={setCurrentTime}
          onClose={() => setIsExpandedViewOpen(false)}
        />
      ) : (
        <>
          {/* Floating Left Bar */}
          <div className="fixed left-4 top-1/2 -translate-y-1/2 z-50">
            <FloatingBar />
          </div>

          {/* 2. MIDDLE AREA: Takes remaining vertical height using flex-1 min-h-0 */}
          <main className="flex-1 min-h-0 max-w-6xl w-full mx-auto px-6 pl-24 pt-6 pb-2 flex flex-col relative z-10">
            
            {/* FIXED SEARCH BAR: shrink-0 keeps it fixed at top */}
            <div className="shrink-0 mb-4">
              <GlassSearchBar
                onSearch={(q) => navigate(`/explore?q=${encodeURIComponent(q)}`)}
                onThemeToggle={handleThemeToggle}
              />
            </div>

            {/* 3. CARD CONTAINER: flex-1 min-h-0 prevents outer page expansion */}
           <TemperedGlassCard className="flex-1 min-h-0 w-full border border-white/20 bg-white/10 backdrop-blur-xl flex flex-col overflow-hidden">
  
  {/* ONLY THIS INNER CONTAINER SCROLLS */}
  <div className="flex-1 min-h-0 overflow-y-auto p-6 sm:p-8 custom-scrollbar">
    <Routes>
      <Route
        path="/"
        element={
          <HomeView
            userTracks={userTracks}
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
                        uploadedTracks={userTracks}
                        onSelectTrack={handlePlayTrack}
                        currentTrack={activeTrack}
                      />
                    }
                  />
                  <Route
                    path="/playlists"
                    element={<PlaylistsView trackCount={likedTrackIds.size} />}
                  />
                  <Route
                    path="/analytics"
                    element={<AnalyticsView listeningHistory={listeningHistory} />}
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

          {/* 5. FIXED FOOTER PLAYER: shrink-0 keeps player pinned to bottom */}
          <footer className="shrink-0 z-40 p-2 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
            <AppleMusicBar
              activeTrack={activeTrack}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              currentTime={currentTime}
              duration={duration}
              volume={volume}
              setVolume={setVolume}
              onSeek={setCurrentTime}
              onOpenExpandedView={() => setIsExpandedViewOpen(true)}
              isLiked={activeTrack?.id ? likedTrackIds.has(activeTrack.id) : false}
              onToggleLike={() => toggleLikeTrack(activeTrack?.id)}
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