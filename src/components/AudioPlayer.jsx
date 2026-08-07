import React, { useEffect, useRef } from "react";

// Helper to parse standard LRC string into timestamped lines
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
  onRefreshToken,
}) {
  const audioRef = useRef(null);
  const isPlayingRef = useRef(isPlaying);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // 1. Fetch Google Drive file & generate Blob URL safely
  useEffect(() => {
    let isMounted = true;
    let currentBlobUrl = null;

    async function loadAudioSource() {
      if (!audioRef.current || !activeTrack) return;

      // Unify property name check for camelCase or snake_case
      const driveId =
        activeTrack.driveFileId ||
        activeTrack.drive_file_id ||
        activeTrack.drive_id;

        let audioUrl = activeTrack.url || activeTrack.src;

        // Fetch from Google Drive API with OAuth token if drive ID is present
        if (!audioUrl && driveId) {
          if (!googleAccessToken) {
            console.error("Google Access Token missing. Cannot play track from Drive.");
            return;
          }

          let token = googleAccessToken;
          let response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${driveId}?alt=media`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          console.log("[AudioPlayer] Drive fetch status:", response.status, response.statusText);

          if (response.status === 401 && onRefreshToken) {
            const newToken = await onRefreshToken();
            if (newToken) {
              token = newToken;
              response = await fetch(
                `https://www.googleapis.com/drive/v3/files/${driveId}?alt=media`,
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                }
              );
              console.log("[AudioPlayer] Retry after token refresh status:", response.status, response.statusText);
            }
          }

          if (!response.ok) {
            throw new Error(`Drive fetch error: ${response.status} ${response.statusText}`);
          }

          try {
            const rawBlob = await response.blob();
            const contentType = response.headers.get("content-type");
            console.log("[AudioPlayer] Drive response OK, blob size:", rawBlob.size, "type:", rawBlob.type, "content-type:", contentType);
            const mimeType = contentType || rawBlob.type || "audio/mpeg";
            const audioBlob = new Blob([rawBlob], { type: mimeType });
            console.log("[AudioPlayer] Created audioBlob size:", audioBlob.size, "type:", audioBlob.type);
            currentBlobUrl = URL.createObjectURL(audioBlob);
            audioUrl = currentBlobUrl;
          } catch (err) {
            console.error("Failed to read audio file from Google Drive:", err);
            return;
          }
        }

      if (audioUrl && isMounted) {
        audioRef.current.src = audioUrl;
        audioRef.current.load();

        if (isPlayingRef.current) {
          audioRef.current.play().catch((err) => {
            if (err.name !== "AbortError") {
              console.error("Playback start error:", err);
            }
          });
        }
      }
    }

    loadAudioSource();

    return () => {
      isMounted = false;
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl); // Cleanup memory
      }
    };
  }, [
    activeTrack?.id,
    activeTrack?.driveFileId,
    activeTrack?.drive_file_id,
    googleAccessToken,
  ]);

  // 2. Play / Pause Control — re-run when track loads so playback starts after src is ready
  useEffect(() => {
    if (!audioRef.current || !audioRef.current.src) return;

    if (isPlaying) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          if (err.name !== "AbortError") {
            console.error("Play error:", err);
          }
        });
      }
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, activeTrack?.id]);

  // 3. Volume Control
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  // 4. Time Seeking
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

  // 5. Sync & Parse Lyrics
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
          console.log("[AudioPlayer] Audio loaded, duration:", audioRef.current.duration);
          onDurationChange(audioRef.current.duration);
        }
      }}
      onEnded={onEnded}
      onError={(e) => {
        console.error("[AudioPlayer] Audio element error:", e);
      }}
      preload="auto"
      className="hidden"
    />
  );
}