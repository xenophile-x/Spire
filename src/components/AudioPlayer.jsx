import React, { useEffect, useRef, useCallback } from "react";
import { parseLRC } from "@/utils/lyricsParser";
import { getStreamTrackUrl } from "@/utils/audioSource";
import { getOrCreateElementGraph } from "@/utils/audioElementGraph";

const STALL_TIMEOUT_MS = 8000;

export default function AudioPlayer({
  activeTrack,
  isPlaying,
  volume,
  seekTime,
  onTimeUpdate,
  onDurationChange,
  onEnded,
  onLyricsParsed,
  onBufferingChange,
  isRepeat = false,
  reloadKey = 0,
  elementRef = null,
}) {
  const audioRef = useRef(null);
  const loadTokenRef = useRef(0);
  const loadedTrackIdRef = useRef(null);
  const stallTimerRef = useRef(null);
  const lastProgressRef = useRef(0);
  const pendingSeekRef = useRef(null);

  const latestPropsRef = useRef({ seekTime, isPlaying });
  latestPropsRef.current = { seekTime, isPlaying };

  const clearStallTimer = useCallback(() => {
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
  }, []);

  const startStallTimer = useCallback((audio) => {
    clearStallTimer();
    stallTimerRef.current = setTimeout(() => {
      if (audio && audio.readyState > 0 && !audio.paused && audio.currentTime === lastProgressRef.current) {
        console.warn("[AudioPlayer] Playback stalled, attempting recovery...");
        audio.play().catch(() => {});
      }
    }, STALL_TIMEOUT_MS);
  }, [clearStallTimer]);

  const updateStallTimer = useCallback((audio) => {
    if (audio && audio.readyState > 0 && !audio.paused) {
      const current = audio.currentTime;
      if (current > lastProgressRef.current) {
        lastProgressRef.current = current;
        startStallTimer(audio);
      }
    }
  }, [startStallTimer]);

  useEffect(() => {
    let isMounted = true;
    const token = ++loadTokenRef.current;

    async function loadAudioSource() {
      if (!audioRef.current || !activeTrack) return;
      const audio = audioRef.current;

      const driveId =
        activeTrack.driveFileId ||
        activeTrack.drive_file_id ||
        activeTrack.drive_id;

      let audioUrl = activeTrack.url || activeTrack.src;

      if (!audioUrl && driveId) {
        try {
          audioUrl = await getStreamTrackUrl(driveId, activeTrack);
        } catch (err) {
          console.error("[AudioPlayer] Failed to get stream URL:", err);
          if (isMounted && loadTokenRef.current === token) {
            onBufferingChange?.(false);
          }
          return;
        }
      }

      if (!audioUrl || !isMounted || loadTokenRef.current !== token) return;

      audio.src = audioUrl;
      audio.load();
      loadedTrackIdRef.current = activeTrack?.id || null;
      lastProgressRef.current = 0;
      onBufferingChange?.(true);
      if (onDurationChange) onDurationChange(0);

      const { seekTime: pendingSeek, isPlaying: shouldPlay } = latestPropsRef.current;
      if (typeof pendingSeek === "number" && !isNaN(pendingSeek) && pendingSeek > 0) {
        pendingSeekRef.current = pendingSeek;
        try {
          audio.currentTime = pendingSeek;
        } catch {}
      }

      if (shouldPlay) {
        try {
          const g = getOrCreateElementGraph(audio);
          if (g?.ctx?.state === "suspended") {
            g.ctx.resume().catch(() => {});
          }
        } catch {}
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            if (err.name !== "AbortError" && isMounted && loadTokenRef.current === token) {
              console.error("[AudioPlayer] Playback start error:", err);
            }
          });
        }
      }
    }

    loadAudioSource();

    return () => {
      isMounted = false;
      clearStallTimer();
    };
  }, [activeTrack, reloadKey, onDurationChange, clearStallTimer, startStallTimer, onBufferingChange]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;

    if (isPlaying) {
      if (loadedTrackIdRef.current !== activeTrack?.id) return;
      try {
        const g = getOrCreateElementGraph(audio);
        if (g?.ctx?.state === "suspended") {
          g.ctx.resume().catch(() => {});
        }
      } catch {}
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          if (err.name !== "AbortError") {
            console.error("[AudioPlayer] Play error:", err);
            onBufferingChange?.(false);
          }
        });
      }
      startStallTimer(audio);
    } else {
      clearStallTimer();
      if (onTimeUpdate && audio && audio.readyState > 0) {
        try {
          onTimeUpdate(audio.currentTime);
        } catch (err) {
          if (err.name === "ReferenceError" && err.message.includes("EmptyRanges")) {
            console.warn("WebKit EmptyRanges bug caught on pause, ignoring.");
          } else {
            console.error("[AudioPlayer] pause timeUpdate error:", err);
          }
        }
      }
      audio.pause();
    }
  }, [isPlaying, activeTrack?.id, onTimeUpdate, clearStallTimer, startStallTimer, onBufferingChange]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || typeof seekTime !== "number" || isNaN(seekTime)) return;
    if (Math.abs(audio.currentTime - seekTime) <= 0.3) return;

    if (audio.readyState > 0) {
      pendingSeekRef.current = null;
      try {
        if (typeof audio.fastSeek === "function") {
          audio.fastSeek(seekTime);
        } else {
          audio.currentTime = seekTime;
        }
      } catch {
        audio.currentTime = seekTime;
      }
    } else {
      pendingSeekRef.current = seekTime;
    }
  }, [seekTime]);

  useEffect(() => {
    const rawLyrics =
      activeTrack?.synced_lyrics ||
      activeTrack?.syncedLyrics ||
      activeTrack?.lyrics ||
      activeTrack?.track_lyrics?.synced_lyrics ||
      activeTrack?.track_lyrics?.[0]?.synced_lyrics ||
      "";

    const parsed = parseLRC(rawLyrics);
    if (onLyricsParsed) {
      onLyricsParsed(parsed);
    }
  }, [activeTrack, onLyricsParsed]);

  const isRepeatRef = useRef(isRepeat);
  isRepeatRef.current = isRepeat;

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !onTimeUpdate) return;
    try {
      onTimeUpdate(audio.currentTime);
      updateStallTimer(audio);
    } catch (err) {
      if (err.name === "ReferenceError" && err.message.includes("EmptyRanges")) {
        console.warn("WebKit EmptyRanges bug caught, ignoring.");
      } else {
        console.error("[AudioPlayer] timeUpdate error:", err);
      }
    }
  }, [onTimeUpdate, updateStallTimer]);

  const handleWaiting = useCallback(() => {
    onBufferingChange?.(true);
  }, [onBufferingChange]);

  const handleCanPlay = useCallback(() => {
    onBufferingChange?.(false);
    const audio = audioRef.current;
    if (audio && pendingSeekRef.current !== null && audio.readyState > 0) {
      const target = pendingSeekRef.current;
      pendingSeekRef.current = null;
      try {
        if (typeof audio.fastSeek === "function") {
          audio.fastSeek(target);
        } else {
          audio.currentTime = target;
        }
      } catch {
        audio.currentTime = target;
      }
    }
  }, [onBufferingChange]);

  const handleSeeking = useCallback(() => {
    onBufferingChange?.(true);
  }, [onBufferingChange]);

  const handleSeeked = useCallback(() => {
    onBufferingChange?.(false);
    const audio = audioRef.current;
    if (audio) updateStallTimer(audio);
  }, [onBufferingChange, updateStallTimer]);

  const handleEnded = useCallback(() => {
    clearStallTimer();
    if (isRepeatRef.current && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((err) => {
        if (err.name !== "AbortError") console.error("[AudioPlayer] Repeat play error:", err);
      });
      if (onTimeUpdate) onTimeUpdate(0);
      return;
    }
    if (onEnded) onEnded();
  }, [onTimeUpdate, onEnded, clearStallTimer]);

  return (
    <audio
      ref={(el) => {
        audioRef.current = el;
        if (elementRef) elementRef.current = el;
      }}
      crossOrigin="anonymous"
      onTimeUpdate={handleTimeUpdate}
      onLoadedMetadata={() => {
        if (audioRef.current) {
          if (onDurationChange) {
            onDurationChange(audioRef.current.duration);
          }
          if (pendingSeekRef.current !== null) {
            const target = pendingSeekRef.current;
            pendingSeekRef.current = null;
            try {
              audioRef.current.currentTime = target;
            } catch {}
          }
        }
      }}
      onDurationChange={() => {
        if (audioRef.current && onDurationChange) {
          onDurationChange(audioRef.current.duration);
        }
      }}
      onEnded={handleEnded}
      onWaiting={handleWaiting}
      onCanPlay={handleCanPlay}
      onSeeking={handleSeeking}
      onSeeked={handleSeeked}
      onError={(e) => {
        const audio = e.target;
        console.error("[AudioPlayer] Audio error:", audio.error?.message || audio.error?.code);
        onBufferingChange?.(false);
        clearStallTimer();
      }}
      preload="auto"
      className="hidden"
    />
  );
}
