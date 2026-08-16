function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function seededShuffle(array, seed) {
  const result = [...array];
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function buildStationQueue(station, userTracks) {
  const withDuration = userTracks
    .filter((t) => (t.duration_seconds || t.duration) > 0)
    .sort((a, b) => String(a.id).localeCompare(String(b.id))); // stable order regardless of fetch order

  const genreMatched = station.genre
    ? withDuration.filter(
        (t) => (t.genre || t.primary_genre || "").toLowerCase() === station.genre.toLowerCase()
      )
    : [];

  const pool = genreMatched.length > 0 ? genreMatched : withDuration;
  return seededShuffle(pool, hashString(station.id));
}