// src/utils/recommend.js

/**
 * Calculates similarity score (0.0 to 1.0) between two tracks.
 */
export function calculateTrackAffinity(trackA, trackB) {
  if (!trackA || !trackB) return 0;
  let score = 0;

  // Normalize property names (handle canonical_artist / artist & primary_genre / genre)
  const genreA = (trackA.primary_genre || trackA.genre || "").toLowerCase();
  const genreB = (trackB.primary_genre || trackB.genre || "").toLowerCase();

  const artistA = (trackA.canonical_artist || trackA.artist || "").toLowerCase();
  const artistB = (trackB.canonical_artist || trackB.artist || "").toLowerCase();

  const yearA = trackA.release_year || trackA.releaseYear;
  const yearB = trackB.release_year || trackB.releaseYear;

  // 1. Genre Match (+0.5)
  if (genreA && genreB && genreA === genreB) {
    score += 0.5;
  }

  // 2. Artist Match (+0.4)
  if (artistA && artistB && artistA === artistB) {
    score += 0.4;
  }

  // 3. Release Era (+0.1)
  if (yearA && yearB) {
    const yearDiff = Math.abs(yearA - yearB);
    if (yearDiff <= 3) score += 0.1;
  }

  return score;
}

/**
 * Ranks tracks relative to a target track or current listening context.
 * Falls back to returning other tracks in the library if affinity is low.
 */
export function getRecommendedTracks(targetTrack, allTracks, limit = 10) {
  if (!allTracks || allTracks.length === 0) return [];

  // Exclude current playing track
  const otherTracks = allTracks.filter((track) => track.id !== targetTrack?.id);

  if (!targetTrack) return otherTracks.slice(0, limit);

  // Compute affinity scores
  const scoredTracks = otherTracks.map((track) => ({
    ...track,
    affinityScore: calculateTrackAffinity(targetTrack, track),
  }));

  // Sort by highest affinity score first
  scoredTracks.sort((a, b) => b.affinityScore - a.affinityScore);

  return scoredTracks.slice(0, limit);
}