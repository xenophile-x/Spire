// src/views/ExpandedLyricsView.jsx
import React, { useState, useEffect, useRef } from "react";
import "material-symbols/rounded.css";
import AppleMusicBar, { parseLRC } from "@/components/AppleMusicBar";

// Default dummy tracks matching the reference visual stack
const DEFAULT_TRACKS = [
  {
    id: "demo-1",
    title: "Glance",
    artist: "Daniel",
    artworkUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "demo-2",
    title: "Ved",
    artist: "Ritviz",
    artworkUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "demo-3",
    title: "Formula 1 Theme",
    artist: "Brian Tyler",
    artworkUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "demo-4",
    title: "Modern Love",
    artist: "Shankar Raja, Ilaiyaraaja",
    artworkUrl: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "demo-5",
    title: "Blinding Lights",
    artist: "The Weeknd",
    artworkUrl: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=600&q=80",
  },
];

export default function ExpandedLyricsView({
  userTracks = [],
  activeTrack,
  isPlaying,
  setIsPlaying,
  currentTime = 0,
  duration = 0,
  volume = 70,
  setVolume,
  onSeek,
  onNext,
  onPrevious,
  onClose,
  isLiked,
  onToggleLike,
}) {
  const [showLyrics, setShowLyrics] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(2); // Center on 3rd track by default
  const lyricsContainerRef = useRef(null);

  // Guarantee multiple tracks for full Cover Flow carousel display
  const trackList = React.useMemo(() => {
    if (userTracks && userTracks.length >= 3) return userTracks;
    if (activeTrack) {
      const list = [...DEFAULT_TRACKS];
      list[2] = activeTrack;
      return list;
    }
    return DEFAULT_TRACKS;
  }, [userTracks, activeTrack]);

  // Track currently selected/focused in carousel
  const currentTrack = trackList[carouselIndex] || trackList[0];

  const parsedLyrics = React.useMemo(() => {
    return parseLRC(currentTrack?.synced_lyrics || currentTrack?.syncedLyrics || "");
  }, [currentTrack]);

  // Sync active lyric line scroll
  const activeLyricIdx = React.useMemo(() => {
    if (!parsedLyrics.length) return -1;
    let index = -1;
    for (let i = 0; i < parsedLyrics.length; i++) {
      if (currentTime >= parsedLyrics[i].time) {
        index = i;
      } else {
        break;
      }
    }
    return index;
  }, [currentTime, parsedLyrics]);

  useEffect(() => {
    if (showLyrics && activeLyricIdx >= 0 && lyricsContainerRef.current) {
      const activeEl = lyricsContainerRef.current.children[activeLyricIdx];
      if (activeEl) {
        activeEl.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [activeLyricIdx, showLyrics]);

  const title = currentTrack?.title || "Formula 1 Theme";
  const artist = currentTrack?.artist || "Brian Tyler";
  const artwork =
    currentTrack?.artworkUrl ||
    currentTrack?.cover ||
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80";

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between p-6 select-none font-sans pointer-events-auto">
      
      {/* Top Header: Liquid Glass Back Button */}
      <div className="w-full flex items-center justify-start max-w-6xl mx-auto z-20">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/30 border border-white/40 backdrop-blur-3xl flex items-center justify-center text-white transition-all active:scale-95 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_10px_20px_rgba(0,0,0,0.3)] cursor-pointer"
        >
          <span className="material-symbols-rounded">chevron_left</span>
        </button>
      </div>

      {/* CENTER VIEWPORT */}
      <div className="w-full max-w-6xl mx-auto flex-1 flex items-center justify-center my-auto">
        
        {/* MODE A: Frosted Liquid Glass Lyrics Card */}
        {showLyrics ? (
          <div className="w-full max-w-xl h-[460px] rounded-[36px] border border-white/40 bg-gradient-to-br from-white/20 via-white/5 to-black/50 backdrop-blur-3xl p-8 shadow-[inset_0_1px_2px_rgba(255,255,255,0.6),0_20px_50px_rgba(0,0,0,0.5)] flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center gap-4 pb-4 border-b border-white/20 shrink-0 relative z-10">
              <img src={artwork} alt={title} className="w-14 h-14 rounded-2xl object-cover border border-white/40 shadow-md" />
              <div className="min-w-0">
                <h3 className="text-2xl font-bold text-white truncate leading-tight drop-shadow-sm">{title}</h3>
                <p className="text-sm font-medium text-white/70 truncate">{artist}</p>
              </div>
            </div>

            <div
              ref={lyricsContainerRef}
              className="flex-1 overflow-y-auto space-y-6 my-4 pr-2 custom-scrollbar scroll-smooth flex flex-col items-center text-center justify-center relative z-10"
            >
              {parsedLyrics.length > 0 ? (
                parsedLyrics.map((line, idx) => {
                  const isActive = idx === activeLyricIdx;
                  return (
                    <p
                      key={idx}
                      onClick={() => onSeek && onSeek(line.time)}
                      className={`cursor-pointer transition-all duration-300 select-none ${
                        isActive
                          ? "text-3xl font-extrabold text-white opacity-100 scale-105 drop-shadow-lg"
                          : "text-lg font-semibold text-white/40 hover:text-white/70 opacity-60"
                      }`}
                    >
                      {line.text}
                    </p>
                  );
                })
              ) : (
                <p className="text-base text-white/50 italic">No synced lyrics available for this track.</p>
              )}
            </div>
          </div>
        ) : (
          /* MODE B: Classic Cover Flow Curved Carousel */
          <div className="relative w-full flex items-center justify-center h-[450px] [perspective:1000px] overflow-visible">
            {trackList.map((track, idx) => {
              const offset = idx - carouselIndex;
              const absOffset = Math.abs(offset);
              const isActive = idx === carouselIndex;

              // Z-Index ordering so outer cards stay behind inner ones
              const zIndex = 30 - absOffset;
              
              // Spacing & Curved Perspective Settings
              const translateX = offset * 210; 
              const translateZ = isActive ? 50 : -180 - absOffset * 30; 
              
              // Reverse angle direction to bend cards inward towards center
              const rotateY = isActive ? 0 : offset < 0 ? 38 : -38; 

              return (
                <div
                  key={track?.id || idx}
                  onClick={() => setCarouselIndex(idx)}
                  className="absolute transition-all duration-500 ease-out cursor-pointer rounded-[32px] border border-white/30 shadow-[0_20px_40px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col backdrop-blur-xl bg-white/10"
                  style={{
                    width: "280px",
                    height: "370px",
                    zIndex,
                    transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg)`,
                  }}
                >
                  {/* Album Cover Container */}
                  <div className="w-full h-[290px] p-2">
                    <img
                      src={track?.artworkUrl || track?.cover || artwork}
                      alt={track?.title || title}
                      className="w-full h-full object-cover rounded-[24px]"
                    />
                  </div>

                  {/* Glassmorphic Metadata Footer */}
                  <div className="flex-1 px-4 pb-3 flex flex-col justify-center items-center text-center ">
                    <p className="text-2xl font-medium text-white tracking-tight truncate w-full drop-shadow">
                      {track?.title || title}
                    </p>
                    <p className="text-xl  text-white/70 truncate w-full">
                      {track?.artist || artist}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* APPLE MUSIC PLAYER BAR AT BOTTOM */}
      <div className="w-full z-40">
        <AppleMusicBar
          activeTrack={currentTrack}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          setVolume={setVolume}
          onSeek={onSeek}
          onNext={onNext}
          onPrevious={onPrevious}
          isLiked={isLiked}
          onToggleLike={onToggleLike}
          onOpenExpandedView={() => setShowLyrics((prev) => !prev)}
        />
      </div>

    </div>
  );
}