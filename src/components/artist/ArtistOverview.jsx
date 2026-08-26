import React, { useState } from "react";
import { Play } from "lucide-react";
import "material-symbols/rounded.css";
import { LiquidGlass } from "@/components/ui/glasscn/liquid-glass";
import { GlassCard } from "@/components/ui/glasscn/glass-card";
import ImageWithFallback from "@/components/ImageWithFallback";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { GlassDropdownMenuContent } from "@/components/ui/glasscn/glass-dropdown-menu";
import { DEFAULT_COVER } from "@/utils/trackMetadata";
import DeleteTrackConfirmationDialog from "@/components/DeleteTrackConfirmationDialog";

function trackCover(track) {
  return track.cover || track.artworkUrl || track.artwork_url || DEFAULT_COVER;
}

function trackYear(track) {
  if (track.release_year) return track.release_year;
  if (track.uploadedAt) return new Date(track.uploadedAt).getFullYear();
  return "";
}

export default function ArtistOverview({
  artistName,
  sortedTracks = [],
  latestRelease,
  onPlayTrack,
  playlists = [],
  onAddToPlaylist,
  onDeleteTrack,
}) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [trackToDelete, setTrackToDelete] = useState(null);

  const handleDeleteClick = (track) => {
    setTrackToDelete(track);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = () => {
    if (trackToDelete) {
      onDeleteTrack(trackToDelete);
    }
    setTrackToDelete(null);
    setShowDeleteDialog(false);
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[1.15fr_2fr] md:grid-rows-1 animate-in fade-in duration-500 pb-8 min-h-0 flex-1">

      <div className="space-y-6 flex flex-col items-start">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/85 pl-1 shrink-0">
          Latest Addition
        </h2>
        {latestRelease && (
          <GlassCard
            glassVariant="liquid-refract"
            liquidProps={{ blur: 12, refraction: 22, saturation: 1.6 }}
            surfaceClassName="rounded-3xl border border-white/30 bg-white/10 [--liquid-glass-rim-light:rgba(255,255,255,0.65)]"
            className="p-4 flex flex-col h-full shadow-2xl shadow-black/10 w-full"
          >
            <div className="relative w-full aspect-square rounded-2xl overflow-hidden shadow-2xl shadow-black/60 mb-3 group">
              <ImageWithFallback
                src={trackCover(latestRelease)}
                fallbackSrc={DEFAULT_COVER}
                alt={latestRelease.title}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  onClick={() => onPlayTrack(latestRelease, null, artistName)}
                  className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white hover:scale-110 transition-transform"
                  aria-label={`Play ${latestRelease.title}`}
                >
                  <Play className="w-5 h-5 fill-current ml-1" />
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col justify-end">
              <h4
                className="text-base font-bold leading-tight text-white truncate drop-shadow-sm"
                title={latestRelease.title}
              >
                {latestRelease.title}
              </h4>
              <p className="mt-0.5 text-xs font-medium text-white/85 truncate">
                {trackYear(latestRelease)
                  ? `${artistName} · ${trackYear(latestRelease)}`
                  : artistName}
              </p>

              {playlists.length > 0 && onAddToPlaylist && (
                <div className="mt-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <LiquidGlass
                        blur={10}
                        refraction={16}
                        saturation={1.6}
                        role="button"
                        tabIndex={0}
                        className="inline-flex w-full justify-center cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-wider text-white bg-white/10 border border-white/25 [--liquid-glass-rim-light:rgba(255,255,255,0.6)] transition-all hover:bg-white/20"
                      >
                        <span className="material-symbols-rounded text-base leading-none">
                          add
                        </span>
                        Add to Playlist
                      </LiquidGlass>
                    </DropdownMenuTrigger>
                    <DropdownMenuPortal>
                      <GlassDropdownMenuContent
                        glassVariant="frosted"
                        align="center"
                        sideOffset={8}
                        className="w-56 bg-white/15 border-white/30"
                      >
                        {playlists.length > 0 ? (
                        playlists.map((pl) => (
                          <DropdownMenuItem
                            key={pl.id}
                            onClick={() =>
                              onAddToPlaylist(pl.id, latestRelease.id)
                            }
                            className="focus:bg-white/20 cursor-pointer"
                          >
                            <span className="text-sm font-medium text-white truncate">
                              {pl.title}
                            </span>
                          </DropdownMenuItem>
                        ))
                      ) : (
                        <DropdownMenuItem disabled>
                          <span className="text-sm text-white/50">No playlists yet</span>
                        </DropdownMenuItem>
                      )}
                      {!latestRelease?.isShared && onDeleteTrack && (
                        <>
                          <div className="my-1 h-px bg-white/10" />
                          <DropdownMenuItem
                            onClick={() => handleDeleteClick(latestRelease)}
                            className="focus:bg-red-500/20 cursor-pointer"
                          >
                            <span className="material-symbols-rounded mr-2 text-sm text-white">delete</span>
                            <span className="text-sm text-white font-medium">Delete from Library</span>
                          </DropdownMenuItem>
                        </>
                      )}
                      </GlassDropdownMenuContent>
                    </DropdownMenuPortal>
                  </DropdownMenu>
                </div>
              )}
            </div>
          </GlassCard>
        )}
      </div>


      <div className="space-y-4 flex flex-col min-h-0 md:min-h-[480px]">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/85 pl-1 shrink-0">
          Popular
        </h2>
        <GlassCard
          glassVariant="liquid-refract"
          liquidProps={{ blur: 12, refraction: 22, saturation: 1.6 }}
          surfaceClassName="rounded-xl border border-white/30 bg-white/[0.08] [--liquid-glass-rim-light:rgba(255,255,255,0.65)] flex flex-col flex-1 min-h-0"
          className="p-2 flex-1 min-h-0 shadow-2xl shadow-black/10 overflow-hidden flex flex-col"
        >

          <div className="overflow-y-auto flex-1 flex flex-col gap-1 pr-1 custom-scrollbar">
            {sortedTracks.map((track, index) => (
              <div
                key={track.id}
                onClick={() => onPlayTrack(track, null, artistName)}
                className="group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-all duration-300 hover:bg-white/5 shrink-0"
                role="button"
                aria-label={`Play ${track.title}`}
              >
                <span className="w-5 shrink-0 text-center text-sm font-semibold tabular-nums text-white/60 group-hover:text-white/90 transition-colors">
                  {index + 1}
                </span>
                <ImageWithFallback
                  src={trackCover(track)}
                  fallbackSrc={DEFAULT_COVER}
                  alt={track.title}
                  loading="lazy"
                  decoding="async"
                  className="h-11 w-11 shrink-0 rounded-xl object-cover border border-white/5"
                />
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-sm font-semibold text-white drop-shadow-sm"
                    title={track.title}
                  >
                    {track.title}
                  </p>
                  <p className="truncate text-xs font-medium text-white/75 mt-0.5">
                    {track.artist}
                    {trackYear(track) ? ` · ${trackYear(track)}` : ""}
                  </p>
                </div>
                <LiquidGlass
                  blur={6}
                  refraction={14}
                  saturation={1.6}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white opacity-0 scale-90 transition-all duration-300 group-hover:opacity-100 group-hover:scale-100 bg-white/20 border border-white/35 shadow-lg shadow-black/10"
                >
                  <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                </LiquidGlass>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
      <DeleteTrackConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        track={trackToDelete}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
