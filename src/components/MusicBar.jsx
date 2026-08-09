// src/components/MusicBar.jsx
import React, { useRef } from "react";
import "material-symbols/rounded.css";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { LiquidGlass } from "@/components/ui/glasscn/liquid-glass";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { GlassDropdownMenuContent } from "@/components/ui/glasscn/glass-dropdown-menu";
import { cn } from "@/lib/utils";

const SIZES = {
  shuffleRepeat: { btnSize: 24, iconSize: 16 },
  skip:          { btnSize: 28, iconSize: 24 },
  playPause:     { btnSize: 34, iconSize: 30 },
  heart:         { btnSize: 24, iconSize: 15 },
  utility:       { btnSize: 28, iconSize: 18 },
};

export function parseLRC(lrcString) {
  if (!lrcString || typeof lrcString !== "string") return [];
  const lines = lrcString.split("\n");
  const result = [];
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

  for (const line of lines) {
    const match = timeRegex.exec(line);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const millis = parseInt(match[3].padEnd(3, "0"), 10);
      const time = minutes * 60 + seconds + millis / 1000;
      const text = line.replace(timeRegex, "").trim();
      if (text) {
        result.push({ time, text });
      }
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

function IconButton({ icon, size, onClick, active = false, filled = true, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ width: `${size.btnSize}px`, height: `${size.btnSize}px` }}
      className={cn(
        "cursor-pointer rounded-full p-0 flex items-center justify-center shrink-0 transition-all active:scale-95 border-0 bg-transparent focus:outline-none",
        active ? "text-white" : "text-white/60 hover:text-white",
        className
      )}
    >
      <span
        className="material-symbols-rounded leading-none select-none"
        style={{
          fontSize: `${size.iconSize}px`,
          fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 300`
        }}
      >
        {icon}
      </span>
    </button>
  );
}

function formatTime(seconds = 0) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

export default function MusicBar({
  activeTrack,
  isPlaying,
  setIsPlaying,
  currentTime = 0,
  duration = 0,
  volume = 70,
  setVolume,
  isShuffle = false,
  onToggleShuffle,
  isRepeat = false,
  onToggleRepeat,
  onSeek,
  onNext,
  onPrevious,
  isLiked = false,
  onToggleLike,
  onOpenExpandedView,
  onNavigateToPlaylists,
  playlists = [],
  onAddToPlaylist,
}) {
  const prevVolumeRef = useRef(70);

  const handleMuteToggle = () => {
    if (volume > 0) {
      prevVolumeRef.current = volume;
      if (setVolume) setVolume(0);
    } else {
      if (setVolume) setVolume(prevVolumeRef.current || 50);
    }
  };

  const getVolumeIcon = () => {
    if (volume === 0) return "volume_off";
    if (volume < 30) return "volume_mute";
    if (volume < 70) return "volume_down";
    return "volume_up";
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const title = activeTrack?.title || activeTrack?.canonical_title || "No Track Playing";
  const artist = activeTrack?.artist || activeTrack?.canonical_artist || "Select a song";
  const artwork =
    activeTrack?.cover ||
    activeTrack?.artworkUrl ||
    activeTrack?.artwork_url;

  return (
    <div className="flex flex-col items-center justify-center select-none font-sans relative w-full max-w-2xl mx-auto p-1">
      <LiquidGlass
        blur={12}
        refraction={14}
        saturation={1.45}
        className="flex h-16 w-full items-center justify-between gap-3 rounded-full px-4 border border-white/20 [--liquid-glass-rim-light:rgba(255,255,255,0.6)] [--liquid-glass-rim-width:1px]"
      >
        {/* Left Playback Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <IconButton
            icon="shuffle"
            size={SIZES.shuffleRepeat}
            active={isShuffle}
            onClick={onToggleShuffle}
            className={!isShuffle ? "text-white/30 hover:text-white" : "text-white"}
          />
          <IconButton icon="fast_rewind" size={SIZES.skip} onClick={onPrevious} />
          <IconButton
            icon={isPlaying ? "pause" : "play_arrow"}
            size={SIZES.playPause}
            active
            onClick={() => setIsPlaying && setIsPlaying(!isPlaying)}
          />
          <IconButton icon="fast_forward" size={SIZES.skip} onClick={onNext} />
          <IconButton
            icon="repeat"
            size={SIZES.shuffleRepeat}
            active={isRepeat}
            onClick={onToggleRepeat}
            className={!isRepeat ? "text-white/30 hover:text-white" : "text-white"}
          />
        </div>

        {/* Center Track Capsule */}
        <LiquidGlass
          blur={4}
          refraction={6}
          saturation={1.2}
          variant="liquid"
          onClick={onOpenExpandedView}
          className="relative flex h-10 max-w-lg flex-1 items-center justify-between overflow-hidden rounded-full px-3 border border-white/10 shadow-inner cursor-pointer [--liquid-glass-rim-width:0.5px]"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Avatar className="h-7 w-7 shrink-0 border border-white/10">
              <AvatarImage src={artwork} alt={title} className="object-cover" />
              <AvatarFallback className="bg-neutral-800 text-[10px] text-white">S</AvatarFallback>
            </Avatar>

            <div className="flex flex-col min-w-0 flex-1 justify-center leading-tight">
              <span className="text-xs font-semibold truncate text-white/90">{title}</span>
              <span className="text-[10px] text-white/60 truncate">{artist}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
            <span className="text-[10px] font-mono text-white/50 shrink-0">
              {formatTime(currentTime)}
            </span>

            <IconButton
              icon="favorite"
              size={SIZES.heart}
              filled={isLiked}
              active={isLiked}
              onClick={(e) => {
                e.stopPropagation();
                if (onToggleLike) onToggleLike();
              }}
              className={!isLiked ? "text-white/40 hover:text-white" : "text-white"}
            />

            {playlists && playlists.length > 0 && onAddToPlaylist && activeTrack && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div>
                    <IconButton
                      icon="playlist_add"
                      size={SIZES.heart}
                      filled={false}
                      className="text-white/40 hover:text-white"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuPortal>
                  <GlassDropdownMenuContent
                    glassVariant="frosted"
                    align="end"
                    sideOffset={6}
                    className="w-44"
                  >
                    {playlists.map((pl, index) => (
                      <DropdownMenuItem
                        key={`${pl.id}-${index}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddToPlaylist(pl.id, activeTrack.id);
                        }}
                      >
                        <span className="text-white text-xs truncate">{pl.title}</span>
                      </DropdownMenuItem>
                    ))}
                  </GlassDropdownMenuContent>
                </DropdownMenuPortal>
              </DropdownMenu>
            )}
          </div>

          {/* Interactive Progress Bar */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] cursor-pointer pointer-events-auto">
            <div 
              className="h-full w-full pointer-events-none"
              style={{
                background: `linear-gradient(to right, rgba(255, 255, 255, 0.95) ${progressPercent}%, rgba(255, 255, 255, 0.15) ${progressPercent}%)`,
              }}
            />
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={(e) => {
                if (onSeek) onSeek(Number(e.target.value));
              }}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
          </div>
        </LiquidGlass>

        {/* Right Utility Controls */}
        <div className="flex items-center gap-1 text-white/70 shrink-0">
          <IconButton
            icon="lyrics"
            size={SIZES.utility}
            onClick={onOpenExpandedView}
            className="text-white/60 hover:text-white"
          />
          <IconButton 
            icon="queue_music" 
            size={SIZES.utility} 
            onClick={onNavigateToPlaylists}
            className="text-white/60 hover:text-white"
          />

          {/* Volume Expansion */}
          <div className="flex items-center group relative">
            <IconButton 
              icon={getVolumeIcon()} 
              size={SIZES.utility} 
              onClick={handleMuteToggle} 
              className="text-white/60 hover:text-white"
            />
            <div className="w-0 opacity-0 group-hover:w-16 group-hover:opacity-100 transition-all duration-300 ease-in-out overflow-hidden flex items-center ml-0 group-hover:ml-1 relative h-4">
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (setVolume) setVolume(val);
                  if (val > 0) prevVolumeRef.current = val;
                }}
                className="w-full h-1 rounded-full appearance-none cursor-pointer focus:outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-0 [&::-webkit-slider-thumb]:h-0"
                style={{
                  background: `linear-gradient(to right, #ffffff ${volume}%, rgba(255, 255, 255, 0.2) ${volume}%)`,
                }}
              />
            </div>
          </div>
        </div>
      </LiquidGlass>
    </div>
  );
}