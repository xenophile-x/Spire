import React, { useState, useEffect, useRef } from "react";
import "material-symbols/rounded.css";
import MusicBar, { parseLRC } from "@/components/MusicBar";
import { GlassScrimCard } from "@/components/ui/glasscn/glass-scrim-card";
import { GlassIcon } from "@/components/ui/glasscn/glass-icon";
import { LiquidGlass } from "@/components/ui/glasscn/liquid-glass";
import { getRecommendedTracks } from "@/utils/recommend";
import { cn } from "@/lib/utils";

const DEFAULT_TRACK = {
  id: "demo-1",
  title: "Default",
  artist: "Default Artist",
  artworkUrl:
    "https://images.unsplash.com/photo-1610616817237-dff4b556cce6?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8bXVzaWMlMjBwb3N0ZXJ8ZW58MHx8MHx8fDA%3D",
};

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
  _isShuffle = false,
  _onToggleShuffle,
  _isRepeat = false,
  _onToggleRepeat,
  isRadioMode = false,
  onToggleRadio,
  onClose,
  isLiked,
  onToggleLike,
  playlists = [],
  onAddToPlaylist,
  onPlayTrack,
  initialLyrics = false,
}) {
  const [showLyrics, setShowLyrics] = useState(initialLyrics);
  const lyricsContainerRef = useRef(null);
  const lyricsJustOpenedRef = useRef(false);

  useEffect(() => {
    lyricsJustOpenedRef.current = showLyrics;
  }, [showLyrics]);

  const trackList = React.useMemo(() => {
    // If no tracks exist and no activeTrack is set, render ONLY the single default track
    if ((!userTracks || userTracks.length === 0) && !activeTrack) {
      return [DEFAULT_TRACK];
    }

    const list = [];
    if (activeTrack) {
      list.push(activeTrack);
    }

    if (userTracks.length > 0) {
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
    }

    return list.length > 0 ? list : [DEFAULT_TRACK];
  }, [userTracks, activeTrack]);

  const activeTrackIndex = React.useMemo(() => {
    if (!activeTrack) return 0;
    const idx = trackList.findIndex((t) => t.id === activeTrack.id);
    return idx >= 0 ? idx : 0;
  }, [activeTrack, trackList]);

  const [carouselIndex, setCarouselIndex] = useState(activeTrackIndex);

  useEffect(() => {
    setCarouselIndex(activeTrackIndex);
  }, [activeTrackIndex]);

  const currentTrack = trackList[carouselIndex] || trackList[0] || DEFAULT_TRACK;

  const parsedLyrics = React.useMemo(() => {
    return parseLRC(currentTrack?.synced_lyrics || currentTrack?.syncedLyrics || "");
  }, [currentTrack]);

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
    if (!showLyrics || activeLyricIdx < 0) return;
    const container = lyricsContainerRef.current;
    if (!container) return;
    const activeEl = container.children[activeLyricIdx + 1];
    if (!activeEl) return;

    const target =
      activeEl.offsetTop - container.clientHeight / 2 + activeEl.offsetHeight / 2;
    const clamped = Math.max(0, Math.min(target, container.scrollHeight - container.clientHeight));

    if (lyricsJustOpenedRef.current) {
      container.scrollTop = clamped;
      lyricsJustOpenedRef.current = false;
    } else {
      container.scrollTo({ top: clamped, behavior: "smooth" });
    }
  }, [activeLyricIdx, showLyrics]);

  const title = currentTrack?.title || DEFAULT_TRACK.title;
  const artist = currentTrack?.artist || DEFAULT_TRACK.artist;
  const artwork = currentTrack?.artworkUrl || currentTrack?.cover || DEFAULT_TRACK.artworkUrl;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between p-6 select-none font-sans pointer-events-auto overflow-hidden">
      {/* TOP BAR */}
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
        <div
          key={showLyrics ? "lyrics" : "carousel"}
          className="w-full animate-in fade-in-0 zoom-in-95 animation-duration-300 flex items-center justify-center"
        >
          {showLyrics ? (
          /* MODE A: Frosted Liquid Glass Lyrics Card */
          <GlassScrimCard
            scrim={false}
            liquidProps={{
              blur: 10,
              refraction: 9,
              saturation: 1.1,
              className: "rounded-[36px] [--liquid-glass-rim-light:rgba(255,255,255,0.45)]",
            }}
            className="relative flex h-[600px] w-full max-w-xl flex-col justify-between gap-0 overflow-hidden p-8 py-0"
          >
            <div className="relative z-10 mt-8 flex shrink-0 items-center gap-4 border-b border-white/20 pb-4">
              <img src={artwork} alt={title} className="w-16 h-16 rounded-2xl object-cover" onError={(e) => { e.target.style.display = "none"; }} />
              <div className="min-w-0">
                <h3 className="text-2xl font-bold text-white truncate leading-tight drop-shadow-sm">{title}</h3>
                <p className="text-sm font-medium text-white/70 truncate">{artist}</p>
              </div>
            </div>

            <div
              ref={lyricsContainerRef}
              className="flex-1 overflow-y-auto space-y-6 my-4 pr-2 custom-scrollbar flex flex-col items-center text-center relative z-10"
            >
              <div className="h-32 shrink-0" />
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
              <div className="h-32 shrink-0" />
            </div>
          </GlassScrimCard>
        ) : (
          /* MODE B: Curved Perspective Cover Flow Carousel */
          <div className="relative w-full flex items-center justify-center h-[580px] [perspective:1200px] [transform-style:preserve-3d] overflow-visible">
            {trackList.map((track, idx) => {
              const offset = idx - carouselIndex;
              const absOffset = Math.abs(offset);
              const isActive = idx === carouselIndex;

              // Z-Index ordering so center sits on top
              const zIndex = 50 - absOffset;

              // Position along 3D space
              const translateX = offset * 180;
              const translateZ = isActive ? 80 : -140 - absOffset * 40;
              const rotateY = isActive ? 0 : offset < 0 ? 32 : -32;

              // Smooth fade out for side items
              const opacity = Math.max(0, 1 - absOffset * 0.28);

              return (
                <LiquidGlass
                  key={track?.id || idx}
                  blur={8}
                  refraction={8}
                  saturation={1.2}
                  onClick={() => {
                    setCarouselIndex(idx);
                    if (track && onPlayTrack) {
                      onPlayTrack(track);
                    }
                  }}
                  className={cn(
                    "absolute flex cursor-pointer flex-col overflow-hidden rounded-[32px] shadow-[0_12px_32px_rgba(0,0,0,0.4)] transition-all duration-500 [transition-timing-function:cubic-bezier(0.25,1,0.5,1)] [--liquid-glass-rim-light:rgba(255,255,255,0.4)]",
                    isActive ? "ring-2 ring-white/60 brightness-110" : "brightness-90 hover:brightness-100"
                  )}
                  style={{
                    width: "280px",
                    height: "370px",
                    zIndex,
                    opacity,
                    transform: `translate3d(${translateX}px, 0px, ${translateZ}px) rotateY(${rotateY}deg)`,
                    transformStyle: "preserve-3d",
                    willChange: "transform, opacity",
                  }}
                >
                  <div className="relative h-[290px] w-full p-2">
                    <img
                      src={track?.artworkUrl || track?.cover || artwork}
                      alt={track?.title || title}
                      className="h-full w-full rounded-[24px] object-cover pointer-events-none"
                      onError={(e) => { e.target.style.display = "none"; }}
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
      </div>

      {/* APPLE MUSIC PLAYER BAR */}
      <div className="w-full z-40">
        <MusicBar
          activeTrack={currentTrack}
          isPlaying={isPlaying}
          onTogglePlay={onTogglePlay}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          setVolume={setVolume}
          onSeek={onSeek}
          onNext={onNext}
          onPrevious={onPrevious}
          isRadioMode={isRadioMode}
          onToggleRadio={onToggleRadio}
          isLiked={isLiked}
          onToggleLike={onToggleLike}
          onOpenExpandedView={() => setShowLyrics(false)}
          onOpenLyrics={() => setShowLyrics((prev) => !prev)}
          playlists={playlists}
          onAddToPlaylist={onAddToPlaylist}
        />
      </div>
    </div>
  );
}