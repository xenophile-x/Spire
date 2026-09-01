
import React, { useMemo, useRef, useEffect, useState } from "react";
import "material-symbols/rounded.css";
import { Play, Pause } from "lucide-react";
import { LiquidGlass } from "@/components/ui/glasscn/liquid-glass";
import { GlassCard } from "@/components/ui/glasscn/glass-card";
import { GlassSkeleton } from "@/components/ui/glasscn/glass-skeleton";
import { useLibrary } from "@/context/LibraryContext";
import { parseLRC } from "@/utils/lyricsParser";
import { formatTime } from "@/utils/formatters";
import { DEFAULT_COVER } from "@/utils/trackMetadata";
import { useKaraokeRecorder } from "@/hooks/useKaraokeRecorder";
import { saveRecordingMeta, triggerDownload } from "@/utils/recordingsStore";
import { uploadRecordingToDrive, DriveQuotaError } from "@/services/driveService";
import QuotaAlertDialog from "@/components/QuotaAlertDialog";
import GlassSlider from "@/components/GlassSlider";
import SyncedLyrics from "@/components/SyncedLyrics";
import { fetchLyrics } from "@/services/lyricsService";
import { usePlayerTime } from "@/context/PlayerContext";
import { useNavigate } from "react-router-dom";
import PageHeader from "@/components/ui/PageHeader";

function rawLrcFor(track) {
  return (
    track?.synced_lyrics ||
    track?.syncedLyrics ||
    track?.track_lyrics?.synced_lyrics ||
    track?.track_lyrics?.[0]?.synced_lyrics ||
    ""
  );
}

function plainLyricsFor(track) {
  return (
    track?.plainLyrics ||
    track?.plain_lyrics ||
    track?.lyrics ||
    track?.track_lyrics?.plain_lyrics ||
    ""
  );
}

function formatClock(totalSeconds) {
  if (!totalSeconds || isNaN(totalSeconds) || !Number.isFinite(totalSeconds)) return "00:00";
  const sec = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function TrackRow({ track, isActive, isPlaying, onClick }) {
  const cover = track.cover || track.artworkUrl || track.artwork_url || DEFAULT_COVER;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className={`group flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 transition-all duration-200 ${
        isActive ? "bg-white/15" : "hover:bg-white/10"
      }`}
    >
      <img
        src={cover}
        alt={track.title}
        className="h-11 w-11 shrink-0 rounded-xl object-cover shadow-lg shadow-black/40 border border-white/5"
        onError={(e) => {
          if (e.currentTarget.src !== DEFAULT_COVER) e.currentTarget.src = DEFAULT_COVER;
        }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className={`truncate text-sm font-semibold ${isActive ? "text-white" : "text-white/90"}`}>
            {track.title}
          </p>
          {track.isShared && (
            <span
              title={`Shared by ${track.sharedBy || "a friend"}`}
              className="inline-flex shrink-0 items-center justify-center rounded-full bg-white/20 backdrop-blur-md px-1.5 py-0.5 border border-white/30 text-[10px] font-semibold text-white"
            >
              <span className="material-symbols-rounded text-[11px] mr-0.5 leading-none">person</span>
              {track.sharedBy || "Shared"}
            </span>
          )}
        </div>
        <p className="truncate text-xs font-medium text-white/60">{track.artist}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {isPlaying && isActive ? (
          <span className="material-symbols-rounded text-lg text-white/90">graphic_eq</span>
        ) : (
          <Play className="h-4 w-4 fill-current text-white/40 group-hover:text-white" />
        )}
      </div>
    </div>
  );
}

export default function KaraokeView({
  userTracks = [],
  activeTrack,
  isPlaying,
  onPlayTrack,
  onTogglePlay,
  duration = 0,
  onSeek,
  audioElementRef = null,
}) {

  const { currentTime } = usePlayerTime();
  const navigate = useNavigate();
  let libraryLoaded = true;
  try {
    libraryLoaded = useLibrary()?.libraryLoaded ?? true;
  } catch {}
  const [autoScroll, setAutoScroll] = useState(true);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [quotaAlert, setQuotaAlert] = useState(null);
  const [liveLyrics, setLiveLyrics] = useState({});

  const [lyricsState, setLyricsState] = useState({});
  const lyricsFetchingRef = useRef(new Set());
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);
  const previewAudioRef = useRef(null);
  const previewScrubbingRef = useRef(false);

  useEffect(() => {
    if (activeTrack && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => stream.getTracks().forEach((t) => t.stop()))
        .catch(() => {});
    }
  }, [activeTrack]);

  useEffect(() => {
    const trackId = activeTrack?.id;
    if (!trackId) return;
    if (lyricsFetchingRef.current.has(trackId)) return;
    if (rawLrcFor(activeTrack) || plainLyricsFor(activeTrack)) return;

    lyricsFetchingRef.current.add(trackId);
    setLyricsState((prev) => ({ ...prev, [trackId]: { status: "loading" } }));


    fetchLyrics({
      title: activeTrack.title,
      artist: activeTrack.artist,
      duration: activeTrack.duration || duration || 0,
    })
      .then((result) => {
        if (!result.synced && !result.plain) return;
        setLiveLyrics((prev) => ({
          ...prev,
          [trackId]: { synced: result.synced || "", plain: result.plain || "" },
        }));
      })
      .catch((err) => {
        console.warn("[Karaoke] Lyrics lookup failed:", err);
      })
      .finally(() => {
        lyricsFetchingRef.current.delete(trackId);
        setLyricsState((prev) => ({ ...prev, [trackId]: { status: "done" } }));
      });
  }, [activeTrack, duration]);

  const activeLyrics = useMemo(() => {
    const trackId = activeTrack?.id;
    return liveLyrics[trackId] || { synced: "", plain: "" };
  }, [liveLyrics, activeTrack]);

  const {
    isRecording,
    recordingUrl,
    recordingBlob,
    recordingError,
    recordingWarning,
    elapsed,
    recordedDuration,
    startRecording,
    stopRecording,
    discardRecording,
  } = useKaraokeRecorder();

  const parsedLyrics = useMemo(
    () =>
      parseLRC(rawLrcFor(activeTrack) || activeLyrics.synced || ""),
    [activeTrack, activeLyrics]
  );
  const plainLyrics = useMemo(
    () => plainLyricsFor(activeTrack) || activeLyrics.plain || "",
    [activeTrack, activeLyrics]
  );

  const handleProgressClick = (e) => {
    if (!duration || !onSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  };

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const handleRecordClick = async () => {
    if (isRecording) {
      stopRecording();
      return;
    }
    if (!activeTrack) return;
    const el = audioElementRef?.current;
    if (!el) return;

    if (previewAudioRef.current && !previewAudioRef.current.paused) {
      previewAudioRef.current.pause();
    }

    if (el.paused) {
      try {
        await el.play();
        if (!isPlaying) onTogglePlay();
      } catch (err) {
        console.warn("[KaraokeView] Failed to play audio element:", err);
      }
    }
    await startRecording(el);
  };

  const handleDownloadTake = () => {
    if (!recordingUrl) return;
    const mime = recordingBlob?.type || "audio/webm";
    const ext = mime.includes("mp4") ? "mp4" : mime.includes("m4a") ? "m4a" : "webm";
    triggerDownload(
      recordingUrl,
      `${activeTrack?.artist || "Karaoke"} - ${activeTrack?.title || "Recording"}.${ext}`
    );
  };

  const handleSaveToDrive = async () => {
    if (!recordingBlob || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const mime = recordingBlob.type || "audio/webm";
      const ext = mime.includes("mp4")
        ? "mp4"
        : mime.includes("m4a")
        ? "m4a"
        : "webm";
      const stamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(/[:]/g, "-");
      const name = `${activeTrack?.artist || "Karaoke"} - ${activeTrack?.title || "Recording"} (${stamp}).${ext}`;
      const file = new File([recordingBlob], name, { type: mime });
      const driveFileId = await uploadRecordingToDrive(file);
      const actualDuration = Math.round(recordedDuration || previewDuration || 1);
      const meta = {
        id: `rec_${Date.now()}`,
        name,
        trackTitle: activeTrack?.title || "Karaoke recording",
        artist: activeTrack?.artist || "You",
        driveFileId,
        createdAt: Date.now(),
        size: file.size,
        duration: actualDuration,
      };
      saveRecordingMeta(meta);
      discardRecording();
    } catch (err) {
      console.error("[KaraokeView] Save to Drive failed:", err);
      if (err instanceof DriveQuotaError) {
        setQuotaAlert({ title: "Google Drive storage is full", message: err.message });
        return;
      }
      setSaveError("Could not upload to Google Drive. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const togglePreview = () => {
    const audio = previewAudioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  };

  const handlePreviewSeek = (time) => {
    setPreviewTime(time);
  };

  const handlePreviewScrubEnd = () => {
    previewScrubbingRef.current = false;
    const audio = previewAudioRef.current;
    if (!audio) return;
    try {
      audio.currentTime = previewTime;
    } catch {}
    setPreviewTime(audio.currentTime || previewTime);
  };

  useEffect(() => {
    setPreviewPlaying(false);
    setPreviewTime(0);
    if (recordedDuration > 0) {
      setPreviewDuration(recordedDuration);
    } else {
      setPreviewDuration(0);
    }
  }, [recordingUrl, recordedDuration]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-5">
      <PageHeader
        title="Karaoke"
        subtitle="Pick a track, sing along, and record"
        action={
          <button
            onClick={() => navigate("/karaoke/recordings")}
            className="flex shrink-0 cursor-pointer items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-bold text-white/90 transition-all hover:bg-white/20"
          >
            <span className="material-symbols-rounded text-base">fiber_smart_record</span>
            My Recordings
          </button>
        }
      />

      <div className="grid min-h-0 flex-1 auto-rows-[minmax(0,1fr)] grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">

        <GlassCard
          glassVariant="liquid-refract"
          liquidProps={{
            blur: 14,
            refraction: 18,
            saturation: 1.6,
            className: "rounded-3xl [--liquid-glass-rim-light:rgba(255,255,255,0.4)]",
          }}
          className="h-full min-h-0 gap-0 overflow-hidden py-0"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/85">
              Your Library
            </span>
            <span className="text-[10px] font-semibold text-white/50">
              {userTracks.length} tracks
            </span>
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2 custom-scrollbar">
            {!libraryLoaded ? (
              <div className="space-y-2 p-1 animate-in fade-in-0" aria-hidden="true">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={`karaoke-sk-${i}`} className="flex items-center gap-3 rounded-2xl px-3 py-2">
                    <GlassSkeleton className="h-11 w-11 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-2">
                      <GlassSkeleton className="h-3 w-32 rounded-full" />
                      <GlassSkeleton className="h-2.5 w-20 rounded-full opacity-60" />
                    </div>
                    <GlassSkeleton className="h-4 w-4 rounded-full opacity-40" />
                  </div>
                ))}
              </div>
            ) : userTracks.length === 0 ? (
              <div className="flex h-full items-center justify-center px-4 py-12 text-center text-sm font-medium text-white/40">
                No tracks in your library yet.
              </div>
            ) : (
              userTracks.map((track) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  isActive={activeTrack?.id === track.id}
                  isPlaying={isPlaying}
                  onClick={() => onPlayTrack(track)}
                />
              ))
            )}
          </div>
        </GlassCard>


        <GlassCard
          glassVariant="liquid-refract"
          liquidProps={{
            blur: 14,
            refraction: 18,
            saturation: 1.6,
            className: "rounded-3xl [--liquid-glass-rim-light:rgba(255,255,255,0.4)]",
          }}
          className="flex h-full min-h-0 flex-col overflow-hidden py-0 gap-0"
        >

          <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-5 py-3">
            <img
              src={
                (activeTrack && (activeTrack.cover || activeTrack.artworkUrl)) || DEFAULT_COVER
              }
              alt={activeTrack?.title || "No track selected"}
              className="h-11 w-11 shrink-0 rounded-xl object-cover shadow-lg shadow-black/40 border border-white/5"
              onError={(e) => {
                if (e.currentTarget.src !== DEFAULT_COVER) e.currentTarget.src = DEFAULT_COVER;
              }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white drop-shadow-sm">
                {activeTrack?.title || "No track selected"}
              </p>
              <p className="truncate text-xs font-medium text-white/60">
                {activeTrack?.artist || "Choose a track from your library"}
              </p>
            </div>
            <LiquidGlass
              blur={8}
              refraction={14}
              saturation={1.6}
              onClick={activeTrack ? onTogglePlay : undefined}
              role="button"
              tabIndex={activeTrack ? 0 : -1}
              onKeyDown={(e) => {
                if (activeTrack && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onTogglePlay();
                }
              }}
              className={`flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/20 border border-white/30 [--liquid-glass-rim-light:rgba(255,255,255,0.7)] transition-all hover:bg-white/30 ${
                activeTrack ? "" : "opacity-50 pointer-events-none"
              }`}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5 fill-current text-white" />
              ) : (
                <Play className="h-5 w-5 fill-current text-white ml-0.5" />
              )}
            </LiquidGlass>
          </div>


          <div className="relative min-h-0 flex-1">
            {!activeTrack ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-white/40">
                <span className="material-symbols-rounded text-5xl">mic</span>
                <p className="text-sm font-medium">Select a track to start karaoke</p>
              </div>
            ) : parsedLyrics.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
                {plainLyrics ? (
                  <div className="h-full w-full overflow-y-auto px-8 py-6 whitespace-pre-line text-center text-lg leading-relaxed font-medium text-white/70 custom-scrollbar">
                    {plainLyrics}
                  </div>
                ) : (
                  <>
                    <span className="material-symbols-rounded text-4xl">lyrics</span>
                    <p className="text-sm font-medium text-white/50">
                      {lyricsState[activeTrack?.id]?.status === "loading"
                        ? "Searching for lyrics…"
                        : "No lyrics found for this track."}
                    </p>
                  </>
                )}
              </div>
            ) : (
              <SyncedLyrics
                lines={parsedLyrics}
                currentTime={currentTime}
                onSeek={onSeek}
                autoFollow={autoScroll}
                onAutoFollowChange={setAutoScroll}
                containerClassName="h-full overflow-y-auto px-8 py-10 custom-scrollbar select-none"
                spacerClassName="h-[30vh] min-h-40"
              />
            )}

            {isRecording && (
              <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 backdrop-blur-md border border-white/40">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-black opacity-40" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-black" />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-widest text-black">
                  REC
                </span>
              </div>
            )}
          </div>


          <div className="shrink-0 border-t border-white/10 px-5 py-3">
            <div
              role="button"
              tabIndex={0}
              onClick={handleProgressClick}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
                  if (onSeek && duration) onSeek(ratio * duration);
                }
              }}
              className="group relative h-6 cursor-pointer"
            >
              <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-white/80 transition-[width] duration-150"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div
                className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-lg shadow-black/40 transition-opacity opacity-0 group-hover:opacity-100"
                style={{ left: `${progressPct}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] font-semibold tabular-nums text-white/50">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>


          <div className="shrink-0 border-t border-white/10 px-5 py-3">
            {recordingUrl ? (
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <LiquidGlass
                    blur={8}
                    refraction={14}
                    saturation={1.6}
                    onClick={togglePreview}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        togglePreview();
                      }
                    }}
                    className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/20 border border-white/30 [--liquid-glass-rim-light:rgba(255,255,255,0.7)] shadow-lg shadow-black/20 transition-all hover:bg-white/30 active:scale-95"
                  >
                    {previewPlaying ? (
                      <Pause className="h-5 w-5 fill-current text-white" />
                    ) : (
                      <Play className="h-5 w-5 fill-current text-white ml-0.5" />
                    )}
                  </LiquidGlass>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-bold text-white">
                        Recording Preview
                      </span>
                      <span className="shrink-0 text-[11px] font-bold tabular-nums text-white/70">
                        {formatClock(previewTime)} / {formatClock(previewDuration || recordedDuration)}
                      </span>
                    </div>
                    <GlassSlider
                      value={previewTime}
                      max={previewDuration || recordedDuration || 0}
                      onChange={handlePreviewSeek}
                      onScrubStart={() => {
                        previewScrubbingRef.current = true;
                      }}
                      onScrubEnd={handlePreviewScrubEnd}
                      label="Recording preview timeline"
                      className="mt-0.5"
                    />
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2 justify-end">
                  <LiquidGlass
                    blur={6}
                    refraction={10}
                    saturation={1.4}
                    onClick={handleDownloadTake}
                    role="button"
                    tabIndex={0}
                    className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white/90 [--liquid-glass-rim-light:rgba(255,255,255,0.5)] transition-all hover:bg-white/20 active:scale-95 shadow-sm"
                  >
                    <span className="material-symbols-rounded text-base leading-none">download</span>
                    Download
                  </LiquidGlass>

                  <LiquidGlass
                    blur={8}
                    refraction={14}
                    saturation={1.6}
                    onClick={!saving ? handleSaveToDrive : undefined}
                    role="button"
                    tabIndex={saving ? -1 : 0}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-full border border-white/40 bg-white/25 px-4 py-1.5 text-xs font-bold text-white [--liquid-glass-rim-light:rgba(255,255,255,0.8)] shadow-lg shadow-black/20 transition-all hover:bg-white/35 active:scale-95 ${
                      saving ? "opacity-50 pointer-events-none" : ""
                    }`}
                  >
                    <span className={`material-symbols-rounded text-base leading-none ${saving ? "animate-spin" : ""}`}>
                      {saving ? "progress_activity" : "cloud_upload"}
                    </span>
                    {saving ? "Saving…" : "Save to Drive"}
                  </LiquidGlass>

                  <LiquidGlass
                    blur={6}
                    refraction={10}
                    saturation={1.4}
                    onClick={!saving ? discardRecording : undefined}
                    role="button"
                    tabIndex={saving ? -1 : 0}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white/90 [--liquid-glass-rim-light:rgba(255,255,255,0.5)] transition-all hover:bg-white/20 hover:text-white active:scale-95 shadow-sm ${
                      saving ? "opacity-50 pointer-events-none" : ""
                    }`}
                  >
                    <span className="material-symbols-rounded text-base leading-none text-white/90">delete</span>
                    Discard
                  </LiquidGlass>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <LiquidGlass
                  blur={8}
                  refraction={14}
                  saturation={1.6}
                  onClick={handleRecordClick}
                  role="button"
                  tabIndex={activeTrack ? 0 : -1}
                  onKeyDown={(e) => {
                    if (activeTrack && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      handleRecordClick();
                    }
                  }}
                  className={`flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full px-4 transition-all [--liquid-glass-rim-light:rgba(255,255,255,0.7)] ${
                    isRecording
                      ? "bg-white border border-white"
                      : "bg-white/90 border border-white/40 hover:bg-white"
                  } ${!activeTrack ? "opacity-50 pointer-events-none" : ""}`}
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      isRecording ? "animate-pulse bg-black" : "bg-black"
                    }`}
                  />
                  <span className="text-xs font-bold uppercase tracking-widest text-black">
                    {isRecording ? "Stop" : "Record"}
                  </span>
                </LiquidGlass>
                {isRecording && (
                  <span className="text-sm font-bold tabular-nums text-white">
                    {formatClock(elapsed)}
                  </span>
                )}
                <p className="min-w-0 truncate text-xs font-medium text-white/50">
                  {!activeTrack
                    ? "Select a track first"
                    : isRecording
                    ? "Recording your voice with the music…"
                    : "Mic + music are mixed into one recording"}
                </p>
              </div>
            )}
            {(recordingError || saveError || recordingWarning) && (
              <p
                className={`mt-2 text-xs font-semibold ${
                  recordingWarning && !recordingError && !saveError
                    ? "text-amber-300"
                    : "text-red-300"
                }`}
              >
                {recordingError || saveError || recordingWarning}
              </p>
            )}
          </div>
        </GlassCard>
      </div>

      <QuotaAlertDialog
        open={!!quotaAlert}
        onOpenChange={(open) => {
          if (!open) setQuotaAlert(null);
        }}
        title={quotaAlert?.title}
        message={quotaAlert?.message}
      />

      <audio
        ref={previewAudioRef}
        src={recordingUrl || undefined}
        className="hidden"
        onPlay={() => setPreviewPlaying(true)}
        onPause={() => setPreviewPlaying(false)}
        onEnded={() => setPreviewPlaying(false)}
        onTimeUpdate={() => {
          if (!previewScrubbingRef.current && previewAudioRef.current) {
            setPreviewTime(previewAudioRef.current.currentTime);
          }
        }}
        onLoadedMetadata={() => {
          const audio = previewAudioRef.current;
          if (audio && Number.isFinite(audio.duration)) {
            setPreviewDuration(audio.duration);
          }
        }}
      />
    </div>
  );
}
