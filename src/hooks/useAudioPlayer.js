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


export function useAudioPlayer({ onEnded } = {}) {
  const audioRef = useRef(null);
  const loadTokenRef = useRef(0);
  const blobUrlRef = useRef(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

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
      onEndedRef.current?.();
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
  }, []);

  const resolveTrackUrl = useCallback(async (track) => {
    const direct = track.url || track.src;
    if (direct) return direct;
    const driveId =
      track.driveFileId || track.drive_file_id || track.drive_id;
    if (!driveId) throw new Error("No audio source available for this track.");


    return fetchDriveBlobUrl(driveId);
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


      if (loadTokenRef.current !== myToken) {
        if (url !== track.url && url !== track.src) {
          URL.revokeObjectURL(url);
        }
        return;
      }

      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = url;
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
      } catch (err) {


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