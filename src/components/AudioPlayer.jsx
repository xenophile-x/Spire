import React, { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { parseLRC } from "@/utils/lyricsParser";

async function fetchDriveAudio(driveId, googleAccessToken, supabaseAccessToken) {


  if (googleAccessToken) {
    try {
      const directResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${driveId}?alt=media`,
        { headers: { Authorization: `Bearer ${googleAccessToken}` } }
      );
      if (directResponse.ok) return await directResponse.blob();
      console.warn(
        `[AudioPlayer] Direct Drive fetch blocked (${directResponse.status}) — falling back to proxy...`
      );
    } catch (err) {
      console.warn("[AudioPlayer] Direct Drive fetch failed:", err);
    }
  }


  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl) throw new Error("VITE_SUPABASE_URL not set");
  const headers = {};
  if (supabaseAccessToken) headers.Authorization = `Bearer ${supabaseAccessToken}`;
  if (supabaseAnonKey) headers.apikey = supabaseAnonKey;
  const response = await fetch(
    `${supabaseUrl}/functions/v1/stream-track?trackId=${encodeURIComponent(driveId)}`,
    { headers }
  );
  if (!response.ok) throw new Error(`Proxy error: ${response.status}`);
  return await response.blob();
}

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
  const blobUrlRef = useRef(null);

  const latestPropsRef = useRef({ seekTime, isPlaying });
  latestPropsRef.current = { seekTime, isPlaying };

  useEffect(() => {
    let isMounted = true;
    let currentBlobUrl = null;
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
          let googleToken = "";
          let accessToken = "";
          try {
            const { data: { session } } = await supabase.auth.getSession();


            googleToken = session?.provider_token || "";
            accessToken = session?.access_token || "";
          } catch {
            accessToken = "";
          }
          const audioBlob = await fetchDriveAudio(driveId, googleToken, accessToken);
          currentBlobUrl = URL.createObjectURL(audioBlob);
          audioUrl = currentBlobUrl;
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

      if (blobUrlRef.current && blobUrlRef.current !== currentBlobUrl) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
      blobUrlRef.current = currentBlobUrl;

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
      if (currentBlobUrl && blobUrlRef.current !== currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [activeTrack, reloadKey, onDurationChange]);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

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
      if (onTimeUpdate && audioRef.current) {
        onTimeUpdate(audioRef.current.currentTime);
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
      onTimeUpdate={() => {
        if (audioRef.current && onTimeUpdate) {
          onTimeUpdate(audioRef.current.currentTime);
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
