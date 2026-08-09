

export function parseLRC(lrcString) {
  if (!lrcString || typeof lrcString !== "string") return [];

  const lines = lrcString.split("\n");
  const parsed = [];

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

      if (text) {
        parsed.push({
          time: totalTimeSeconds,
          text: text,
        });
      }
    }
  }

  return parsed.sort((a, b) => a.time - b.time);
}

export function getActiveLyricIndex(lyricsArray, currentTime) {
  if (!lyricsArray || lyricsArray.length === 0) return -1;

  for (let i = lyricsArray.length - 1; i >= 0; i--) {
    if (currentTime >= lyricsArray[i].time) {
      return i;
    }
  }

  return -1;
}