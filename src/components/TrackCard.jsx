import React from "react";
import { Play } from "lucide-react";
import "material-symbols/rounded.css";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { GlassDropdownMenuContent } from "@/components/ui/glasscn/glass-dropdown-menu";

const DEFAULT_COVER =
  "https://cdn.saleminteractivemedia.com/shared/images/default-cover-art.png";

export default function TrackCard({
  track,
  onPlayTrack,
  widthClass = "w-full",
  playlists = [],
  onAddToPlaylist,
}) {
  return (
    <div
      onClick={() => onPlayTrack(track)}
      className={`group cursor-pointer shrink-0 ${widthClass} flex flex-col text-left transition-all`}
    >
      <div className="relative aspect-square w-full rounded-2xl overflow-hidden mb-2.5 shadow-md transition-shadow duration-300 group-hover:shadow-xl group-hover:shadow-black/40">
        <img
          src={track.cover || track.artworkUrl || DEFAULT_COVER}
          alt={track.title}
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = DEFAULT_COVER;
          }}
          className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
        />

        <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-gradient-to-t from-black/20 via-transparent to-white/5 ring-1 ring-white/20" />

        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div
            role="button"
            tabIndex={0}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md border border-white/20 hover:bg-white/20 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onPlayTrack?.(track);
            }}
          >
            <Play className="h-5 w-5 fill-current" />
          </div>
        </div>

        {playlists && playlists.length > 0 && onAddToPlaylist && (
          <div
            className="absolute right-2 top-2 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenu>
  <DropdownMenuTrigger asChild>
   
    <div
      role="button"
      tabIndex={0}
      className="cursor-pointer rounded-full p-2 flex items-center justify-center transition-colors hover:bg-white/10 outline-none"
    >
      <span className="material-symbols-rounded text-[24px]">playlist_add</span>
    </div>
  </DropdownMenuTrigger>
  <DropdownMenuPortal>
    <GlassDropdownMenuContent
      glassVariant="frosted"
      align="end"
      sideOffset={4}
      className="w-44"
    >
      {playlists.map((pl, index) => (
        <DropdownMenuItem
          key={`${pl.id}-${index}`}
          onClick={() => onAddToPlaylist(pl.id, track.id)}
        >
          <span className="text-white text-xs truncate">{pl.title}</span>
        </DropdownMenuItem>
      ))}
    </GlassDropdownMenuContent>
  </DropdownMenuPortal>
</DropdownMenu>
          </div>
        )}
      </div>

      <p className="text-xs font-semibold text-white truncate w-full leading-snug">
        {track.title}
      </p>
      <p className="text-[11px] text-white/60 truncate w-full leading-snug mt-0.5">
        {track.artist}
      </p>
    </div>
  );
}