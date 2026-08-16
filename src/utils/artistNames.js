export function splitArtistNames(artistString = "") {
  const raw = String(artistString).trim();
  if (!raw) return [];

  const parts = raw
    .split(
      /\s*(?:,|;|&|&amp;| x | vs\.?| with | and | feat\.| ft\.| featuring| duet(?: with)?)\s*/i
    )
    .map((p) => p.trim())
    .filter(Boolean);

  return [...new Set(parts)];
}

export function trackMatchesArtist(track, artistName) {
  const name = (artistName || "").trim().toLowerCase();
  if (!name) return false;
  const full = (track?.artist || "").trim().toLowerCase();
  if (!full) return false;
  if (full === name) return true;
  return splitArtistNames(track.artist).some(
    (n) => n.toLowerCase() === name
  );
}
