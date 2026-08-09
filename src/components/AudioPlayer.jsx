import React, { useEffect, useRef } from "react";

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
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${driveId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
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
  onRefreshToken, // now actually used
}) {
  const audioRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    let currentBlobUrl = null;

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

      if (audioUrl && isMounted) {
        audioRef.current.src = audioUrl;
        audioRef.current.load();

        if (isPlaying) {
          audioRef.current.play().catch((err) => {
            if (err.name !== "AbortError") {
              console.error("[AudioPlayer] Playback start error:", err);
            }
          });
        }
      }
    }

    loadAudioSource();

    return () => {
      isMounted = false;
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
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
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          if (err.name !== "AbortError") {
            console.error("[AudioPlayer] Play error:", err);
          }
        });
      }
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying]);

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
      onEnded={onEnded}
      preload="auto"
      className="hidden"
    />
  );
}