import { useState, useEffect, useRef, useCallback } from "react";
import { getStreamTrackUrl } from "@/utils/audioSource";

const STALL_TIMEOUT_MS = 8000;

export function useAudioPlayer({ onEnded } = {}) {
  const audioRef = useRef(null);
  const loadTokenRef = useRef(0);
  const stallTimerRef = useRef(null);
  const lastProgressRef = useRef(0);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;

    const onTimeUpdate = () => {
      if (audio.readyState === 0) return;
      try {
        setCurrentTime(audio.currentTime);
        lastProgressRef.current = audio.currentTime;
      } catch (err) {
        if (err.name === "ReferenceError" && err.message.includes("EmptyRanges")) {
          console.warn("WebKit EmptyRanges bug caught, ignoring.");
        } else {
          console.error("[useAudioPlayer] timeUpdate error:", err);
        }
      }
    };
    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const handleEnded = () => {
      setIsPlaying(false);
      onEndedRef.current?.();
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);
    const onError = (e) => {
      const audioErr = e.target.error;
      console.error("[useAudioPlayer] Audio error:", audioErr?.message || audioErr?.code);
      setError(audioErr?.message || "Playback error");
      setIsLoading(false);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("error", onError);
      audio.pause();
      audio.src = "";
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    };
  }, []);

  const startStallTimer = useCallback((audio) => {
    if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    stallTimerRef.current = setTimeout(() => {
      if (audio && audio.readyState > 0 && !audio.paused && audio.currentTime === lastProgressRef.current) {
        console.warn("[useAudioPlayer] Playback stalled, attempting recovery...");
        audio.load();
        setIsLoading(true);
      }
    }, STALL_TIMEOUT_MS);
  }, []);

  const loadAndPlay = useCallback(
    async (track, { seekTo = 0 } = {}) => {
      const audio = audioRef.current;
      if (!audio || !track) return;

      const myToken = ++loadTokenRef.current;

      audio.pause();
      setIsPlaying(false);
      setIsLoading(true);
      setCurrentTime(seekTo);
      setDuration(0);
      setError(null);

      const driveId =
        track.driveFileId || track.drive_file_id || track.drive_id;
      const direct = track.url || track.src;

      let url;
      try {
        if (direct) {
          url = direct;
        } else if (driveId) {
          url = await getStreamTrackUrl(driveId);
        } else {
          throw new Error("No audio source available for this track.");
        }
      } catch (err) {
        if (loadTokenRef.current === myToken) {
          console.error("[AudioPlayer] Failed to resolve audio source:", err);
          setError(err.message);
          setIsLoading(false);
        }
        return;
      }

      if (loadTokenRef.current !== myToken) return;

      audio.src = url;
      audio.load();

      const waitUntilReady = () =>
        new Promise((resolve, reject) => {
          const onCanPlay = () => {
            cleanup();
            resolve();
          };
          const onError = () => {
            cleanup();
            reject(new Error("Audio load failed"));
          };
          const cleanup = () => {
            audio.removeEventListener("canplay", onCanPlay);
            audio.removeEventListener("error", onError);
          };
          audio.addEventListener("canplay", onCanPlay);
          audio.addEventListener("error", onError);
        });

      try {
        await waitUntilReady();

        if (loadTokenRef.current !== myToken) return;

        if (seekTo > 0) audio.currentTime = seekTo;
        await audio.play();
        startStallTimer(audio);
      } catch (err) {
        if (err?.name !== "AbortError" && loadTokenRef.current === myToken) {
          console.error("[AudioPlayer] Playback failed:", err);
          setError(err.message);
        }
      } finally {
        if (loadTokenRef.current === myToken) setIsLoading(false);
      }
    },
    [startStallTimer]
  );

  const pause = useCallback(() => audioRef.current?.pause(), []);
  const resume = useCallback(async () => {
    try {
      const audio = audioRef.current;
      await audio?.play();
      if (audio) startStallTimer(audio);
    } catch (err) {
      if (err?.name !== "AbortError") console.error(err);
    }
  }, [startStallTimer]);
  const seek = useCallback((t) => {
    if (audioRef.current) audioRef.current.currentTime = t;
  }, []);

  return {
    isLoading,
    isPlaying,
    currentTime,
    duration,
    error,
    loadAndPlay,
    pause,
    resume,
    seek,
  };
}