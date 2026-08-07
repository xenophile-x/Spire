// src/components/TrackCard.jsx
import React from "react";
import { GlassIcon } from "@/components/ui/glasscn/glass-icon";
import { Play } from "lucide-react";

const DEFAULT_COVER =
  "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=300";

export default function TrackCard({ track, onPlayTrack, widthClass = "w-full" }) {
  return (
    <div
      onClick={() => onPlayTrack(track)}
      className={`group cursor-pointer shrink-0 ${widthClass} flex flex-col text-left transition-all`}
    >
      {/* Image wrapper */}
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

        {/* Glass shimmer overlay on hover */}
        <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-gradient-to-t from-black/20 via-transparent to-white/5 ring-1 ring-white/20" />

        {/* Play button — simple glass icon, no heavy blur */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <GlassIcon
            size="lg"
            className="bg-white/10 text-white border border-white/20"
            onClick={(e) => {
              e.stopPropagation();
              onPlayTrack?.(track);
            }}
          >
            <Play className="h-5 w-5 fill-current" />
          </GlassIcon>
        </div>
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