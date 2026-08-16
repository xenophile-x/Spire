import { useState, useEffect, useRef, useCallback } from "react";
import { getValidDriveToken } from "@/utils/driveApi";

async function fetchDriveBlobUrl(driveId) {
  const valid = await getValidDriveToken();
  if (!valid) throw new Error("No Drive token available.");
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${driveId}?alt=media`,
    { headers: { Authorization: `Bearer ${valid}` } }
  );
  if (response.status === 401) {
    const { refreshDriveAccessToken } = await import("@/utils/driveApi");
    const fresh = await refreshDriveAccessToken();
    if (!fresh) throw new Error("Drive token refresh failed.");
    const retry = await fetch(
      `https://www.googleapis.com/drive/v3/files/${driveId}?alt=media`,
      { headers: { Authorization: `Bearer ${fresh}` } }
    );
    if (!retry.ok) throw new Error(`Drive fetch error: ${retry.status}`);
    return createAudioBlobUrl(await retry.blob());
  }
  if (!response.ok) throw new Error(`Drive fetch error: ${response.status}`);
  return createAudioBlobUrl(await response.blob());
}

function createAudioBlobUrl(rawBlob) {
  const mimeType =
    rawBlob.type && rawBlob.type !== "application/octet-stream"
      ? rawBlob.type
      : "audio/mpeg";
  const audioBlob =
    rawBlob.type === mimeType ? rawBlob : new Blob([rawBlob], { type: mimeType });
  return URL.createObjectURL(audioBlob);
}

/**
 * Single playback choke point. Every playback start — new song click, station
 * click, next/previous — routes through loadAndPlay(), which guarantees
 * "stop current → wait → load → play" instead of overlapping audio.
 */
export function useAudioPlayer({ onEnded } = {}) {
  const audioRef = useRef(null);
  const loadTokenRef = useRef(0); // bumped on every new load — stale callbacks check against this
  const blobUrlRef = useRef(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const handleEnded = () => {
      setIsPlaying(false);
      onEnded?.();
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.pause();
      audio.src = "";
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, [onEnded]);

  const resolveTrackUrl = useCallback(async (track) => {
    const direct = track.url || track.src;
    if (direct) return direct;
    const driveId =
      track.driveFileId || track.drive_file_id || track.drive_id;
    if (!driveId) throw new Error("No audio source available for this track.");
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    blobUrlRef.current = await fetchDriveBlobUrl(driveId);
    return blobUrlRef.current;
  }, []);

  /**
   * Stop whatever's playing, load a new source, and play it.
   * Rapid repeated calls are safe — only the LATEST call actually
   * finishes; every earlier in-flight call quietly bails out.
   */
  const loadAndPlay = useCallback(
    async (track, { seekTo = 0 } = {}) => {
      const audio = audioRef.current;
      if (!audio || !track) return;

      const myToken = ++loadTokenRef.current;

      // Silence the old track immediately — no overlap while new one loads
      audio.pause();
      setIsPlaying(false);
      setIsLoading(true);
      setCurrentTime(seekTo);
      setDuration(0);

      let url;
      try {
        url = await resolveTrackUrl(track);
      } catch (err) {
        if (loadTokenRef.current === myToken) {
          console.error("[AudioPlayer] Failed to resolve audio source:", err);
          setIsLoading(false);
        }
        return;
      }

      // A newer load call started while we were waiting — this one is stale, drop it
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

        // A newer load call started while we were waiting — this one is stale, drop it
        if (loadTokenRef.current !== myToken) return;

        if (seekTo > 0) audio.currentTime = seekTo;
        await audio.play();
      } catch (err) {
        // AbortError fires when play() gets interrupted by the next pause() —
        // expected during fast switching, not a real failure
        if (err?.name !== "AbortError" && loadTokenRef.current === myToken) {
          console.error("[AudioPlayer] Playback failed:", err);
        }
      } finally {
        if (loadTokenRef.current === myToken) setIsLoading(false);
      }
    },
    [resolveTrackUrl]
  );

  const pause = useCallback(() => audioRef.current?.pause(), []);
  const resume = useCallback(async () => {
    try {
      await audioRef.current?.play();
    } catch (err) {
      if (err?.name !== "AbortError") console.error(err);
    }
  }, []);
  const seek = useCallback((t) => {
    if (audioRef.current) audioRef.current.currentTime = t;
  }, []);

  return {
    isLoading,
    isPlaying,
    currentTime,
    duration,
    loadAndPlay,
    pause,
    resume,
    seek,
  };
}