
import React, { useRef, useState, useCallback, useEffect } from "react";
import "material-symbols/rounded.css";
import { Play, Pause } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { LiquidGlass } from "@/components/ui/glasscn/liquid-glass";
import { GlassCard } from "@/components/ui/glasscn/glass-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  GlassAlertDialogContent,
} from "@/components/ui/glasscn/glass-alert-dialog";
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
import { AppleResizableGrid, AppleResizableTile } from "@/components/ui/AppleResize";

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
        className: "rounded-3xl border border-white/10 [--liquid-glass-rim-light:rgba(255,255,255,0.35)]",
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
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/20 [--liquid-glass-rim-light:rgba(255,255,255,0.6)] transition-all hover:border-white/40 active:scale-95"
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
          <p className="truncate text-xs font-medium text-white/60">
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
          className="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold text-white/70 transition-all hover:text-white hover:bg-white/10 active:scale-95"
        >
          <span className="material-symbols-rounded text-sm">delete</span>
          Delete
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={!isDownloading ? onDownload : undefined}
            disabled={isDownloading}
            className="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold text-white/70 transition-all hover:text-white active:scale-95 disabled:opacity-40"
          >
            <span className={`material-symbols-rounded text-sm ${isDownloading ? "animate-spin" : ""}`}>
              {isDownloading ? "progress_activity" : "download"}
            </span>
            {isDownloading ? "Preparing…" : "Download"}
          </button>
          <span className="text-white/30" title="Saved to Drive">
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
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
    if (!audio) return;
    try {
      audio.currentTime = scrubTimeRef.current;
    } catch {}
    setCurrentTime(audio.currentTime || scrubTimeRef.current);
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

  const handleConfirmDelete = async () => {
    if (!deleteCandidate) return;
    setIsDeleting(true);
    try {
      await deleteDriveFile(deleteCandidate.driveFileId);
    } catch (err) {
      console.warn("[RecordingsView] Drive delete failed:", err);
    }
    setRecordings(removeRecordingMeta(deleteCandidate.id));
    if (playingId === deleteCandidate.id) {
      stopPlayback();
    }
    setIsDeleting(false);
    setDeleteCandidate(null);
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
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white/15 border border-white/30 [--liquid-glass-rim-light:rgba(255,255,255,0.7)] shadow-lg shadow-black/10 transition-all hover:bg-white/25 active:scale-95"
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
          <LiquidGlass
            blur={8}
            refraction={14}
            saturation={1.6}
            onClick={() => navigate("/karaoke")}
            role="button"
            tabIndex={0}
            className="flex cursor-pointer items-center gap-2 rounded-full bg-white/25 border border-white/35 px-5 py-2.5 text-xs font-bold text-white [--liquid-glass-rim-light:rgba(255,255,255,0.7)] shadow-lg shadow-black/20 transition-all hover:bg-white/35 active:scale-95"
          >
            <span className="material-symbols-rounded text-base">mic</span>
            Go to Karaoke
          </LiquidGlass>
        </div>
      ) : (
        <>
          <AppleResizableGrid cols="grid-cols-1 md:grid-cols-2 xl:grid-cols-3" gap="gap-4" className="min-h-0 flex-1 auto-rows-min pb-8">
            {recordings.map((recording) => (
              <AppleResizableTile key={recording.id} id={`rec-${recording.id}`} defaultSize="1x1" onRemove={() => setDeleteCandidate(recording)}>
                <RecordingCard
                  recording={recording}
                  isPlaying={playingId === recording.id}
                  isBusy={busyId === recording.id}
                  isDownloading={downloadingId === recording.id}
                  onTogglePlay={() => togglePlayback(recording)}
                  onDownload={() => handleDownload(recording)}
                  onDelete={() => setDeleteCandidate(recording)}
                />
              </AppleResizableTile>
            ))}
          </AppleResizableGrid>

          {playingId && (
            <GlassCard
              glassVariant="liquid-refract"
              liquidProps={{
                blur: 14,
                refraction: 18,
                saturation: 1.6,
                className: "rounded-3xl border border-white/20 [--liquid-glass-rim-light:rgba(255,255,255,0.6)] shadow-2xl shadow-black/30",
              }}
              className="shrink-0 gap-0 overflow-hidden py-0"
            >
              {(() => {
                const current = recordings.find((r) => r.id === playingId);
                return (
                  <div className="flex items-center gap-3 px-5 py-3.5">
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
                      className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/20 border border-white/30 [--liquid-glass-rim-light:rgba(255,255,255,0.7)] shadow-md shadow-black/20 transition-all hover:bg-white/30 active:scale-95"
                    >
                      <Pause className="h-4 w-4 fill-current text-white" />
                    </LiquidGlass>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-xs font-bold text-white">
                          {current?.trackTitle || "Karaoke recording"}
                        </p>
                        <span className="shrink-0 text-[11px] font-bold tabular-nums text-white/70">
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
                        className="mt-1"
                      />
                    </div>
                    <LiquidGlass
                      blur={6}
                      refraction={10}
                      saturation={1.4}
                      onClick={() => handleDownload(current)}
                      role="button"
                      tabIndex={0}
                      className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/80 [--liquid-glass-rim-light:rgba(255,255,255,0.5)] transition-all hover:bg-white/25 hover:text-white active:scale-95 shadow-sm"
                    >
                      <span className="material-symbols-rounded text-lg">download</span>
                    </LiquidGlass>
                    <LiquidGlass
                      blur={6}
                      refraction={10}
                      saturation={1.4}
                      onClick={stopPlayback}
                      role="button"
                      tabIndex={0}
                      className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/80 [--liquid-glass-rim-light:rgba(255,255,255,0.5)] transition-all hover:bg-white/25 hover:text-white active:scale-95 shadow-sm"
                    >
                      <span className="material-symbols-rounded text-lg">close</span>
                    </LiquidGlass>
                  </div>
                );
              })()}
            </GlassCard>
          )}
        </>
      )}

      {/* Glass Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteCandidate} onOpenChange={(open) => !open && setDeleteCandidate(null)}>
        <GlassAlertDialogContent glassVariant="liquid-refract">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-lg font-bold tracking-tight text-white">
              <span className="material-symbols-rounded text-red-400 text-xl">delete</span>
              Delete Recording?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium leading-relaxed text-white/70">
              Are you sure you want to permanently delete{" "}
              <span className="font-bold text-white">"{deleteCandidate?.trackTitle || "this recording"}"</span> from your Google Drive?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex items-center justify-end gap-2 pt-2">
            <AlertDialogCancel className="cursor-pointer rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-white/20">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="cursor-pointer rounded-full border border-red-500/40 bg-red-500/80 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-red-500 active:scale-95 shadow-lg shadow-red-500/20"
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </GlassAlertDialogContent>
      </AlertDialog>

      <audio
        ref={audioRef}
        className="hidden"
        onTimeUpdate={() => {
          if (!scrubbingRef.current && audioRef.current) {
            const cur = audioRef.current.currentTime;
            setCurrentTime(cur);
            if (Number.isFinite(audioRef.current.duration) && audioRef.current.duration > 0) {
              setTotalDuration(audioRef.current.duration);
            }
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current && Number.isFinite(audioRef.current.duration) && audioRef.current.duration > 0) {
            setTotalDuration(audioRef.current.duration);
          }
        }}
        onDurationChange={() => {
          if (audioRef.current && Number.isFinite(audioRef.current.duration) && audioRef.current.duration > 0) {
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
