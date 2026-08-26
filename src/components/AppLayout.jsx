import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLibrary } from "@/context/LibraryContext";
import { usePlayer } from "@/context/PlayerContext";

import FloatingBar from "@/components/FloatingBar";
import MobileNav from "@/components/MobileNav";
import BackgroundManager from "@/components/BackgroundManager";
import GlassSearchBar from "@/components/GlassSearchBar";
import MusicBar from "@/components/MusicBar";
import UploadModal from "@/components/UploadModal";
import DuplicateFileDialog from "@/components/DuplicateFileDialog";
import QuotaAlertDialog from "@/components/QuotaAlertDialog";
import TemperedGlassCard from "@/components/ui/TemperedGlassCard";
import ExpandedLyricsView from "@/views/ExpandedLyricsView";
import AppRoutes from "@/routes/AppRoutes";

import { processAudioUpload } from "@/services/uploadPipeline";
import { deleteUserTrack } from "@/services/supabaseService";
import { uploadBackgroundToDrive, DriveQuotaError } from "@/services/driveService";
import { getValidDriveToken } from "@/utils/driveApi";
import { connectDiscord, setDiscordActivity, getDiscordUser } from "@/services/discordService";
import { useListenTogether } from "@/hooks/useListenTogether";
import { supabase } from "@/lib/supabaseClient";
import { isVideoUrl } from "@/utils/imageUtils";


const upgradeImageUrl = (url) => {
  if (!url || typeof url !== "string" || isVideoUrl(url)) return url;
  if (url.includes("images.unsplash.com")) {
    const baseUrl = url.split("?")[0];
    return `${baseUrl}?auto=format&fit=crop&w=2560&q=80`;
  }
  return url;
};


const VIDEO_WALLPAPERS = [

  "https://videos.pexels.com/video-files/9714261/9714261-uhd_3840_2160_30fps.mp4",
  "https://videos.pexels.com/video-files/11466213/11466213-uhd_3840_2160_25fps.mp4",
  "https://videos.pexels.com/video-files/18209572/18209572-uhd_4096_2160_30fps.mp4",
  "https://videos.pexels.com/video-files/36331531/15409190_4096_2160_30fps.mp4",
  "https://videos.pexels.com/video-files/11025493/11025493-hd_4096_2160_30fps.mp4",
  "https://videos.pexels.com/video-files/29171868/12597611_3838_2160_30fps.mp4",
  "https://videos.pexels.com/video-files/33059720/14091021_3834_2160_60fps.mp4",
  "https://videos.pexels.com/video-files/33059725/14090999_3834_2160_60fps.mp4",
  "https://videos.pexels.com/video-files/27216120/12096541_3840_2160_25fps.mp4",
  "https://videos.pexels.com/video-files/30716781/13141577_3840_2160_30fps.mp4",
  "https://videos.pexels.com/video-files/37619869/15945550_3840_2160_30fps.mp4",
  "https://videos.pexels.com/video-files/37122823/15726613_3840_2160_25fps.mp4",
  "https://videos.pexels.com/video-files/37399013/15839507_3840_2160_25fps.mp4",
  "https://videos.pexels.com/video-files/37393250/15837062_3840_2160_25fps.mp4",
  "https://videos.pexels.com/video-files/10994283/10994283-hd_3840_2160_25fps.mp4",
  "https://videos.pexels.com/video-files/7997370/7997370-uhd_3840_2160_30fps.mp4",
  "https://videos.pexels.com/video-files/39158845/16663781_3840_2160_25fps.mp4",
  "https://videos.pexels.com/video-files/11986207/11986207-uhd_3840_2160_30fps.mp4",
  "https://videos.pexels.com/video-files/34135318/14473578_3840_2160_30fps.mp4",
  "https://videos.pexels.com/video-files/8822944/8822944-hd_3840_2160_30fps.mp4",


  "https://videos.pexels.com/video-files/34857315/14772713_1920_1080_60fps.mp4",
  "https://videos.pexels.com/video-files/17848790/17848790-hd_1920_1080_30fps.mp4",
  "https://videos.pexels.com/video-files/16469505/16469505-hd_1920_1080_30fps.mp4",
  "https://videos.pexels.com/video-files/35966359/15248494_1920_1080_60fps.mp4",
  "https://videos.pexels.com/video-files/7421702/7421702-hd_1920_1080_25fps.mp4",
  "https://videos.pexels.com/video-files/7710027/7710027-hd_1920_1080_25fps.mp4",
  "https://videos.pexels.com/video-files/6235582/6235582-hd_1920_1080_25fps.mp4",
  "https://videos.pexels.com/video-files/5878222/5878222-hd_1920_1080_30fps.mp4",
  "https://videos.pexels.com/video-files/29633667/12750705_1920_1080_25fps.mp4",
  "https://videos.pexels.com/video-files/30139793/12924553_1920_1080_30fps.mp4",
  "https://videos.pexels.com/video-files/11265968/11265968-hd_1920_1080_25fps.mp4",
  "https://videos.pexels.com/video-files/5121476/5121476-hd_1920_1080_24fps.mp4",
  "https://videos.pexels.com/video-files/38982824/16584897_1920_1080_60fps.mp4",
  "https://videos.pexels.com/video-files/10800300/10800300-hd_1920_1080_30fps.mp4",
  "https://videos.pexels.com/video-files/33924272/14396264_1920_1080_60fps.mp4",
  "https://videos.pexels.com/video-files/1674470/1674470-hd_1920_1080_24fps.mp4",
];


const WALLPAPERS = [
  ...VIDEO_WALLPAPERS,
  upgradeImageUrl("https://images.unsplash.com/photo-1786748012490-1fdddb1b52dd"),
  upgradeImageUrl("https://images.unsplash.com/photo-1734817427263-1e94e7f24288"),
  upgradeImageUrl("https://images.unsplash.com/photo-1781674520637-37c566ff7bc7"),
  upgradeImageUrl("https://images.unsplash.com/photo-1533502760863-a249ef3aaf30"),
  upgradeImageUrl("https://images.unsplash.com/photo-1544200502-6652e105f865"),
  upgradeImageUrl("https://images.unsplash.com/photo-1451187580459-43490279c0fa"),
  upgradeImageUrl("https://images.unsplash.com/photo-1517052269751-4ae3ad86cc59"),
  upgradeImageUrl("https://images.unsplash.com/photo-1780552274859-b3a1e6effd50"),
  upgradeImageUrl("https://images.unsplash.com/photo-1778303814569-3cb046f8c7c5"),
  upgradeImageUrl("https://images.unsplash.com/photo-1510256506868-484d0db06ee2"),
  upgradeImageUrl("https://images.unsplash.com/photo-1530236209717-4534816b9f6d"),
  upgradeImageUrl("https://images.unsplash.com/photo-1517239320384-e08ad2c24a3e"),
  upgradeImageUrl("https://images.unsplash.com/photo-1764968351717-dc8edf2cd628"),
  upgradeImageUrl("https://images.unsplash.com/photo-1720273238003-079301a7e9b1"),
  upgradeImageUrl("https://images.unsplash.com/photo-1568577108208-96e17a956a29"),
  upgradeImageUrl("https://images.unsplash.com/photo-1501854140801-50d01698950b"),
  upgradeImageUrl("https://images.unsplash.com/photo-1785679339355-36cd3f065f7b"),
  upgradeImageUrl("https://images.unsplash.com/photo-1785344468724-9f06e2534056"),
  upgradeImageUrl("https://images.unsplash.com/photo-1764140608148-80e010804af8"),
  upgradeImageUrl("https://images.unsplash.com/photo-1780715017688-a50312a5a249"),
  upgradeImageUrl("https://images.unsplash.com/photo-1777712081090-d335e662dce6"),
  upgradeImageUrl("https://images.unsplash.com/photo-1782848796142-88a50598df91"),
  upgradeImageUrl("https://images.unsplash.com/photo-1777978206855-cbc9508b4f6d"),
  upgradeImageUrl("https://images.unsplash.com/photo-1785199879496-23409f65d45c"),
  upgradeImageUrl("https://images.unsplash.com/photo-1781817388497-bd831004913b"),
  upgradeImageUrl("https://images.unsplash.com/photo-1784704564341-d09f0023d30f"),
  upgradeImageUrl("https://images.unsplash.com/photo-1777849077481-a6a18ecc4552"),
];


const BG_MEDIA_TYPES = new Set(["all", "video", "image"]);


export default function AppLayout() {
  const { user, signInWithGoogle, signOut } = useAuth();
  const {
    userTracks,
    setUserTracks,
    playlists,
    likedTrackIds,
    toggleLikeTrack,
    handleAddToPlaylist,
  } = useLibrary();
  const {
    activeTrack,
    isPlaying,
    duration,
    volume,
    setVolume,
    isShuffle,
    setIsShuffle,
    isRepeat,
    setIsRepeat,
    isRadioMode,
    radioStation,
    setRadioStation,
    needsReauth,
    currentTimeRef,
    playbackRef,
    handlePlayTrack,
    handleSeek,
    handleTogglePlay,
    handleNextTrack,
    handlePreviousTrack,
    handleToggleRadio,
    handleSelectRadioStation,
    handleListenRemote,
    getActiveQueue,
    spatialAudio,
  } = usePlayer();
  const navigate = useNavigate();


  const [quotaAlert, setQuotaAlert] = useState(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [uploadFileIndex, setUploadFileIndex] = useState(0);
  const [uploadStep, setUploadStep] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [duplicateDialog, setDuplicateDialog] = useState(null);

  const MAX_UPLOAD_FILES = 10;


  const customBgDriveId = user?.user_metadata?.bg_drive_id;
  const initialIsPreset = user?.user_metadata?.is_using_preset ?? !customBgDriveId;
  const initialPresetIdx = user?.user_metadata?.wallpaper_index ?? 0;

  const [wallpaperIndex, setWallpaperIndex] = useState(initialPresetIdx);
  const [isUsingPreset, setIsUsingPreset] = useState(initialIsPreset);
  const [bgUploading, setBgUploading] = useState(false);
  const [localBgUrl, setLocalBgUrl] = useState(null);


  const initialMediaType = BG_MEDIA_TYPES.has(user?.user_metadata?.bg_media_type)
    ? user.user_metadata.bg_media_type
    : "all";
  const [bgMediaType, setBgMediaType] = useState(initialMediaType);


  const eligibleWallpaperIndices = useMemo(() => {
    const videoCount = VIDEO_WALLPAPERS.length;
    if (bgMediaType === "video") {
      return [...Array(videoCount).keys()];
    }
    if (bgMediaType === "image") {
      return [...Array(WALLPAPERS.length - videoCount).keys()].map(
        (i) => i + videoCount
      );
    }
    return [...Array(WALLPAPERS.length).keys()];
  }, [bgMediaType]);


  const nextWallpaperUrl = useMemo(() => {
    const eligible = eligibleWallpaperIndices;
    if (!eligible.length) return null;
    const pos = eligible.indexOf(wallpaperIndex);
    const nextIdx =
      pos === -1 ? eligible[0] : eligible[(pos + 1) % eligible.length];
    return WALLPAPERS[nextIdx] ?? null;
  }, [wallpaperIndex, eligibleWallpaperIndices]);

  const targetBgUrl = useMemo(() => {

    let selectedUrl = WALLPAPERS[0];
    if (localBgUrl) {
      selectedUrl = localBgUrl;
    } else if (isUsingPreset) {
      selectedUrl = WALLPAPERS[wallpaperIndex] || WALLPAPERS[0];
    } else if (customBgDriveId) {
      selectedUrl = `https://drive.google.com/thumbnail?id=${customBgDriveId}&sz=w2560`;
    } else {
      selectedUrl = WALLPAPERS[wallpaperIndex] || WALLPAPERS[0];
    }

    return upgradeImageUrl(selectedUrl);
  }, [isUsingPreset, wallpaperIndex, localBgUrl, customBgDriveId]);

  useEffect(() => {
    if (user?.user_metadata) {
      const metaIsPreset = user.user_metadata.is_using_preset ?? !user.user_metadata.bg_drive_id;
      const metaIdx = user.user_metadata.wallpaper_index ?? 0;

      setIsUsingPreset(metaIsPreset);
      setWallpaperIndex(metaIdx);
      if (BG_MEDIA_TYPES.has(user.user_metadata.bg_media_type)) {
        setBgMediaType(user.user_metadata.bg_media_type);
      }
    }
  }, [user?.user_metadata?.is_using_preset, user?.user_metadata?.bg_drive_id, user?.user_metadata?.wallpaper_index, user?.user_metadata?.bg_media_type]);


  const handleThemeToggle = useCallback(() => {
    const eligible = eligibleWallpaperIndices;
    if (!eligible.length) return;
    const pos = eligible.indexOf(wallpaperIndex);
    const nextIndex =
      pos === -1 ? eligible[0] : eligible[(pos + 1) % eligible.length];
    setLocalBgUrl(null);
    setIsUsingPreset(true);
    setWallpaperIndex(nextIndex);

    supabase.auth
      .updateUser({
        data: {
          is_using_preset: true,
          wallpaper_index: nextIndex,
        },
      })
      .then(() => supabase.auth.refreshSession())
      .catch((err) => console.error("Failed to persist preset wallpaper:", err));
  }, [wallpaperIndex, eligibleWallpaperIndices]);


  const handleChangeBgMediaType = useCallback(
    (type) => {
      if (type === bgMediaType) return;
      const videoCount = VIDEO_WALLPAPERS.length;
      const targetIndex =
        type === "video" ? 0 : type === "image" ? videoCount : wallpaperIndex;

      setBgMediaType(type);
      setLocalBgUrl(null);
      setIsUsingPreset(true);
      setWallpaperIndex(targetIndex);

      supabase.auth
        .updateUser({
          data: {
            bg_media_type: type,
            is_using_preset: true,
            wallpaper_index: targetIndex,
          },
        })
        .then(() => supabase.auth.refreshSession())
        .catch((err) =>
          console.error("Failed to persist background media type:", err)
        );
    },
    [bgMediaType, wallpaperIndex]
  );

  const handleBackgroundUpload = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const driveToken = await getValidDriveToken();
      if (!driveToken) {
        alert("Google Drive access unavailable. Please sign out and log back in.");
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      setLocalBgUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return previewUrl;
      });
      setIsUsingPreset(false);

      try {
        setBgUploading(true);
        const driveFileId = await uploadBackgroundToDrive(
          file,
          driveToken,
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
        if (err instanceof DriveQuotaError) {
          setQuotaAlert({ title: "Google Drive storage is full", message: err.message });
          return;
        }
        alert(`Failed to save background: ${err.message || err}`);
      } finally {
        setBgUploading(false);
      }
    },
    [customBgDriveId]
  );


  const handleFileUpload = useCallback(
    async (e) => {
      let files = Array.from(e.target.files || []).slice(0, MAX_UPLOAD_FILES);
      if (!files.length) return;
      e.target.value = "";

      const driveToken = await getValidDriveToken();
      if (!driveToken) {
        alert("Google Drive access unavailable. Please login with Google first.");
        return;
      }

      const duplicates = files.filter((f) =>
        userTracks.some((t) => t.uploaded_filename === f.name)
      );
      let replaceNames = null;
      if (duplicates.length) {
        const choice = await new Promise((resolve) => {
          setDuplicateDialog({ duplicates: duplicates.map((f) => f.name), resolve });
        });
        if (choice === "skip") {
          files = files.filter((f) => !duplicates.includes(f));
          if (!files.length) return;
        } else if (choice === "cancel") {
          return;
        } else if (choice === "replace") {


          files = files.filter((f) => duplicates.includes(f));
          replaceNames = new Set(duplicates.map((f) => f.name));
        }
      }

      const replacedEntries = replaceNames
        ? userTracks.filter((t) => replaceNames.has(t.uploaded_filename))
        : [];

      const queue = files.map((file) => ({
        file,
        name: file.name,
        size: file.size,
        status: "queued",
        percent: 0,
        error: "",
      }));

      setUploadQueue(queue);
      setUploadFileIndex(0);
      setIsUploadModalOpen(true);
      setUploadError("");

      for (let i = 0; i < queue.length; i++) {
        const entry = queue[i];
        setUploadFileIndex(i);
        setUploadStep(1);
        setUploadProgress(0);

        try {
          const result = await processAudioUpload(entry.file, user, driveToken, (progress) => {
            setUploadStep(progress.step);
            setUploadProgress(progress.percent);
            setUploadQueue((q) =>
              q.map((it, idx) =>
                idx === i ? { ...it, status: "processing", percent: progress.percent } : it
              )
            );
          });

          const coverUrl = result.track?.artworkUrl || null;
          const newTrack = {
            id: result.userTrackRecord?.track_id || result.track?.title,
            user_track_id: result.userTrackRecord?.id,
            drive_file_id: result.driveFileId,
            uploaded_filename: entry.file.name,
            uploadedAt: result.userTrackRecord?.created_at || new Date().toISOString(),
            title: result.track?.title || entry.file.name,
            artist: result.track?.artist || "Unknown Artist",
            genre: result.track?.primaryGenre || "Unknown",
            cover: coverUrl,
            artworkUrl: coverUrl,
            synced_lyrics: result.lyrics?.syncedLyrics || "",
            duration: result.track?.durationSeconds || 0,
          };
          const stale = replacedEntries.filter(
            (o) => o.uploaded_filename === entry.file.name
          );
          if (stale.length) {


            setUserTracks((prev) =>
              prev.filter((t) => !stale.some((s) => s.id === t.id))
            );
            for (const s of stale) {
              if (s.user_track_id) {
                deleteUserTrack(s.user_track_id).catch((delErr) =>
                  console.error("Failed to remove replaced entry:", delErr)
                );
              }
            }
          }
          setUserTracks((prev) =>
            prev.some((t) => t.id === newTrack.id) ? prev : [...prev, newTrack]
          );
          setUploadQueue((q) =>
            q.map((it, idx) => (idx === i ? { ...it, status: "done", percent: 100 } : it))
          );
        } catch (err) {
          console.error("Upload error:", err);
          if (err instanceof DriveQuotaError) {
            setQuotaAlert({ title: "Google Drive storage is full", message: err.message });
            setUploadStep(3);
            setUploadQueue((q) =>
              q.map((it, idx) =>
                idx === i ? { ...it, status: "error", error: err.message } : it
              )
            );
            break;
          }
          const message = err.message || "Upload failed";
          setUploadError(message);
          setUploadQueue((q) =>
            q.map((it, idx) => (idx === i ? { ...it, status: "error", error: message } : it))
          );
        }
      }
    },
    [user, userTracks, setUserTracks]
  );


  const [searchQuery, setSearchQuery] = useState("");
  const [isExpandedViewOpen, setIsExpandedViewOpen] = useState(false);
  const [startInLyrics, setStartInLyrics] = useState(false);

  useEffect(() => {
    if (!activeTrack && isExpandedViewOpen) {
      setIsExpandedViewOpen(false);
    }
  }, [activeTrack, isExpandedViewOpen]);


  useEffect(() => {
    const onKeyDown = (e) => {
      const el = e.target;
      const tag = el && el.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (el && el.isContentEditable)
      ) {
        return;
      }
      if (
        el &&
        el.closest &&
        el.closest('[role="menu"],[role="dialog"],[role="listbox"],[role="slider"],[role="option"],[data-radix-popper-content-wrapper]')
      ) {
        return;
      }

      switch (e.key) {
        case "Tab":
          if (e.repeat) break;
          e.preventDefault();
          handleTogglePlay();
          break;
        case "k":
        case "K":
          e.preventDefault();
          handleTogglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          handleSeek(Math.max(0, Math.min(duration, currentTimeRef.current - 10)));
          break;
        case "ArrowRight":
          e.preventDefault();
          handleSeek(Math.max(0, Math.min(duration, currentTimeRef.current + 10)));
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
  }, [duration, handleTogglePlay, handleSeek, setVolume, currentTimeRef]);


  const listenTogether = useListenTogether({
    name:
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.email?.split("@")[0] ||
      "Guest",
    playback: {
      track: activeTrack,
      isPlaying,
      currentTime: currentTimeRef.current,
    },
    onRemoteState: handleListenRemote,
    timeRef: currentTimeRef,
  });

  const [discordUser, setDiscordUser] = useState(getDiscordUser());
  const [isDiscordConnecting, setIsDiscordConnecting] = useState(false);
  const [discordError, setDiscordError] = useState("");

  const handleConnectDiscord = useCallback(async () => {
    setIsDiscordConnecting(true);
    setDiscordError("");
    try {
      const me = await connectDiscord();
      setDiscordUser(me);
    } catch (err) {
      console.error("Discord connect failed:", err);
      setDiscordError(
        err?.code === "NOT_IN_DISCORD"
          ? "Run Spire inside Discord (Activities) to connect. Listen Together rooms still sync playback across users."
          : `Couldn't reach Discord: ${err?.message || "unknown error"}`
      );
    } finally {
      setIsDiscordConnecting(false);
    }
  }, []);

  useEffect(() => {
    if (!discordUser) return;
    const { track, isPlaying: playing } = playbackRef.current;
    setDiscordActivity(track, playing, currentTimeRef.current);
  }, [discordUser, activeTrack?.id, isPlaying, playbackRef, currentTimeRef]);


  const isLiked = activeTrack?.id ? likedTrackIds.has(activeTrack.id) : false;
  const playbackQueue = useMemo(() => getActiveQueue(), [getActiveQueue]);

  return (
    <div className="h-screen w-screen text-white font-sans flex flex-col relative overflow-hidden select-none">

      <BackgroundManager targetBgUrl={targetBgUrl} preloadUrl={nextWallpaperUrl} />


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

      {isExpandedViewOpen ? (
        <ExpandedLyricsView
          activeTrack={activeTrack}
          isPlaying={isPlaying}
          onTogglePlay={handleTogglePlay}
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
          isRadioMode={isRadioMode}
          radioStation={radioStation}
          onSelectRadioStation={setRadioStation}
          onToggleRadio={handleToggleRadio}
          onClose={() => setIsExpandedViewOpen(false)}
          initialLyrics={startInLyrics}
          isLiked={isLiked}
          onToggleLike={() => toggleLikeTrack(activeTrack?.id)}
          playlists={playlists}
          onAddToPlaylist={handleAddToPlaylist}
          onPlayTrack={handlePlayTrack}
          playbackQueue={playbackQueue}
        />
      ) : (
        <>

          <FloatingBar />

          <main className="flex-1 min-h-0 h-full overflow-hidden max-w-6xl w-full mx-auto px-6 pl-0 md:pl-20 pt-6 pb-2 flex flex-col relative z-10">
            <div className="shrink-0 mb-4 relative z-[100]">
              <GlassSearchBar
                onSearch={(query) => {
                  setSearchQuery(query);
                  navigate("/");
                }}
                onThemeToggle={handleThemeToggle}
              />
            </div>
            <TemperedGlassCard surfaceClassName="flex flex-col h-full" className="relative z-10 flex min-h-0 w-full flex-1 flex-col overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto p-6 sm:p-8 custom-scrollbar flex flex-col">
                <AppRoutes
                  searchQuery={searchQuery}
                  isUploading={uploadStep > 0 && uploadStep < 4}
                  onFileUpload={handleFileUpload}
                  isBgUploading={bgUploading}
                  onBackgroundUpload={handleBackgroundUpload}
                  bgMediaType={bgMediaType}
                  onChangeBgMediaType={handleChangeBgMediaType}
                  onSignOut={signOut}
                  listen={listenTogether}
                  discordUser={discordUser}
                  isDiscordConnecting={isDiscordConnecting}
                  discordError={discordError}
                  onConnectDiscord={handleConnectDiscord}
                />
              </div>
            </TemperedGlassCard>
          </main>


          <footer className="shrink-0 z-40 p-2">
            <MobileNav />
            <MusicBar
              activeTrack={activeTrack}
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              duration={duration}
              volume={volume}
              setVolume={setVolume}
              isShuffle={isShuffle}
              onToggleShuffle={() => setIsShuffle((v) => !v)}
              isRepeat={isRepeat}
              onToggleRepeat={() => setIsRepeat((v) => !v)}
              isRadioMode={isRadioMode}
              radioStation={radioStation}
              onSelectRadioStation={setRadioStation}
              onStationChange={handleSelectRadioStation}
              onToggleRadio={handleToggleRadio}
              onSeek={handleSeek}
              onNext={handleNextTrack}
              onPrevious={handlePreviousTrack}
              onOpenExpandedView={() => {
                if (!activeTrack) return;
                setStartInLyrics(false);
                setIsExpandedViewOpen(true);
              }}
              onOpenLyrics={() => {
                if (!activeTrack) return;
                setStartInLyrics(true);
                setIsExpandedViewOpen(true);
              }}
              isLiked={isLiked}
              onToggleLike={() => toggleLikeTrack(activeTrack?.id)}
              playlists={playlists}
              onAddToPlaylist={handleAddToPlaylist}
              spatialAudio={spatialAudio}
            />
          </footer>
        </>
      )}

      <QuotaAlertDialog
        open={!!quotaAlert}
        onOpenChange={(open) => {
          if (!open) setQuotaAlert(null);
        }}
        title={quotaAlert?.title}
        message={quotaAlert?.message}
      />

      <DuplicateFileDialog
        open={Boolean(duplicateDialog)}
        onOpenChange={(open) => {
          if (!open) {
            duplicateDialog?.resolve?.("cancel");
            setDuplicateDialog(null);
          }
        }}
        duplicates={duplicateDialog?.duplicates || []}
        onSkip={() => {
          duplicateDialog?.resolve?.("skip");
          setDuplicateDialog(null);
        }}
        onReplace={() => {
          duplicateDialog?.resolve?.("replace");
          setDuplicateDialog(null);
        }}
        onUploadAll={() => {
          duplicateDialog?.resolve?.("uploadAll");
          setDuplicateDialog(null);
        }}
      />

      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => {
          setIsUploadModalOpen(false);
          setUploadStep(0);
        }}
        queue={uploadQueue}
        currentIndex={uploadFileIndex}
        currentStep={uploadStep}
        uploadProgress={uploadProgress}
        errorMessage={uploadError}
      />
    </div>
  );
}