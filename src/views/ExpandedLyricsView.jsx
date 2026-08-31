import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "material-symbols/rounded.css";
import MusicBar from "@/components/MusicBar";
import SyncedLyrics from "@/components/SyncedLyrics";
import { parseLRC } from "@/utils/lyricsParser";
import { GlassScrimCard } from "@/components/ui/glasscn/glass-scrim-card";
import { GlassIcon } from "@/components/ui/glasscn/glass-icon";
import { usePlayerTime } from "@/context/PlayerContext";
import { cn } from "@/lib/utils";

const DEFAULT_TRACK = {
  id: "demo-1",
  title: "Default",
  artist: "Default Artist",
  artworkUrl:
    "https://images.unsplash.com/photo-1610616817237-dff4b556cce6?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8bXVzaWMlMjBwb3N0ZXJ8ZW58MHx8MHx8fDA%3D",
};

const SWIPE_THRESHOLD = 80;
const CLICK_DRAG_TOLERANCE = 8;

export default function ExpandedLyricsView({
  playbackQueue = [],
  activeTrack,
  isPlaying,
  onTogglePlay,
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
  const { currentTime } = usePlayerTime();
  const [showLyrics, setShowLyrics] = useState(initialLyrics);

  const trackList = useMemo(() => {
    if (playbackQueue && playbackQueue.length > 0) {
      return playbackQueue;
    }
    return activeTrack ? [activeTrack] : [DEFAULT_TRACK];
  }, [playbackQueue, activeTrack]);

  const activeTrackIndex = useMemo(() => {
    if (!activeTrack) return 0;
    const idx = trackList.findIndex((t) => t.id === activeTrack.id);
    return idx >= 0 ? idx : 0;
  }, [activeTrack, trackList]);

  const [carouselIndex, setCarouselIndex] = useState(activeTrackIndex);

  useEffect(() => {
    setCarouselIndex(activeTrackIndex);
  }, [activeTrackIndex]);

  const currentTrack = trackList[carouselIndex] || trackList[0] || DEFAULT_TRACK;
  const title = currentTrack?.title || DEFAULT_TRACK.title;
  const artist = currentTrack?.artist || DEFAULT_TRACK.artist;
  const artwork = currentTrack?.artworkUrl || currentTrack?.cover || DEFAULT_TRACK.artworkUrl;

  const [artworkError, setArtworkError] = useState(false);

  const parsedLyrics = useMemo(() => {
    return parseLRC(currentTrack?.synced_lyrics || currentTrack?.syncedLyrics || "");
  }, [currentTrack]);

  useEffect(() => {
    setArtworkError(false);
  }, [artwork]);

  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, moved: false, active: false });
  const clickOriginRef = useRef(null);

  const handleDragMove = useCallback(
    (e) => {
      if (!dragRef.current.active) return;
      const dx = e.clientX - dragRef.current.startX;
      if (Math.abs(dx) > CLICK_DRAG_TOLERANCE) dragRef.current.moved = true;
      setDragOffset(dx);
    },
    []
  );

  const endDrag = useCallback(
    (clientX, clientY) => {
      const { startX, startY, moved } = dragRef.current;
      const dx = clientX - startX;
      const dy = clientY - startY;
      const isHorizontal = Math.abs(dx) > Math.abs(dy) * 1.2;
      const shouldSwipe = moved && isHorizontal && Math.abs(dx) > SWIPE_THRESHOLD;
      dragRef.current.active = false;
      dragRef.current.moved = false;
      setIsDragging(false);
      setDragOffset(0);
      if (shouldSwipe) {
        if (dx < 0) onNext?.();
        else onPrevious?.();
      }
    },
    [onNext, onPrevious]
  );

  const handleDragMoveRef = useRef(handleDragMove);
  handleDragMoveRef.current = handleDragMove;
  const endDragRef = useRef(endDrag);
  endDragRef.current = endDrag;

  const handleDragEnd = useCallback(
    (e) => {
      window.removeEventListener("pointermove", handleDragMoveRef.current);
      window.removeEventListener("pointerup", handleDragEndRef.current);
      window.removeEventListener("pointercancel", handleDragEndRef.current);
      endDragRef.current(e.clientX, e.clientY);
    },
    []
  );

  const handleDragEndRef = useRef(handleDragEnd);
  handleDragEndRef.current = handleDragEnd;

  const handlePointerDown = useCallback(
    (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      clickOriginRef.current = { x: e.clientX, y: e.clientY };
      dragRef.current = { startX: e.clientX, startY: e.clientY, moved: false, active: true };
      setIsDragging(true);
      window.addEventListener("pointermove", handleDragMoveRef.current);
      window.addEventListener("pointerup", handleDragEndRef.current);
      window.addEventListener("pointercancel", handleDragEndRef.current);
    },
    []
  );

  const handleTrackClick = (e, idx, track) => {
    const origin = clickOriginRef.current;
    clickOriginRef.current = null;

    if (origin && Math.abs(origin.x - e.clientX) > CLICK_DRAG_TOLERANCE) return;
    setCarouselIndex(idx);
    if (idx !== activeTrackIndex && onPlayTrack && track) {
      onPlayTrack(track);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between p-6 pb-4 select-none font-sans pointer-events-auto overflow-hidden">
      {/* Back button pushed to the absolute left */}
      <div className="absolute top-10 left-10 z-50">
        <GlassIcon
          size="md"
          onClick={onClose}
          aria-label="Close expanded view"
          className="text-white cursor-pointer hover:bg-white/10 transition-colors"
          liquidProps={{ blur: 12, refraction: 10 }}
        >
          <span className="material-symbols-rounded text-2xl">chevron_left</span>
        </GlassIcon>
      </div>

      {/* Carousel shifted down */}
      <div className="w-full max-w-6xl mx-auto flex-1 flex items-center justify-center mt-[10vh]">
        <div
          key={showLyrics ? "lyrics" : "carousel"}
          className="w-full animate-in fade-in-0 zoom-in-95 animation-duration-300 flex items-center justify-center"
        >
          {showLyrics ? (
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
                {!artworkError ? (
                  <img src={artwork} alt={title} className="w-16 h-16 rounded-2xl object-cover shadow-lg" onError={() => setArtworkError(true)} />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center">
                    <span className="material-symbols-rounded text-white/40">music_note</span>
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="text-2xl font-bold text-white truncate leading-tight drop-shadow-sm">{title}</h3>
                  <p className="text-sm font-medium text-white/70 truncate">{artist}</p>
                </div>
              </div>

              <SyncedLyrics
                lines={parsedLyrics}
                currentTime={currentTime}
                onSeek={onSeek}
                autoFollow={showLyrics}
                emptyMessage="No synced lyrics available for this track."
                containerClassName="flex-1 overflow-y-auto space-y-6 my-4 pr-2 custom-scrollbar flex flex-col items-center text-center relative z-10"
                spacerClassName="h-32 shrink-0"
                lineClassName={(index, isActive) =>
                  `cursor-pointer transition-all duration-300 select-none ${
                    isActive
                      ? "text-3xl font-extrabold text-white opacity-100 scale-105 drop-shadow-lg"
                      : "text-lg font-semibold text-white/40 hover:text-white/70 opacity-60"
                  }`
                }
              />
            </GlassScrimCard>
          ) : (
            <div className="relative flex flex-col items-center">
              <div
                className={cn(
                  "relative w-full flex items-center justify-center h-[300px] [perspective:1400px] [transform-style:preserve-3d] overflow-visible touch-none transition-transform duration-500 ease-out",
                  isDragging ? "cursor-grabbing" : "cursor-grab"
                )}
                onPointerDown={handlePointerDown}
                style={{
                  transform: `translateX(${dragOffset}px)`,
                  transitionDuration: isDragging ? "0ms" : undefined,
                }}
              >
                {trackList.map((track, idx) => {
                  const offset = idx - carouselIndex;
                  const absOffset = Math.abs(offset);

                  if (absOffset > 5) return null;

                  const isActive = offset === 0;
                  const zIndex = 50 - absOffset;
                  const sign = Math.sign(offset);

                  const translateX = isActive ? 0 : sign * (160 + absOffset * 55);
                  const translateZ = isActive ? 120 : -40 - absOffset * 45;
                  const rotateY = isActive ? 0 : sign * -45; 
                  
                  const opacity = 1;

                  const dragX = isActive && isDragging ? dragOffset : 0;
                  const dragRotateY = isActive && isDragging ? dragOffset / 15 : 0;

                  return (
                    <div
                      key={`${track?.id}-${idx}`}
                      className="absolute transition-all duration-700 [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)]"
                      style={{
                        width: "280px", 
                        height: "280px", 
                        zIndex,
                        opacity,
                        transform: `translate3d(${translateX + dragX}px, 0px, ${translateZ}px) rotateY(${rotateY + dragRotateY}deg)`,
                        transformStyle: "preserve-3d",
                        willChange: "transform, opacity",
                        transitionDuration: isDragging ? "0ms" : undefined,
                      }}
                    >
                      <div
                        className={cn(
                          "h-full w-full overflow-hidden rounded-[24px] shadow-[0_16px_40px_rgba(0,0,0,0.5)] transition-all duration-300 ease-out",
                          isActive
                            ? "cursor-default ring-1 ring-white/40 scale-100 active:scale-[0.98]"
                            : "cursor-pointer hover:-translate-y-2 active:scale-95"
                        )}
                        onClick={(e) => handleTrackClick(e, idx, track)}
                      >
                        <img
                          src={track?.artworkUrl || track?.cover || artwork}
                          alt={track?.title || title}
                          className="h-full w-full object-cover rounded-[24px]"
                          draggable={false}
                          onError={(e) => { e.target.style.display = "none"; }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="w-full z-40 flex flex-col items-center gap-6 mt-auto">
        <div className="w-full max-w-4xl flex justify-center">
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
            isRepeat={_isRepeat}
            onToggleRepeat={_onToggleRepeat}
            onOpenExpandedView={() => setShowLyrics(false)}
            onOpenLyrics={() => setShowLyrics((prev) => !prev)}
            playlists={playlists}
            onAddToPlaylist={onAddToPlaylist}
          />
        </div>
        
        <div className="flex items-center justify-center gap-3">
          <div className="w-2 h-2 rounded-full bg-white/40 backdrop-blur-sm"></div>
          <div className="w-32 h-1.5 rounded-full bg-white/40 backdrop-blur-sm"></div>
        </div>
      </div>
    </div>
  );
}