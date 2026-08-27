
import React, { useRef, useState, useCallback } from "react";
import "material-symbols/rounded.css";
import { Play, Pause } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { LiquidGlass } from "@/components/ui/glasscn/liquid-glass";
import { GlassCard } from "@/components/ui/glasscn/glass-card";
import {
  getSavedRecordings,
  removeRecordingMeta,
  getRecordingPlaybackUrl,
  formatRecordingDuration,
  triggerDownload,
} from "@/utils/recordingsStore";
import { deleteDriveFile } from "@/services/driveService";
import GlassSlider from "@/components/GlassSlider";
import StickyGlassHeader from "@/components/ui/StickyGlassHeader";

function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatDateTime(timestamp) {
  const date = new Date(timestamp);
  return `${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })} · ${date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function RecordingCard({ recording, isPlaying, isBusy, isDownloading, onTogglePlay, onDownload, onDelete }) {
  return (
    <GlassCard
      glassVariant="liquid-refract"
      liquidProps={{
        blur: 14,
        refraction: 18,
        saturation: 1.6,
        className: "rounded-3xl [--liquid-glass-rim-light:rgba(255,255,255,0.4)]",
      }}
      className="gap-0 overflow-hidden py-0"
    >
      <div className="flex items-center gap-3 px-4 py-4">
        <LiquidGlass
          blur={8}
          refraction={14}
          saturation={1.6}
          onClick={onTogglePlay}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onTogglePlay();
            }
          }}
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/20 border border-white/30 [--liquid-glass-rim-light:rgba(255,255,255,0.7)] transition-all hover:bg-white/30"
        >
          {isPlaying ? (
            <Pause className="h-5 w-5 fill-current text-white" />
          ) : (
            <Play className={`h-5 w-5 fill-current text-white ml-0.5 ${isBusy ? "animate-pulse" : ""}`} />
          )}
        </LiquidGlass>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">
            {recording.trackTitle || "Karaoke recording"}
          </p>
          <p className="truncate text-xs font-medium text-white/50">
            {recording.artist || "You"}
          </p>
          <p className="mt-0.5 text-[10px] font-semibold text-white/40">
            {formatDateTime(recording.createdAt)} · {formatRecordingDuration(recording.duration)}
          </p>
        </div>
        <span className="hidden shrink-0 text-[10px] font-semibold text-white/40 sm:block">
          {formatFileSize(recording.size)}
        </span>
      </div>
      <div className="flex items-center justify-between border-t border-white/10 px-4 py-2">
        <button
          onClick={onDelete}
          className="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold text-white/50 transition-all hover:bg-red-500/20 hover:text-red-300"
        >
          <span className="material-symbols-rounded text-base">delete</span>
          Delete
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={onDownload}
            disabled={isDownloading}
            className="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold text-white/50 transition-all hover:bg-white/20 hover:text-white disabled:opacity-50"
          >
            <span className={`material-symbols-rounded text-base ${isDownloading ? "animate-pulse" : ""}`}>
              download
            </span>
            {isDownloading ? "Preparing…" : "Download"}
          </button>
          <span className="flex items-center gap-1 text-[10px] font-semibold text-white/40">
            <span className="material-symbols-rounded text-sm">cloud_done</span>
          </span>
        </div>
      </div>
    </GlassCard>
  );
}

export default function RecordingsView() {
  const navigate = useNavigate();
  const [recordings, setRecordings] = useState(() => getSavedRecordings());
  const [playingId, setPlayingId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [downloadingId, setDownloadingId] = useState(null);
  const audioRef = useRef(null);
  const scrubbingRef = useRef(false);
  const scrubTimeRef = useRef(0);


  const latestReqRef = useRef(0);


  const playbackUrlRef = useRef(null);

  const revokeOwnedUrl = () => {
    if (playbackUrlRef.current) {
      URL.revokeObjectURL(playbackUrlRef.current);
      playbackUrlRef.current = null;
    }
  };

  useEffect(
    () => () => {
      latestReqRef.current++;
      revokeOwnedUrl();
    },
    []
  );

  const stopPlayback = useCallback(() => {

    latestReqRef.current++;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    revokeOwnedUrl();
    setPlayingId(null);
    setCurrentTime(0);
  }, []);

  const togglePlayback = useCallback(
    async (recording) => {
      if (playingId === recording.id) {
        stopPlayback();
        return;
      }
      setBusyId(recording.id);
      const reqId = ++latestReqRef.current;
      try {
        const src = await getRecordingPlaybackUrl(recording);
        if (reqId !== latestReqRef.current) {


          if (src && src.startsWith("blob:")) URL.revokeObjectURL(src);
          return;
        }
        if (!src) {
          setError("Couldn't load this recording from Google Drive.");
          return;
        }
        const audio = audioRef.current;
        if (!audio) return;
        audio.pause();
        if (playbackUrlRef.current && playbackUrlRef.current !== src) {
          URL.revokeObjectURL(playbackUrlRef.current);
        }
        playbackUrlRef.current = src.startsWith("blob:") ? src : null;
        audio.src = src;
        setCurrentTime(0);
        setTotalDuration(recording.duration || 0);
        await audio.play();
        setPlayingId(recording.id);
        setError(null);
      } catch (err) {
        console.error("[RecordingsView] Playback failed:", err);
        setError("Playback failed. Try again.");
      } finally {
        setBusyId(null);
      }
    },
    [playingId, stopPlayback]
  );

  const handleSeek = (value) => {
    scrubTimeRef.current = value;
    setCurrentTime(value);
  };

  const handleScrubEnd = () => {
    scrubbingRef.current = false;
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    audio.currentTime = scrubTimeRef.current;
    setCurrentTime(audio.currentTime);
  };

  const handleDownload = async (recording) => {
    setDownloadingId(recording.id);
    try {
      const src = await getRecordingPlaybackUrl(recording);
      if (!src) {
        setError("Couldn't load this recording from Google Drive.");
        return;
      }
      triggerDownload(src, recording.name || "karaoke-recording");


      if (src.startsWith("blob:")) {
        setTimeout(() => URL.revokeObjectURL(src), 10_000);
      }
    } catch (err) {
      console.error("[RecordingsView] Download failed:", err);
      setError("Download failed. Try again.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (recording) => {
    if (!window.confirm("Delete this recording from your Google Drive?")) return;
    try {
      await deleteDriveFile(recording.driveFileId);
    } catch (err) {
      console.warn("[RecordingsView] Drive delete failed:", err);
    }
    setRecordings(removeRecordingMeta(recording.id));
    if (playingId === recording.id) {
      stopPlayback();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-5">
      <StickyGlassHeader
        title="My Recordings"
        subtitle={`Saved ${recordings.length}`}
        icon={
          <LiquidGlass
            blur={10}
            refraction={18}
            saturation={1.6}
            onClick={() => navigate("/karaoke")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                navigate("/karaoke");
              }
            }}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white/15 border border-white/30 [--liquid-glass-rim-light:rgba(255,255,255,0.7)] shadow-lg shadow-black/10 transition-all hover:bg-white/25"
          >
            <span className="material-symbols-rounded text-xl text-white">arrow_back</span>
          </LiquidGlass>
        }
      />

      {error && (
        <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-red-400/40 bg-red-500/15 px-4 py-3 text-xs font-semibold text-red-200">
          <span className="material-symbols-rounded text-base">error</span>
          {error}
        </div>
      )}

      {recordings.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-white/40">
          <span className="material-symbols-rounded text-6xl">fiber_smart_record</span>
          <p className="text-sm font-medium">No recordings yet — hit Record in Karaoke and sing!</p>
          <button
            onClick={() => navigate("/karaoke")}
            className="flex cursor-pointer items-center gap-2 rounded-full bg-white/90 px-5 py-2.5 text-xs font-bold text-black transition-all hover:bg-white"
          >
            <span className="material-symbols-rounded text-base">mic</span>
            Go to Karaoke
          </button>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 grid grid-cols-1 gap-4 auto-rows-min md:grid-cols-2 xl:grid-cols-3 pb-8">
            {recordings.map((recording) => (
              <RecordingCard
                key={recording.id}
                recording={recording}
                isPlaying={playingId === recording.id}
                isBusy={busyId === recording.id}
                isDownloading={downloadingId === recording.id}
                onTogglePlay={() => togglePlayback(recording)}
                onDownload={() => handleDownload(recording)}
                onDelete={() => handleDelete(recording)}
              />
            ))}
          </div>


          {playingId && (
            <GlassCard
              glassVariant="liquid-refract"
              liquidProps={{
                blur: 14,
                refraction: 18,
                saturation: 1.6,
                className: "rounded-3xl [--liquid-glass-rim-light:rgba(255,255,255,0.4)]",
              }}
              className="shrink-0 gap-0 overflow-hidden py-0"
            >
              {(() => {
                const current = recordings.find((r) => r.id === playingId);
                return (
                  <div className="flex items-center gap-3 px-5 py-3">
                    <LiquidGlass
                      blur={8}
                      refraction={14}
                      saturation={1.6}
                      onClick={() => togglePlayback(current)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          togglePlayback(current);
                        }
                      }}
                      className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/20 border border-white/30 [--liquid-glass-rim-light:rgba(255,255,255,0.7)] transition-all hover:bg-white/30"
                    >

                      <Pause className="h-4 w-4 fill-current text-white" />
                    </LiquidGlass>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-xs font-bold text-white">
                          {current?.trackTitle || "Karaoke recording"}
                        </p>
                        <span className="shrink-0 text-[10px] font-semibold tabular-nums text-white/50">
                          {formatRecordingDuration(currentTime)} /{" "}
                          {formatRecordingDuration(totalDuration || current?.duration)}
                        </span>
                      </div>
                      <GlassSlider
                        value={currentTime}
                        max={totalDuration || current?.duration || 0}
                        onChange={handleSeek}
                        onScrubStart={() => {
                          scrubbingRef.current = true;
                        }}
                        onScrubEnd={handleScrubEnd}
                        label="Seek recording"
                        className="mt-1.5"
                      />
                    </div>
                    <button
                      onClick={() => handleDownload(current)}
                      aria-label="Download recording"
                      className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/60 transition-all hover:bg-white/20 hover:text-white"
                    >
                      <span className="material-symbols-rounded text-lg">download</span>
                    </button>
                    <button
                      onClick={stopPlayback}
                      aria-label="Close player"
                      className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/60 transition-all hover:bg-white/20 hover:text-white"
                    >
                      <span className="material-symbols-rounded text-lg">close</span>
                    </button>
                  </div>
                );
              })()}
            </GlassCard>
          )}
        </>
      )}

      <audio
        ref={audioRef}
        className="hidden"
        onTimeUpdate={() => {
          if (!scrubbingRef.current && audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current && Number.isFinite(audioRef.current.duration)) {
            setTotalDuration(audioRef.current.duration);
          }
        }}
        onEnded={() => {
          setPlayingId(null);
          setCurrentTime(0);
        }}
      />
    </div>
  );
}
