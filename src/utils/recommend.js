// src/utils/recommend.js

/**
 * Calculates similarity score (0.0 to 1.0) between two tracks.
 */
export function calculateTrackAffinity(trackA, trackB) {
  let score = 0;

  // Same Primary Genre (+0.5)
  if (
    trackA.primary_genre &&
    trackB.primary_genre &&
    trackA.primary_genre.toLowerCase() === trackB.primary_genre.toLowerCase()
  ) {
    score += 0.5;
  }

  // Same Canonical Artist (+0.4)
  if (
    trackA.canonical_artist &&
    trackB.canonical_artist &&
    trackA.canonical_artist.toLowerCase() === trackB.canonical_artist.toLowerCase()
  ) {
    score += 0.4;
  }

  // Similar Release Era (+0.1)
  if (trackA.release_year && trackB.release_year) {
    const yearDiff = Math.abs(trackA.release_year - trackB.release_year);
    if (yearDiff <= 3) score += 0.1;
  }

  return Math.min(score, 1.0);
}