export function calculateTrackAffinity(trackA, trackB) {
  if (!trackA || !trackB) return 0;
  let score = 0;

  const genreA = (trackA.primary_genre || trackA.genre || "").toLowerCase();
  const genreB = (trackB.primary_genre || trackB.genre || "").toLowerCase();

  const artistA = (trackA.canonical_artist || trackA.artist || "").toLowerCase();
  const artistB = (trackB.canonical_artist || trackB.artist || "").toLowerCase();

  const yearA = trackA.release_year || trackA.releaseYear;
  const yearB = trackB.release_year || trackB.releaseYear;

  if (genreA && genreB && genreA === genreB) {
    score += 0.5;
  }

  if (artistA && artistB && artistA === artistB) {
    score += 0.4;
  }

  if (yearA && yearB) {
    const yearDiff = Math.abs(yearA - yearB);
    if (yearDiff <= 3) score += 0.1;
  }

  return score;
}

export function getRecommendedTracks(targetTrack, allTracks, listeningHistory = [], limit = 10) {
  if (!allTracks || allTracks.length === 0) return [];

  // Defensive guard: `= []` only covers `undefined`. If a caller passes
  // null, or an un-unwrapped Supabase response ({ data, error }) instead
  // of the array itself, listeningHistory won't be an array here — coerce
  // it so .forEach never crashes. If you're hitting this branch in
  // practice, fix the call site to pass the actual array (e.g. `.data`).
  const history = Array.isArray(listeningHistory) ? listeningHistory : [];

  // Filter out the target track from candidates
  const otherTracks = allTracks.filter((track) => track.id !== targetTrack?.id);

  // If no listening history and no targetTrack, just slice candidates
  if (history.length === 0 && !targetTrack) {
    return otherTracks.slice(0, limit);
  }

  // 1. Build preferences from listening history
  const genreCounts = {};
  const artistCounts = {};
  const totalHistory = history.length || 1;

  history.forEach((item) => {
    const genre = (item.genre || "Unknown").toLowerCase();
    genreCounts[genre] = (genreCounts[genre] || 0) + 1;

    // Resolve artist from allTracks
    const matchedTrack = allTracks.find((t) => t.id === item.track_id);
    if (matchedTrack) {
      const artist = (matchedTrack.artist || "").toLowerCase();
      if (artist) {
        artistCounts[artist] = (artistCounts[artist] || 0) + 1;
      }
    }
  });

  // 2. Score candidate tracks
  const scoredTracks = otherTracks.map((track) => {
    let score = 0;
    const trackGenre = (track.genre || track.primary_genre || "").toLowerCase();
    const trackArtist = (track.artist || track.canonical_artist || "").toLowerCase();

    // 0.6 weight for matching listening history genres
    if (trackGenre && genreCounts[trackGenre]) {
      score += 0.6 * (genreCounts[trackGenre] / totalHistory);
    }

    // 0.4 weight for matching listening history artists
    if (trackArtist && artistCounts[trackArtist]) {
      score += 0.4 * (artistCounts[trackArtist] / totalHistory);
    }

    // 0.5 weight for matching target track affinity
    if (targetTrack) {
      const affinity = calculateTrackAffinity(targetTrack, track);
      score += 0.5 * affinity;
    }

    return {
      ...track,
      affinityScore: score,
    };
  });

  // Sort by affinityScore descending
  scoredTracks.sort((a, b) => b.affinityScore - a.affinityScore);

  return scoredTracks.slice(0, limit);
}