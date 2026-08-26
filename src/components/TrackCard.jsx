import React, { useState } from "react";
import { Play } from "lucide-react";
import "material-symbols/rounded.css";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { GlassDropdownMenuContent } from "@/components/ui/glasscn/glass-dropdown-menu";
import { LiquidGlass } from "@/components/ui/glasscn/liquid-glass";
import DeleteTrackConfirmationDialog from "@/components/DeleteTrackConfirmationDialog";

const DEFAULT_COVER =
  "https://cdn.saleminteractivemedia.com/shared/images/default-cover-art.png";

export default function TrackCard({
  track,
  onPlayTrack,
  widthClass = "w-full",
  playlists = [],
  onAddToPlaylist,
  onDeleteTrack,
}) {
  const showAddToPlaylist =
    playlists && playlists.length > 0 && onAddToPlaylist && !track.isShared;
  const showDelete = onDeleteTrack && !track.isShared;
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = () => {
    onDeleteTrack(track);
  };
  return (
    <>
      <div
        onClick={() => onPlayTrack(track)}
        className={`group cursor-pointer shrink-0 ${widthClass} flex flex-col text-left transition-all`}
      >
        <div className="relative aspect-square w-full rounded-2xl overflow-hidden mb-2.5 shadow-md transition-shadow duration-300 group-hover:shadow-xl group-hover:shadow-black/40">
          <img
            src={track.cover || track.artworkUrl || DEFAULT_COVER}
            alt={track.title}
            loading="lazy"
            decoding="async"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = DEFAULT_COVER;
            }}
            className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
          />

          <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-gradient-to-t from-black/20 via-transparent to-white/5 ring-1 ring-white/20" />

          {track.isShared && (
            <div
              className="absolute left-2 top-2 z-20 flex max-w-[85%] items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 backdrop-blur-sm border border-white/15"
              title={`Shared by ${track.sharedBy || "a friend"}`}
            >
              <span className="material-symbols-rounded text-[12px] leading-none text-emerald-300">
                group
              </span>
              <span className="text-[10px] font-medium text-white/90 truncate">
                {track.sharedBy || "Shared"}
              </span>
            </div>
          )}

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

          {(showAddToPlaylist || showDelete) && (
            <div
              className="absolute right-2 top-2 z-30 flex flex-col items-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {showAddToPlaylist && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label="Add to playlist"
                      className="cursor-pointer rounded-full p-2 flex items-center justify-center bg-black/35 backdrop-blur-sm border border-white/15 transition-colors hover:bg-white/10 outline-none"
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
              )}

              {showDelete && (
                <LiquidGlass
                  blur={10}
                  refraction={18}
                  saturation={1.6}
                  role="button"
                  tabIndex={0}
                  aria-label="Delete from library"
                  onClick={handleDelete}
                  className="flex h-10 w-10 cursor-pointer items-center justify-center bg-white/15 border border-white/30 [--liquid-glass-rim-light:rgba(255,255,255,0.7)] transition-all outline-none hover:bg-white/25 hover:scale-105 shadow-lg shadow-black/10"
                >
                  <span className="material-symbols-rounded text-[24px] text-white">delete</span>
                </LiquidGlass>
              )}
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
      <DeleteTrackConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        track={track}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}