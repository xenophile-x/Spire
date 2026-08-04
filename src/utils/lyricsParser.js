// src/utils/lyricsParser.js

/**
 * Parses standard LRC format strings into array of timestamped objects
 * Example line: "[00:14.25] Line text here"
 */
export function parseLRC(lrcString) {
  if (!lrcString || typeof lrcString !== "string") return [];

  const lines = lrcString.split("\n");
  const parsed = [];

  // Match timestamps like [mm:ss.xx] or [mm:ss.xxx]
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = timeRegex.exec(trimmed);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const milliseconds = parseInt(match[3].padEnd(3, "0"), 10);

      const totalTimeSeconds = minutes * 60 + seconds + milliseconds / 1000;
      const text = trimmed.replace(timeRegex, "").trim();

      // Only include lines that actually have lyric text
      if (text) {
        parsed.push({
          time: totalTimeSeconds,
          text: text,
        });
      }
    }
  }

  // Ensure lyrics are sorted chronologically
  return parsed.sort((a, b) => a.time - b.time);
}

/**
 * Finds the current active lyric index based on audio playback position
 */
export function getActiveLyricIndex(lyricsArray, currentTime) {
  if (!lyricsArray || lyricsArray.length === 0) return -1;

  for (let i = lyricsArray.length - 1; i >= 0; i--) {
    if (currentTime >= lyricsArray[i].time) {
      return i;
    }
  }

  return -1;
}