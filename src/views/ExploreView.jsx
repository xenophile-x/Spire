

import React, { useEffect, useState, useRef } from "react";
import "material-symbols/rounded.css";
import TrackCard from "@/components/TrackCard";
import { getRecommendedTracks } from "@/utils/recommend";
import { GlassIcon } from "@/components/ui/glasscn/glass-icon";
import StickyGlassHeader from "@/components/ui/StickyGlassHeader";

function ScrollControls({ onLeft, onRight }) {
  return (
    <div className="flex items-center gap-2">
      <GlassIcon
        size="sm"
        onClick={onLeft}
        aria-label="Scroll left"
        className="text-white"
        liquidProps={{ blur: 4, refraction: 4 }}
      >
        <span className="material-symbols-rounded text-base leading-none select-none pointer-events-none">chevron_left</span>
      </GlassIcon>
      <GlassIcon
        size="sm"
        onClick={onRight}
        aria-label="Scroll right"
        className="text-white"
        liquidProps={{ blur: 4, refraction: 4 }}
      >
        <span className="material-symbols-rounded text-base leading-none select-none pointer-events-none">chevron_right</span>
      </GlassIcon>
    </div>
  );
}

export default function ExploreView({
  userTracks = [],
  onPlayTrack,
  currentTrack,
  continueListening = [],
  playlists = [],
  onAddToPlaylist,
  onDeleteTrack,
  listeningHistory = [],
}) {
  const [recommendedTracks, setRecommendedTracks] = useState([]);

  const recScrollRef = useRef(null);
  const continueScrollRef = useRef(null);

  useEffect(() => {
    const playedIds = new Set(continueListening.map((t) => t.id));

    const pool = userTracks.filter(
      (t) => t.id !== currentTrack?.id && !playedIds.has(t.id)
    );

    let recommendations = getRecommendedTracks(currentTrack, pool, listeningHistory, 10);
    if (recommendations.length === 0) {
      recommendations = pool.slice(0, 10);
    }
    setRecommendedTracks(recommendations);
  }, [userTracks, currentTrack, continueListening, listeningHistory]);

  const scroll = (ref, direction) => {
    if (ref.current) {
      const scrollAmount = direction === "left" ? -350 : 350;
      ref.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  return (
    <div className="w-full min-w-0 space-y-8 text-white select-none">
      <StickyGlassHeader
        title="Explore"
        subtitle={userTracks.length ? `${userTracks.length} tracks • discovery` : "Discovery"}
      />

      {userTracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center space-y-2 py-16 text-center text-white/60">
          <p className="text-sm font-medium">No tracks available to explore.</p>
          <p className="text-xs text-white/40">Upload tracks on the Home tab to get started.</p>
        </div>
      ) : (
        <>
          <div className="w-full min-w-0 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold tracking-tight">Recommended for You</h2>
                <p className="text-xs text-white/50">
                  {currentTrack ? `Based on ${currentTrack.title}` : "Based on your library taste"}
                </p>
              </div>
              <ScrollControls
                onLeft={() => scroll(recScrollRef, "left")}
                onRight={() => scroll(recScrollRef, "right")}
              />
            </div>

            <div
              ref={recScrollRef}
              className="no-scrollbar flex w-full min-w-0 flex-nowrap gap-5 overflow-x-auto scroll-smooth pt-1 pb-2"
            >
                {recommendedTracks.map((track) => (
                <TrackCard
                  key={`rec-${track.id}`}
                  track={track}
                  onPlayTrack={onPlayTrack}
                  widthClass="w-48 sm:w-56"
                  playlists={playlists}
                  onAddToPlaylist={onAddToPlaylist}
                  onDeleteTrack={onDeleteTrack}
                />
              ))}
            </div>
          </div>

          {continueListening.length > 0 && (
            <div className="w-full min-w-0 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold tracking-tight">Continue Listening</h2>
                  <p className="text-xs text-white/50">Played recently</p>
                </div>
                <ScrollControls
                  onLeft={() => scroll(continueScrollRef, "left")}
                  onRight={() => scroll(continueScrollRef, "right")}
                />
              </div>

              <div
                ref={continueScrollRef}
                className="no-scrollbar flex w-full min-w-0 flex-nowrap gap-5 overflow-x-auto scroll-smooth pt-1 pb-2"
              >
                {continueListening.slice(0, 8).map((track, index) => (
                  <TrackCard
                    key={`continue-${track.id}-${index}`}
                    track={track}
                    onPlayTrack={onPlayTrack}
                    widthClass="w-48 sm:w-56"
                    playlists={playlists}
                    onAddToPlaylist={onAddToPlaylist}
                    onDeleteTrack={onDeleteTrack}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

