import React, { useState, useRef } from "react";
import "material-symbols/rounded.css";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { GlassProgress } from "@/components/ui/glasscn/glass-progress";

const SIZES = {
  shuffleRepeat: { btnSize: 24, iconSize: 16 },
  skip:          { btnSize: 28, iconSize: 28 },
  playPause:     { btnSize: 36, iconSize: 34 },
  heart:         { btnSize: 24, iconSize: 13 },
  utility:       { btnSize: 32, iconSize: 20 },
};

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
        style={{ fontSize: `${size.iconSize}px`, fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 300` }}
      >
        {icon}
      </span>
    </Button>
  );
}

export default function AppleMusicBar() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [currentTime, setCurrentTime] = useState(84);
  const [volume, setVolume] = useState(70);

  const duration = 238;
  const prevVolumeRef = useRef(70);

  const handleMuteToggle = () => {
    if (volume > 0) (prevVolumeRef.current = volume), setVolume(0);
    else setVolume(prevVolumeRef.current || 50);
  };

  const getVolumeIcon = () => (volume === 0 ? "volume_off" : volume < 30 ? "volume_mute" : volume < 70 ? "volume_down" : "volume_up");

  // Single const array for left buttons
  const leftControls = [
    { icon: "shuffle", size: SIZES.shuffleRepeat, active: isShuffle, onClick: () => setIsShuffle(!isShuffle), cls: !isShuffle ? "text-white/40" : "" },
    { icon: "fast_rewind", size: SIZES.skip },
    { icon: isPlaying ? "pause" : "play_arrow", size: SIZES.playPause, active: true, onClick: () => setIsPlaying(!isPlaying) },
    { icon: "fast_forward", size: SIZES.skip },
    { icon: "repeat", size: SIZES.shuffleRepeat, active: isRepeat, onClick: () => setIsRepeat(!isRepeat), cls: !isRepeat ? "text-white/40" : "" },
  ];

  return (
    <div className="flex items-center justify-center min-h-screen p-4 select-none font-sans">
      <div className="w-full max-w-2xl rounded-full glass bg-white/10 backdrop-blur-2xl border border-white/20 text-white p-2 px-3 flex items-center justify-between gap-3 shadow-2xl">
        
        {/* Left Playback Controls mapped from single const */}
        <div className="flex items-center gap-1 shrink-0">
          {leftControls.map((btn, i) => (
            <IconButton key={i} icon={btn.icon} size={btn.size} active={btn.active} onClick={btn.onClick} className={btn.cls} />
          ))}
        </div>

        {/* Center Track Details Pill */}
        <div className="relative overflow-hidden flex-1 h-11 rounded-full bg-black/10 border border-white/10 min-w-0 flex items-center px-2.5 gap-2.5">
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarImage src="https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=150" alt="Heat Waves" />
            <AvatarFallback className="bg-neutral-800 text-[10px]">HW</AvatarFallback>
          </Avatar>

          <div className="flex flex-col min-w-0 flex-1 justify-center leading-none">
            <span className="text-xs font-semibold truncate text-white/90">Heat Waves</span>
            <span className="text-[10px] text-white/60 truncate mt-0.5">Glass Animals • Dreamland</span>
          </div>

          <span className="text-[10px] font-mono text-white/60 shrink-0">3:58</span>
          <IconButton icon="favorite" size={SIZES.heart} filled={isLiked} active={isLiked} onClick={() => setIsLiked(!isLiked)} className={!isLiked ? "text-white/60" : ""} />

          {/* Interactive Progress Bar */}
          <div className="absolute bottom-0 left-0 right-0 h-[3px] cursor-pointer">
            <GlassProgress value={(currentTime / duration) * 100} className="h-full rounded-none pointer-events-none" />
            <input type="range" min="0" max={duration} value={currentTime} onChange={(e) => setCurrentTime(Number(e.target.value))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
          </div>
        </div>

        {/* Right Utilities & Collapsible Volume */}
        <div className="flex items-center gap-1 text-white/70 shrink-0">
          {["lyrics", "queue_music"].map((icon) => (
            <IconButton key={icon} icon={icon} size={SIZES.utility} />
          ))}

          <div className="flex items-center group relative">
            <IconButton 
              icon={getVolumeIcon()} 
              size={SIZES.utility} 
              onClick={handleMuteToggle} 
              className="transition-all duration-300 group-hover:text-white group-focus-within:text-white group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] group-focus-within:drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]"
            />
            <div className="w-0 opacity-0 group-hover:w-16 group-hover:opacity-100 group-focus-within:w-16 group-focus-within:opacity-100 transition-all duration-300 overflow-hidden flex items-center ml-0 group-hover:ml-1 relative h-4">
              <GlassProgress value={volume} className="h-1.5 w-full pointer-events-none" />
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setVolume(val);
                  if (val > 0) prevVolumeRef.current = val;
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

