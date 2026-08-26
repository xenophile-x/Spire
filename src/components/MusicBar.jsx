
import React, { useRef, useState, useEffect } from "react";
import "material-symbols/rounded.css";
import { DEFAULT_COVER } from "@/utils/trackMetadata";
import { LiquidGlass } from "@/components/ui/glasscn/liquid-glass";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { GlassDropdownMenuContent } from "@/components/ui/glasscn/glass-dropdown-menu";
import { useRadioStation } from "@/hooks/useRadioStation";
import { usePlayerTime } from "@/context/PlayerContext";
import RadioStationDropdown from "@/components/RadioStationDropdown";
import { formatTime } from "@/utils/formatters";
import { formatFrequency } from "@/constants/radioStations";
import { cn } from "@/lib/utils";
import { resolveTrackCover } from "@/services/metadataService";

const SIZES = {
  shuffleRepeat: { btnSize: 26, iconSize: 18 },
  skip:          { btnSize: 30, iconSize: 26 },
  playPause:     { btnSize: 40, iconSize: 34 },
  heart:         { btnSize: 24, iconSize: 16 },
  utility:       { btnSize: 30, iconSize: 20 },
};

const SPATIAL_EFFECTS = [
  { icon: "spatial_speaker", activeKey: "is8DActive", toggleKey: "toggle8D", label: "8D Audio" },
  { icon: "stadium", activeKey: "isReverbActive", toggleKey: "toggleReverb", label: "Concert Hall" },
  { icon: "cadence", activeKey: "isNightcoreActive", toggleKey: "toggleNightcore", label: "Nightcore" },
];

function IconButton({ icon, size, onClick, active = false, filled = true, className = "", title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
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

function VinylDisc({ src, alt }) {
  return (
    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-black shadow-[0_2px_10px_rgba(0,0,0,0.55)]">
      <div className="absolute inset-0 rounded-full bg-[repeating-radial-gradient(circle_at_center,rgba(255,255,255,0.10)_0px,rgba(255,255,255,0.03)_1px,rgba(255,255,255,0)_2px)]" />
      <div className="absolute left-1/2 top-1/2 h-[62%] w-[62%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border border-white/25 shadow-lg">
        <img
          src={src || DEFAULT_COVER}
          alt={alt}
          className="h-full w-full object-cover"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = DEFAULT_COVER;
          }}
        />
      </div>
      <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black ring-1 ring-white/40" />
    </div>
  );
}

export default function MusicBar({
  activeTrack,
  isPlaying,
  onTogglePlay,
  duration = 0,
  volume = 70,
  setVolume,
  isShuffle = false,
  onToggleShuffle,
  isRepeat = false,
  onToggleRepeat,
  isRadioMode = false,
  onToggleRadio,
  onStationChange,
  onSeek,
  onNext,
  onPrevious,
  isLiked = false,
  onToggleLike,
  onOpenExpandedView,
  onOpenLyrics,
  playlists = [],
  onAddToPlaylist,
  spatialAudio = null,
}) {

  const { currentTime } = usePlayerTime();
  const prevVolumeRef = useRef(70);
  const [spatialHovered, setSpatialHovered] = useState(false);
  const [scrubTime, setScrubTime] = useState(null);
  const [coverUrl, setCoverUrl] = useState(activeTrack?.cover_url || activeTrack?.artwork_url || activeTrack?.cover || DEFAULT_COVER);

  const displayTime = scrubTime ?? currentTime;

  const commitScrub = () => {
    if (scrubTime != null) {
      onSeek?.(scrubTime);
      setScrubTime(null);
    }
  };

  const progressPercent = duration > 0 ? (displayTime / duration) * 100 : 0;

  const { stations, selectedStation, selectStation } = useRadioStation();

  const handleSelectStation = (station) => {
    selectStation(station);
    onStationChange?.(station);
  };

  useEffect(() => {
    if (!activeTrack) return;

    resolveTrackCover(
      activeTrack.id,
      activeTrack.title,
      activeTrack.artist,
      activeTrack.cover_url || activeTrack.artwork_url || activeTrack.cover
    ).then(setCoverUrl);
  }, [activeTrack]);

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

  const title = activeTrack?.title || activeTrack?.canonical_title || "No Track Playing";
  const artist = activeTrack?.artist || activeTrack?.canonical_artist || "Select a song";

  return (
    <div className="flex flex-col items-center justify-center select-none font-sans relative w-full max-w-2xl mx-auto p-1">
      <LiquidGlass
        blur={12}
        refraction={14}
        saturation={1.45}
        className="flex h-16 w-full items-center justify-between gap-2 sm:gap-3 rounded-full px-3 sm:px-4 border border-white/20 glass-rim-bright"
      >

        <div className="sm:hidden flex w-full items-center justify-between gap-1.5">
          <div
            className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
            onClick={onOpenExpandedView}
          >
            <VinylDisc src={coverUrl} alt={title} />
            <div className="flex flex-col min-w-0 justify-center leading-tight">
              <span className="text-xs font-semibold truncate text-white/90">{title}</span>
              <span className="text-[10px] text-white/60 truncate">{artist}</span>
            </div>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <IconButton icon="fast_rewind" size={SIZES.skip} onClick={onPrevious} />
            <IconButton
              icon={isPlaying ? "pause" : "play_arrow"}
              size={SIZES.playPause}
              active
              onClick={onTogglePlay}
            />
            <IconButton icon="fast_forward" size={SIZES.skip} onClick={onNext} />
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <IconButton
              icon="favorite"
              size={SIZES.heart}
              filled={isLiked}
              active={isLiked}
              onClick={onToggleLike}
              className={!isLiked ? "text-white/40 hover:text-white" : "text-white"}
            />
            <RadioStationDropdown
              stations={stations}
              selectedStation={selectedStation}
              isRadioMode={isRadioMode}
              onSelectStation={handleSelectStation}
              onStopRadio={onToggleRadio}
              trigger={
                <div>
                  <IconButton
                    icon="radio"
                    size={SIZES.utility}
                    active={isRadioMode}
                    className={cn(!isRadioMode ? "text-white/60 hover:text-white" : "text-white")}
                    title={isRadioMode ? selectedStation?.name : "Start Radio"}
                  />
                </div>
              }
            />
          </div>
        </div>


        <div className="hidden sm:flex w-full items-center justify-between gap-3">

        <div className="flex items-center gap-1 shrink-0">
          {isRadioMode ? (
            <>
              <IconButton icon="fast_rewind" size={SIZES.skip} onClick={onPrevious} />
              <IconButton
                icon={isPlaying ? "pause" : "play_arrow"}
                size={SIZES.playPause}
                active
                onClick={onTogglePlay}
              />
              <IconButton icon="fast_forward" size={SIZES.skip} onClick={onNext} />
            </>
          ) : (
            <>
              <IconButton
                icon="shuffle"
                size={SIZES.shuffleRepeat}
                active={isShuffle}
                onClick={onToggleShuffle}
                className={cn(!isShuffle ? "text-white/30 hover:text-white" : "text-white", "hidden sm:flex")}
              />
              <IconButton icon="fast_rewind" size={SIZES.skip} onClick={onPrevious} />
              <IconButton
                icon={isPlaying ? "pause" : "play_arrow"}
                size={SIZES.playPause}
                active
                onClick={onTogglePlay}
              />
              <IconButton icon="fast_forward" size={SIZES.skip} onClick={onNext} />
              <IconButton
                icon="repeat"
                size={SIZES.shuffleRepeat}
                active={isRepeat}
                onClick={onToggleRepeat}
                className={cn(!isRepeat ? "text-white/30 hover:text-white" : "text-white", "hidden sm:flex")}
              />
            </>
          )}
        </div>


        <LiquidGlass
          blur={4}
          refraction={6}
          saturation={1.2}
          variant="liquid"
          onClick={onOpenExpandedView}
          className="relative flex h-12 max-w-lg flex-1 items-center justify-between overflow-hidden rounded-full px-3 border border-white/10 shadow-inner cursor-pointer [--liquid-glass-rim-width:0.5px]"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <VinylDisc src={coverUrl} alt={title} />

            <div className="flex flex-col min-w-0 flex-1 justify-center leading-tight">
              <span className="text-xs font-semibold truncate text-white/90">{title}</span>
              <span className="text-[10px] text-white/60 truncate">{artist}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
            {isRadioMode ? (
              <LiquidGlass
                blur={6}
                refraction={6}
                saturation={1.2}
                className="flex h-5 shrink-0 items-center gap-1.5 rounded-full px-2.5 [--liquid-glass-rim-width:0.5px]"
              >
                <span className="text-[9px] font-bold tracking-wide text-white font-mono">
                  {formatFrequency(selectedStation.frequency)} FM
                </span>
              </LiquidGlass>
            ) : (
              <span className="hidden sm:block text-[10px] font-mono text-white/50 shrink-0">
                {formatTime(displayTime)}
              </span>
            )}

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
          </div>


          <div className={`hidden sm:block absolute bottom-0 left-0 right-0 h-5 ${isRadioMode ? "pointer-events-none" : "cursor-pointer pointer-events-auto"}`}>
            <div
              className="absolute bottom-0 left-0 right-0 h-[2px] pointer-events-none"
              style={{
                background: isRadioMode
                  ? "rgba(255, 255, 255, 1)"
                  : `linear-gradient(to right, rgba(255, 255, 255, 0.95) ${progressPercent}%, rgba(255, 255, 255, 0.15) ${progressPercent}%)`,
              }}
            />
            {!isRadioMode && (
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={displayTime}
                onChange={(e) => setScrubTime(Number(e.target.value))}
                onPointerUp={commitScrub}
                onKeyUp={commitScrub}
                onBlur={commitScrub}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
            )}
          </div>
        </LiquidGlass>


        <div className="flex items-center gap-1 text-white/70 shrink-0">
          <div
            className={`overflow-hidden transition-all duration-300 ${
              spatialHovered ? "w-0 opacity-0 pointer-events-none" : "w-auto opacity-100"
            }`}
          >
            {activeTrack && (
              <IconButton
                icon="lyrics"
                size={SIZES.utility}
                onClick={onOpenLyrics || onOpenExpandedView}
                className="text-white/60 hover:text-white"
              />
            )}
          </div>
          <div
            className={`overflow-hidden transition-all duration-300 ${
              spatialHovered ? "w-0 opacity-0 pointer-events-none" : "w-auto opacity-100"
            }`}
          >
            {activeTrack && onAddToPlaylist && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div>
                  <IconButton
                    icon="playlist_add"
                    size={SIZES.utility}
                    filled={false}
                    className="text-white/60 hover:text-white"
                  />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuPortal>
                <GlassDropdownMenuContent
                  glassVariant="frosted"
                  align="end"
                  sideOffset={6}
                  className="w-52"
                >
                  {playlists.length > 0 ? (
                    playlists.map((pl, index) => (
                      <DropdownMenuItem
                        key={`${pl.id}-${index}`}
                        onClick={() => activeTrack && onAddToPlaylist(pl.id, activeTrack.id)}
                      >
                        <span className="text-white text-xs truncate">{pl.title}</span>
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <DropdownMenuItem disabled>
                      <span className="text-white/50 text-xs">No playlists yet</span>
                    </DropdownMenuItem>
                  )}
                </GlassDropdownMenuContent>
              </DropdownMenuPortal>
            </DropdownMenu>
          )}
          </div>
          <RadioStationDropdown
            stations={stations}
            selectedStation={selectedStation}
            isRadioMode={isRadioMode}
            onSelectStation={handleSelectStation}
            onStopRadio={onToggleRadio}
            trigger={
              <div>
                <IconButton
                  icon="radio"
                  size={SIZES.utility}
                  active={isRadioMode}
                  className={cn(!isRadioMode ? "text-white/60 hover:text-white" : "text-white")}
                  title={isRadioMode ? selectedStation.name : "Start Radio"}
                />
              </div>
            }
          />


          {spatialAudio && (
            <div
              className="flex items-center group relative"
              onMouseEnter={() => setSpatialHovered(true)}
              onMouseLeave={() => setSpatialHovered(false)}
            >
              <IconButton
                icon="arrow_menu_open"
                size={SIZES.utility}
                active={
                  spatialAudio.is8DActive ||
                  spatialAudio.isReverbActive ||
                  spatialAudio.isNightcoreActive
                }
                onClick={() => {
                  if (spatialAudio.is8DActive) spatialAudio.toggle8D();
                  else if (spatialAudio.isReverbActive) spatialAudio.toggleReverb();
                  else if (spatialAudio.isNightcoreActive) spatialAudio.toggleNightcore();
                  else spatialAudio.toggle8D();
                }}
                title="Spatial audio"
              />
              <div className="hidden sm:flex w-0 opacity-0 group-hover:w-auto group-hover:opacity-100 transition-all duration-300 ease-in-out overflow-hidden items-center ml-0 group-hover:ml-1">
                {SPATIAL_EFFECTS.map((effect) => (
                  <IconButton
                    key={effect.icon}
                    icon={effect.icon}
                    size={SIZES.utility}
                    active={spatialAudio[effect.activeKey]}
                    onClick={spatialAudio[effect.toggleKey]}
                    title={`${effect.label}: ${spatialAudio[effect.activeKey] ? "ON" : "OFF"}`}
                  />
                ))}
              </div>
            </div>
          )}


          <div className="hidden sm:flex items-center group relative">
            <IconButton
              icon={getVolumeIcon()}
              size={SIZES.utility}
              onClick={handleMuteToggle}
              className="text-white/60 hover:text-white group-hover:text-white"
            />
            <div className="w-0 opacity-0 group-hover:w-20 group-hover:opacity-100 transition-all duration-300 ease-in-out overflow-hidden flex items-center ml-0 group-hover:ml-1 relative h-4">
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
        </div>
      </LiquidGlass>


      <div className="sm:hidden mt-1.5 w-full flex items-center gap-2 px-1">
        {isRadioMode ? (
          <span className="text-[9px] font-bold tracking-wide text-white/80 shrink-0 font-mono">
            {formatFrequency(selectedStation.frequency)} FM
          </span>
        ) : (
          <span className="text-[10px] font-mono text-white/50 shrink-0 w-9 text-right tabular-nums">
            {formatTime(displayTime)}
          </span>
        )}
        <div className={`relative flex-1 h-6 ${isRadioMode ? "pointer-events-none" : "cursor-pointer"}`}>
          <div
            className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-[4px] rounded-full pointer-events-none"
            style={{
              background: isRadioMode
                ? "rgba(255, 255, 255, 1)"
                : `linear-gradient(to right, rgba(255, 255, 255, 0.95) ${progressPercent}%, rgba(255, 255, 255, 0.15) ${progressPercent}%)`,
            }}
          />
          {!isRadioMode && (
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={displayTime}
              onChange={(e) => setScrubTime(Number(e.target.value))}
              onPointerUp={commitScrub}
              onKeyUp={commitScrub}
              onBlur={commitScrub}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer [touch-action:none]"
            />
          )}
        </div>
        {!isRadioMode && (
          <span className="text-[10px] font-mono text-white/50 shrink-0 w-9 tabular-nums">{formatTime(duration)}</span>
        )}
      </div>
    </div>
  );
}