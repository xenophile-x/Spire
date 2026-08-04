// src/components/AppleMusicBar.jsx
import React, { useRef } from "react";
import "material-symbols/rounded.css";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const SIZES = {
  shuffleRepeat: { btnSize: 24, iconSize: 16 },
  skip:          { btnSize: 28, iconSize: 28 },
  playPause:     { btnSize: 36, iconSize: 34 },
  heart:         { btnSize: 24, iconSize: 13 },
  utility:       { btnSize: 32, iconSize: 20 },
};

// Helper function to parse LRC strings (Exported so ExpandedLyricsView can use it)
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
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      style={{ width: `${size.btnSize}px`, height: `${size.btnSize}px` }}
      className={`rounded-full hover:bg-transparent hover:text-white focus-visible:!ring-0 focus-visible:!ring-offset-0 focus-visible:!outline-none active:scale-95 p-0 flex items-center justify-center shrink-0 ${
        active ? "text-white" : "text-white/70"
      } ${className}`}
    >
      <span
        className="material-symbols-rounded leading-none"
        style={{
          fontSize: `${size.iconSize}px`,
          fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 300`
        }}
      >
        {icon}
      </span>
    </Button>
  );
}

function formatTime(seconds = 0) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

export default function AppleMusicBar({
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
  isLiked = false,
  onToggleLike,
  onOpenExpandedView, // <-- Triggers full-screen lyrics view
}) {
  const [isShuffle, setIsShuffle] = React.useState(false);
  const [isRepeat, setIsRepeat] = React.useState(false);
  const prevVolumeRef = useRef(70);

  const handleMuteToggle = () => {
    if (volume > 0) {
      prevVolumeRef.current = volume;
      setVolume(0);
    } else {
      setVolume(prevVolumeRef.current || 50);
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
    activeTrack?.artwork_url ||
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcROI_5JGYlS_YRp0ylBV2yvzaKGygvjho9pj0ew4lnhiCngweVEnEU0QCY&s=10";

  return (
    <div className="flex flex-col items-center justify-center p-2 select-none font-sans relative w-full max-w-2xl mx-auto">
      <Card className="w-full rounded-full bg-white/15 backdrop-blur-2xl border-white/20 shadow-2xl text-white border p-0">
        <CardContent className="flex items-center justify-between p-2 px-3 gap-2">
          
          {/* Controls */}
          <div className="flex items-center gap-1 shrink-0">
            <IconButton
              icon="shuffle"
              size={SIZES.shuffleRepeat}
              active={isShuffle}
              onClick={() => setIsShuffle(!isShuffle)}
              className={!isShuffle ? "text-white/40" : ""}
            />
            <IconButton icon="fast_rewind" size={SIZES.skip} onClick={onPrevious} />
            <IconButton
              icon={isPlaying ? "pause" : "play_arrow"}
              size={SIZES.playPause}
              active
              onClick={() => setIsPlaying(!isPlaying)}
            />
            <IconButton icon="fast_forward" size={SIZES.skip} onClick={onNext} />
            <IconButton
              icon="repeat"
              size={SIZES.shuffleRepeat}
              active={isRepeat}
              onClick={() => setIsRepeat(!isRepeat)}
              className={!isRepeat ? "text-white/40" : ""}
            />
          </div>

          {/* Center Details Pill (Clicking this or lyrics button opens Full Lyrics View) */}
          <div 
            onClick={onOpenExpandedView}
            className="relative overflow-hidden flex-1 rounded-full bg-black/10 hover:bg-white/10 cursor-pointer transition-colors border border-white/10 min-w-0 flex items-center justify-between gap-2 p-1 px-2.5"
          >
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={artwork} alt={title} className="object-cover" />
              <AvatarFallback className="bg-neutral-800 text-[10px]">S</AvatarFallback>
            </Avatar>

            <div className="flex flex-col min-w-0 flex-1 leading-tight">
              <span className="text-xs font-semibold truncate text-white/90">{title}</span>
              <span className="text-[10px] text-white/60 truncate">{artist}</span>
            </div>

            <span className="text-[10px] font-mono text-white/60 shrink-0 px-1">
              {formatTime(currentTime)}
            </span>

            <IconButton
              icon="favorite"
              size={SIZES.heart}
              filled={isLiked}
              active={isLiked}
              onClick={(e) => {
                e.stopPropagation(); // Prevents opening lyrics view when toggling like
                onToggleLike();
              }}
              className={!isLiked ? "text-white/60" : "text-rose-500"}
            />

            {/* Progress Bar */}
            <div className="absolute bottom-0 left-0 right-0 flex items-center px-3 pointer-events-none">
              <div 
                className="h-[2px] w-full transition-all"
                style={{
                  background: `linear-gradient(to right, rgba(255, 255, 255, 0.95) ${progressPercent}%, rgba(255, 255, 255, 0.15) ${progressPercent}%)`,
                }}
              />
            </div>
          </div>

          {/* Right Utilities */}
          <div className="flex items-center gap-1 text-white/70 shrink-0">
            <IconButton
              icon="lyrics"
              size={SIZES.utility}
              onClick={onOpenExpandedView}
            />
            <IconButton icon="queue_music" size={SIZES.utility} />

            <div className="flex items-center group relative">
              <IconButton icon={getVolumeIcon()} size={SIZES.utility} onClick={handleMuteToggle} />
              <div className="w-0 opacity-0 group-hover:w-20 group-hover:opacity-100 transition-all duration-300 ease-in-out overflow-hidden flex items-center ml-0 group-hover:ml-1">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => setVolume && setVolume(Number(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer focus:outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-0 [&::-webkit-slider-thumb]:h-0"
                  style={{
                    background: `linear-gradient(to right, #ffffff ${volume}%, rgba(255, 255, 255, 0.2) ${volume}%)`,
                  }}
                />
              </div>
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}