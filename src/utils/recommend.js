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


  const history = Array.isArray(listeningHistory) ? listeningHistory : [];


  const otherTracks = allTracks.filter((track) => track.id !== targetTrack?.id);


  if (history.length === 0 && !targetTrack) {
    return otherTracks.slice(0, limit);
  }


  const genreCounts = {};
  const artistCounts = {};
  const totalHistory = history.length || 1;

  history.forEach((item) => {
    const genre = (item.genre || "Unknown").toLowerCase();
    genreCounts[genre] = (genreCounts[genre] || 0) + 1;


    const matchedTrack = allTracks.find((t) => t.id === item.track_id);
    if (matchedTrack) {
      const artist = (matchedTrack.artist || "").toLowerCase();
      if (artist) {
        artistCounts[artist] = (artistCounts[artist] || 0) + 1;
      }
    }
  });


  const scoredTracks = otherTracks.map((track) => {
    let score = 0;
    const trackGenre = (track.genre || track.primary_genre || "").toLowerCase();
    const trackArtist = (track.artist || track.canonical_artist || "").toLowerCase();


    if (trackGenre && genreCounts[trackGenre]) {
      score += 0.6 * (genreCounts[trackGenre] / totalHistory);
    }


    if (trackArtist && artistCounts[trackArtist]) {
      score += 0.4 * (artistCounts[trackArtist] / totalHistory);
    }


    if (targetTrack) {
      const affinity = calculateTrackAffinity(targetTrack, track);
      score += 0.5 * affinity;
    }

    return {
      ...track,
      affinityScore: score,
    };
  });


  scoredTracks.sort((a, b) => b.affinityScore - a.affinityScore);

  return scoredTracks.slice(0, limit);
}