import React, { useEffect, useRef } from "react";
import { getValidDriveToken } from "@/utils/driveApi";

export function parseLRC(lrcString) {
  if (!lrcString || typeof lrcString !== "string") return [];
  const lines = lrcString.split("\n");
  const result = [];
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

  for (const line of lines) {
    const match = timeRegex.exec(line);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const millis = parseInt(match[3].padEnd(3, "0"), 10);
      const time = minutes * 60 + seconds + millis / 1000;
      const text = line.replace(timeRegex, "").trim();
      if (text) {
        result.push({ time, text });
      }
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

async function fetchDriveAudio(driveId, token) {
  const valid = (await getValidDriveToken()) || token;
  if (!valid) throw new Error("No Drive token available.");
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${driveId}?alt=media`,
    { headers: { Authorization: `Bearer ${valid}` } }
  );
  return response;
}

export default function AudioPlayer({
  activeTrack,
  googleAccessToken,
  isPlaying,
  volume,
  seekTime,
  onTimeUpdate,
  onDurationChange,
  onEnded,
  onLyricsParsed,
  isRepeat = false,
  onRefreshToken, // now actually used
}) {
  const audioRef = useRef(null);
  // Bumped on every new load request — stale async steps check their token and bail.
  const loadTokenRef = useRef(0);
  // Which track id the <audio> element currently holds; lets the play/pause
  // effect avoid calling play() on a stale source while a new one loads.
  const loadedTrackIdRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    let currentBlobUrl = null;
    const token = ++loadTokenRef.current;

    // Silence whatever was playing immediately — no overlap while the new
    // source loads.
    if (audioRef.current) audioRef.current.pause();

    async function loadAudioSource() {
      if (!audioRef.current || !activeTrack) return;

      const driveId =
        activeTrack.driveFileId ||
        activeTrack.drive_file_id ||
        activeTrack.drive_id;

      let audioUrl = activeTrack.url || activeTrack.src;

      if (!audioUrl && driveId) {
        if (!googleAccessToken) {
          console.error("[AudioPlayer] Google Access Token missing. Cannot play track from Drive.");
          return;
        }

        try {
          let response = await fetchDriveAudio(driveId, googleAccessToken);

          // Token expired — refresh once and retry automatically
          if (response.status === 401) {
            console.warn("[AudioPlayer] Token expired (401). Attempting refresh...");
            if (typeof onRefreshToken === "function") {
              const freshToken = await onRefreshToken();
              if (freshToken) {
                response = await fetchDriveAudio(driveId, freshToken);
              }
            }
          }

          if (!response.ok) {
            throw new Error(`Drive fetch error: ${response.status} ${response.statusText}`);
          }

          // A newer track was requested while we were fetching — this load is stale.
          if (!isMounted || loadTokenRef.current !== token) return;

          const rawBlob = await response.blob();
          const mimeType =
            rawBlob.type && rawBlob.type !== "application/octet-stream"
              ? rawBlob.type
              : "audio/mpeg";
          const audioBlob =
            rawBlob.type === mimeType ? rawBlob : new Blob([rawBlob], { type: mimeType });

          currentBlobUrl = URL.createObjectURL(audioBlob);
          audioUrl = currentBlobUrl;
        } catch (err) {
          console.error("[AudioPlayer] Failed to read audio file from Google Drive:", err);
          return;
        }
      }

      if (!audioUrl || !isMounted || loadTokenRef.current !== token) return;

      audioRef.current.src = audioUrl;
      audioRef.current.load();
      loadedTrackIdRef.current = activeTrack?.id || null;

      const waitForReady = () =>
        new Promise((resolve) => {
          const audio = audioRef.current;
          const onReady = () => {
            cleanup();
            resolve();
          };
          const onError = () => {
            cleanup();
            resolve();
          };
          const cleanup = () => {
            audio.removeEventListener("canplay", onReady);
            audio.removeEventListener("error", onError);
          };
          audio.addEventListener("canplay", onReady);
          audio.addEventListener("error", onError);
        });

      waitForReady().then(() => {
        // This load got superseded — discard it silently.
        if (!isMounted || loadTokenRef.current !== token) return;

        // Apply a pending seek (radio live-resume) once the track is ready.
        if (typeof seekTime === "number" && !isNaN(seekTime) && seekTime > 0) {
          try {
            audioRef.current.currentTime = seekTime;
          } catch {
            /* seek can throw before metadata is fully ready — ignore */
          }
        }

        if (isPlaying) {
          audioRef.current.play().catch((err) => {
            if (err.name !== "AbortError") {
              console.error("[AudioPlayer] Playback start error:", err);
            }
          });
        }
      });
    }

    loadAudioSource();

    return () => {
      isMounted = false;
      if (currentBlobUrl) {
        const url = currentBlobUrl;
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 10000);
      }
    };
  }, [
    activeTrack?.id,
    activeTrack?.driveFileId,
    activeTrack?.drive_file_id,
    googleAccessToken,
  ]);

  useEffect(() => {
    if (!audioRef.current || !audioRef.current.src) return;

    if (isPlaying) {
      // Only play if the element is actually holding the requested track —
      // otherwise the load effect will play it once ready (load-token guarded).
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

  const handleEnded = () => {
    if (isRepeat && audioRef.current) {
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
      ref={audioRef}
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