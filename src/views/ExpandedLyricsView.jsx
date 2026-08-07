// src/views/ExpandedLyricsView.jsx
import React, { useState, useEffect, useRef } from "react";
import "material-symbols/rounded.css";
import AppleMusicBar, { parseLRC } from "@/components/AppleMusicBar";
import { GlassScrimCard } from "@/components/ui/glasscn/glass-scrim-card";
import { GlassIcon } from "@/components/ui/glasscn/glass-icon";
import { LiquidGlass } from "@/components/ui/glasscn/liquid-glass";
import { getRecommendedTracks } from "@/utils/recommend";
import { cn } from "@/lib/utils";

// Default dummy tracks matching the reference visual stack
const DEFAULT_TRACKS = [
  {
    id: "demo-1",
    title: "Default",
    artist: "Default",
    artworkUrl: "",
  }
 
];

export default function ExpandedLyricsView({
  userTracks = [],
  activeTrack,
  isPlaying,
  onTogglePlay,
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
  onNavigateToPlaylists,
  playlists = [],
  onAddToPlaylist,
  onPlayTrack,
}) {
  const [showLyrics, setShowLyrics] = useState(false);
  const lyricsContainerRef = useRef(null);

  // Guarantee multiple tracks for full Cover Flow carousel display
  const trackList = React.useMemo(() => {
    if (!userTracks || userTracks.length === 0) {
      return activeTrack ? [activeTrack, ...DEFAULT_TRACKS.slice(0, 9)] : DEFAULT_TRACKS;
    }

    const list = [];
    if (activeTrack) {
      list.push(activeTrack);
    }

    const recs = getRecommendedTracks(activeTrack, userTracks, 10);
    recs.forEach((track) => {
      if (list.length < 10 && !list.some((t) => t.id === track.id)) {
        list.push(track);
      }
    });

    if (list.length < 10) {
      const remaining = userTracks.filter((track) => !list.some((t) => t.id === track.id));
      const shuffled = [...remaining].sort(() => 0.5 - Math.random());
      for (const track of shuffled) {
        if (list.length >= 10) break;
        list.push(track);
      }
    }

    return list;
  }, [userTracks, activeTrack]);

  // Find index of activeTrack in trackList
  const activeTrackIndex = React.useMemo(() => {
    if (!activeTrack) return 0;
    const idx = trackList.findIndex((t) => t.id === activeTrack.id);
    return idx >= 0 ? idx : 0;
  }, [activeTrack, trackList]);

  const [carouselIndex, setCarouselIndex] = useState(activeTrackIndex);

  // Sync carouselIndex when activeTrackIndex changes (e.g. track changes in player)
  useEffect(() => {
    setCarouselIndex(activeTrackIndex);
  }, [activeTrackIndex]);

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
        <GlassIcon
          size="md"
          onClick={onClose}
          aria-label="Close expanded view"
          className="text-white"
          liquidProps={{ blur: 8, refraction: 10 }}
        >
          <span className="material-symbols-rounded text-2xl">chevron_left</span>
        </GlassIcon>
      </div>

      {/* CENTER VIEWPORT */}
      <div className="w-full max-w-6xl mx-auto flex-1 flex items-center justify-center my-auto">
        
        {/* MODE A: Frosted Liquid Glass Lyrics Card */}
        {showLyrics ? (
           <GlassScrimCard
             scrim={false}
             liquidProps={{
               blur: 16,
               refraction: 15,
               saturation: 1,
               className: "rounded-[36px] [--liquid-glass-rim-light:rgba(255,255,255,0.45)]",
             }}
             className="relative flex h-[460px] w-full max-w-xl flex-col justify-between gap-0 overflow-hidden p-8 py-0"
           >
            <div className="relative z-10 flex shrink-0 items-center gap-4 border-b border-white/20 pb-4">
               <img src={artwork} alt={title} className="w-16 h-16 rounded-2xl object-cover" />
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
          </GlassScrimCard>
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

              // Fade out outer cards to avoid clutter
              const opacity = Math.max(0, 1 - absOffset * 0.35);

              return (
                <LiquidGlass
                  key={track?.id || idx}
                  blur={10}
                  refraction={12}
                  saturation={1.35}
                  onClick={() => {
                    setCarouselIndex(idx);
                    if (track && onPlayTrack) {
                      onPlayTrack(track);
                    }
                  }}
                  className={cn(
                    "absolute flex cursor-pointer flex-col overflow-hidden rounded-[32px] shadow-[0_8px_24px_rgba(0,0,0,0.3)] transition-all duration-500 ease-out [--liquid-glass-rim-light:rgba(255,255,255,0.4)]",
                    isActive ? "ring-2 ring-white/60 brightness-110" : "brightness-95"
                  )}
                  style={{
                    width: "280px",
                    height: "370px",
                    zIndex,
                    transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg)`,
                    opacity,
                  }}
                >
                  <div className="relative h-[290px] w-full p-2">
                    <img
                      src={track?.artworkUrl || track?.cover || artwork}
                      alt={track?.title || title}
                      className="h-full w-full rounded-[24px] object-cover"
                    />
                  </div>

                  <div className="flex flex-1 flex-col items-center justify-center px-4 pb-3 text-center">
                    <p className="w-full truncate text-2xl font-medium tracking-tight text-white drop-shadow">
                      {track?.title || title}
                    </p>
                    <p className="w-full truncate text-xl text-white/70">
                      {track?.artist || artist}
                    </p>
                  </div>
                </LiquidGlass>
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
          setIsPlaying={onTogglePlay}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          setVolume={setVolume}
          onSeek={onSeek}
          onNext={onNext}
          onPrevious={onPrevious}
          isLiked={isLiked}
          onToggleLike={onToggleLike}
          onNavigateToPlaylists={onNavigateToPlaylists}
          onOpenExpandedView={() => setShowLyrics((prev) => !prev)}
          playlists={playlists}
          onAddToPlaylist={onAddToPlaylist}
        />
      </div>

    </div>
  );
}