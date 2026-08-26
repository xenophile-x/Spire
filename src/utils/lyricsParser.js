const TIME_TAG_REGEX = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
const METADATA_TAG_REGEX = /\[[a-z]+:[^\]]*\]/gi;

export function parseLRC(lrcString) {
  if (!lrcString || typeof lrcString !== "string") return [];

  const lines = lrcString.split("\n");
  const parsed = [];
  let offsetMs = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;


    const offsetMatch = /^\[offset:\s*([+-]?\d+)\s*\]$/i.exec(line);
    if (offsetMatch) {
      offsetMs = parseInt(offsetMatch[1], 10) || 0;
      continue;
    }


    if (/^\[[a-z]+:/.test(line)) continue;

    const tags = [];
    let match;
    TIME_TAG_REGEX.lastIndex = 0;
    while ((match = TIME_TAG_REGEX.exec(line)) !== null) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const fraction = match[3] ? parseInt(match[3].padEnd(3, "0"), 10) : 0;
      tags.push(minutes * 60 + seconds + fraction / 1000);
    }

    if (tags.length === 0) continue;


    const text = line.replace(TIME_TAG_REGEX, "").replace(METADATA_TAG_REGEX, "").trim();
    if (!text) continue;

    const offsetSeconds = offsetMs / 1000;
    for (const time of tags) {
      parsed.push({ time: Math.max(0, time + offsetSeconds), text });
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