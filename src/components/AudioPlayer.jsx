import React, { useEffect, useRef } from "react";
import { parseLRC } from "@/utils/lyricsParser";
import { getStreamTrackUrl } from "@/utils/audioSource";

export default function AudioPlayer({
  activeTrack,
  isPlaying,
  volume,
  seekTime,
  onTimeUpdate,
  onDurationChange,
  onEnded,
  onLyricsParsed,
  isRepeat = false,
  reloadKey = 0,
  elementRef = null,
}) {
  const audioRef = useRef(null);
  const loadTokenRef = useRef(0);
  const loadedTrackIdRef = useRef(null);

  const latestPropsRef = useRef({ seekTime, isPlaying });
  latestPropsRef.current = { seekTime, isPlaying };

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
          audioUrl = await getStreamTrackUrl(driveId);
        } catch (err) {
          console.error("[AudioPlayer] Failed to read audio file from Google Drive proxy:", err);
          return;
        }
      }

      if (!audioUrl || !isMounted || loadTokenRef.current !== token) return;

      audio.src = audioUrl;
      audio.load();
      loadedTrackIdRef.current = activeTrack?.id || null;
      if (onDurationChange) onDurationChange(0);

      const waitForReady = () =>
        new Promise((resolve, reject) => {
          const onReady = () => {
            cleanup();
            resolve();
          };
          const onError = () => {
            cleanup();
            reject(new Error("Audio source failed to load"));
          };
          const cleanup = () => {
            audio.removeEventListener("canplay", onReady);
            audio.removeEventListener("error", onError);
          };
          audio.addEventListener("canplay", onReady);
          audio.addEventListener("error", onError);
        });

      try {
        await waitForReady();
      } catch (err) {
        if (isMounted && loadTokenRef.current === token) {
          console.error("[AudioPlayer] Source failed to load:", err);
        }
        return;
      }

      if (!isMounted || loadTokenRef.current !== token) return;

      const { seekTime: pendingSeek, isPlaying: shouldPlay } = latestPropsRef.current;
      if (typeof pendingSeek === "number" && !isNaN(pendingSeek) && pendingSeek > 0) {
        try {
          audio.currentTime = pendingSeek;
        } catch {}
      }

      if (shouldPlay) {
        audio.play().catch((err) => {
          if (err.name !== "AbortError") {
            console.error("[AudioPlayer] Playback start error:", err);
          }
        });
      }
    }

    loadAudioSource();

    return () => {
      isMounted = false;
    };
  }, [activeTrack, reloadKey, onDurationChange]);

  useEffect(() => {
    if (!audioRef.current || !audioRef.current.src) return;

    if (isPlaying) {
      if (loadedTrackIdRef.current !== activeTrack?.id) return;
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          if (err.name !== "AbortError") {
            console.error("[AudioPlayer] Play error:", err);
          }
        });
      }
    } else {
      if (onTimeUpdate && audioRef.current && audioRef.current.readyState > 0) {
        try {
          onTimeUpdate(audioRef.current.currentTime);
        } catch (err) {
          if (err.name === "ReferenceError" && err.message.includes("EmptyRanges")) {
            console.warn("WebKit EmptyRanges bug caught on pause, ignoring.");
          } else {
            console.error("[AudioPlayer] pause timeUpdate error:", err);
          }
        }
      }
      audioRef.current.pause();
    }
  }, [isPlaying, activeTrack?.id, onTimeUpdate]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  useEffect(() => {
    if (
      audioRef.current &&
      typeof seekTime === "number" &&
      !isNaN(seekTime) &&
      Math.abs(audioRef.current.currentTime - seekTime) > 0.3
    ) {
      audioRef.current.currentTime = seekTime;
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

  const handleEnded = () => {
    if (isRepeatRef.current && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((err) => {
        if (err.name !== "AbortError") console.error("[AudioPlayer] Repeat play error:", err);
      });
      if (onTimeUpdate) onTimeUpdate(0);
      return;
    }
    if (onEnded) onEnded();
  };

  return (
      <audio
        ref={(el) => {
          audioRef.current = el;
          if (elementRef) elementRef.current = el;
        }}
        crossOrigin="anonymous"
      onTimeUpdate={() => {
        if (!audioRef.current || !onTimeUpdate) return;
        if (audioRef.current.readyState === 0) return;
        try {
          onTimeUpdate(audioRef.current.currentTime);
        } catch (err) {
          if (err.name === "ReferenceError" && err.message.includes("EmptyRanges")) {
            console.warn("WebKit EmptyRanges bug caught, ignoring.");
          } else {
            console.error("[AudioPlayer] timeUpdate error:", err);
          }
        }
      }}
      onLoadedMetadata={() => {
        if (audioRef.current && onDurationChange) {
          onDurationChange(audioRef.current.duration);
        }
      }}
      onEnded={handleEnded}
      preload="auto"
      className="hidden"
    />
  );
}
