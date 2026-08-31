import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import TrackCard from "@/components/TrackCard";
import { LiquidGlass } from "@/components/ui/glasscn/liquid-glass";
import { GlassSkeleton } from "@/components/ui/glasscn/glass-skeleton";
import { splitArtistNames } from "@/utils/artistNames";
import { ArtistProfileImage } from "@/components/ui/MediaImages";
import { InfiniteCarousel } from "@/components/ui/InfiniteCarousel";
import PageHeader from "@/components/ui/PageHeader";
import { AppleResizableGrid, AppleResizableTile } from "@/components/ui/AppleResize";
import { useLibrary } from "@/context/LibraryContext";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export default function HomeView({
  userTracks = [],
  isUploading,
  onFileUpload,
  onPlayTrack,
  searchQuery = "",
  playlists = [],
  onAddToPlaylist,
  onDeleteTrack,
  libraryLoaded: libraryLoadedProp,
}) {
  const navigate = useNavigate();
  // Prefer explicit prop if provided (via AppRoutes), otherwise read from context
  let libraryLoadedFromContext = true;
  try {
    libraryLoadedFromContext = useLibrary()?.libraryLoaded ?? true;
  } catch {
    // outside provider (e.g. story / test) — treat as loaded
  }
  const libraryLoaded = libraryLoadedProp ?? libraryLoadedFromContext;

  const { recentTracks, artists } = useMemo(() => {
    const now = Date.now();
    const artistMap = {};
    const recent = [];
    for (const t of userTracks) {
      if (t.uploadedAt && now - new Date(t.uploadedAt).getTime() <= ONE_DAY_MS) {
        recent.push(t);
      }
      const names = splitArtistNames(t.artist);
      if (!names.length) continue;
      for (const name of names) {
        if (name.toLowerCase() === "unknown artist" || name.toLowerCase() === "unknown") continue;
        const entry =
          artistMap[name] || (artistMap[name] = { name, photo: "", description: "", count: 0 });
        if (!entry.photo && t.artistPhotoUrl) entry.photo = t.artistPhotoUrl;
        if (!entry.description && t.artistBio) entry.description = t.artistBio;
        entry.count += 1;
      }
    }
    return {
      recentTracks: recent,
      artists: Object.values(artistMap).sort((a, b) => b.count - a.count),
    };
  }, [userTracks]);

  const searchTerm = (searchQuery || "").trim().toLowerCase();

  const filteredTracks = useMemo(() => {
    if (!searchTerm) return [];
    return userTracks.filter(
      (t) =>
        (t.title || "").toLowerCase().includes(searchTerm) ||
        (t.artist || "").toLowerCase().includes(searchTerm)
    );
  }, [userTracks, searchTerm]);

  const filteredArtists = useMemo(() => {
    if (!searchTerm) return [];
    return artists.filter((a) => a.name.toLowerCase().includes(searchTerm));
  }, [artists, searchTerm]);

  const hasSearch = searchTerm.length > 0;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 pb-12">
      <PageHeader
        title="Home"
        subtitle={`${userTracks.length} tracks in library`}
        action={
          <label className="shrink-0 cursor-pointer">
            <LiquidGlass
              blur={8}
              refraction={10}
              className="rounded-full px-4 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90 [--liquid-glass-rim-width:0.5px]"
            >
              {isUploading ? "Uploading..." : "Upload Song"}
            </LiquidGlass>
            <input
              type="file"
              accept="audio/*"
              multiple
              onChange={onFileUpload}
              className="hidden"
              disabled={isUploading}
            />
          </label>
        }
      />

      {!libraryLoaded ? (
        <div className="w-full min-w-0 space-y-8 animate-in fade-in-0">
          {/* Top Artists — 9 skeletons (3 more) */}
          <div className="w-full min-w-0 space-y-3">
            <h2 className="text-lg font-bold text-white">Artists</h2>
            <div className="flex gap-5 overflow-hidden" aria-hidden="true" aria-label="Loading artists">
              {Array.from({ length: 9 }).map((_, i) => (
                <div
                  key={`artist-skeleton-${i}`}
                  className="flex w-28 shrink-0 flex-col items-center gap-2"
                >
                  <GlassSkeleton className="h-28 w-28 rounded-full" />
                  <GlassSkeleton className="h-3 w-20 rounded-full" />
                </div>
              ))}
            </div>
          </div>

          {/* Recently Added — bottom music skeleton */}
          <div className="w-full min-w-0 space-y-3">
            <h2 className="text-lg font-bold text-white">Recently Added</h2>
            <div className="flex gap-5 overflow-hidden" aria-hidden="true" aria-label="Loading recently added">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={`recent-skeleton-${i}`} className="flex w-40 shrink-0 flex-col gap-2 sm:w-48">
                  <GlassSkeleton className="aspect-square w-full rounded-2xl" />
                  <GlassSkeleton className="h-3 w-3/4 rounded-full" />
                  <GlassSkeleton className="h-2.5 w-1/2 rounded-full opacity-60" />
                </div>
              ))}
            </div>
          </div>

          {/* All Songs — bottom music skeleton */}
          <div className="w-full space-y-3 pt-4">
            <h2 className="text-lg font-bold text-white">All Songs</h2>
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4" aria-hidden="true" aria-label="Loading all songs">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={`grid-skeleton-${i}`} className="flex flex-col gap-2">
                  <GlassSkeleton className="aspect-square w-full rounded-2xl" />
                  <GlassSkeleton className="h-3 w-3/4 rounded-full" />
                  <GlassSkeleton className="h-2.5 w-1/2 rounded-full opacity-60" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : userTracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center space-y-2 py-16 text-center text-white/60">
          <p className="text-sm font-medium">No tracks in your library yet.</p>
          <p className="text-xs text-white/40">Upload an audio file above to get started.</p>
        </div>
      ) : hasSearch ? (
        <div className="w-full space-y-6">
          <h2 className="text-lg font-bold tracking-tight text-white">
            Search results for "{searchQuery}"
          </h2>
          {filteredTracks.length === 0 && filteredArtists.length === 0 ? (
            <p className="text-sm text-white/50">No results found.</p>
          ) : null}
          {filteredTracks.length > 0 && (
            <div className="w-full min-w-0 space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-white/60">
                Songs
              </h3>
              <AppleResizableGrid cols="grid-cols-2 sm:grid-cols-3 md:grid-cols-4" gap="gap-5">
                {filteredTracks.map((track) => (
                  <AppleResizableTile key={`search-${track.id}`} id={`search-track-${track.id}`} defaultSize="1x1" onRemove={() => onDeleteTrack?.(track)}>
                    <TrackCard
                      track={track}
                      onPlayTrack={onPlayTrack}
                      playlists={playlists}
                      onAddToPlaylist={onAddToPlaylist}
                      onDeleteTrack={onDeleteTrack}
                    />
                  </AppleResizableTile>
                ))}
              </AppleResizableGrid>
            </div>
          )}
          {filteredArtists.length > 0 && (
            <div className="w-full min-w-0 space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-white/60">
                Artists
              </h3>
              <div className="flex flex-wrap gap-5">
                {filteredArtists.map((artist) => {
                  const initial = (artist.name[0] || "?").toUpperCase();
                  return (
                    <AppleResizableTile key={`search-artist-${artist.name}`} id={`search-artist-${artist.name}`} defaultSize="1x1" className="w-28">
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/artist/${encodeURIComponent(artist.name)}`)
                        }
                        className="group flex w-full cursor-pointer flex-col items-center gap-2"
                        aria-label={`Open ${artist.name} page`}
                      >
                        <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-white/15 to-black/40 shadow-lg shadow-black/30 transition-transform group-hover:scale-105">
                          <ArtistProfileImage
                            initialSrc={artist.photo || null}
                            artistName={artist.name}
                            alt={artist.name}
                            fallbackInitial={
                              <span className="text-4xl">{initial}</span>
                            }
                            className="absolute left-[-12.5%] top-[-12.5%] h-[125%] w-[125%] rounded-full object-cover object-[50%_28%]"
                          />
                        </div>
                        <span className="max-w-full truncate text-center text-sm font-medium text-white/70 transition-colors group-hover:text-white">
                          {artist.name}
                        </span>
                      </button>
                    </AppleResizableTile>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {artists.length > 0 && (
            <div className="w-full min-w-0 space-y-3">
              <h2 className="text-lg font-bold text-white">Artists</h2>

              <InfiniteCarousel gap={20} storageKey="artists">
                {artists.map((artist) => {
                  const initial = (artist.name[0] || "?").toUpperCase();
                  return (
                    <button
                      key={`${artist.name}`}
                      type="button"
                      onClick={() =>
                        navigate(`/artist/${encodeURIComponent(artist.name)}`)
                      }
                      className="group flex w-28 shrink-0 cursor-pointer flex-col items-center gap-2"
                      aria-label={`Open ${artist.name} page`}
                    >
                      <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-white/15 to-black/40 shadow-lg shadow-black/30 transition-transform group-hover:scale-105">
                        <ArtistProfileImage
                          initialSrc={artist.photo || null}
                          artistName={artist.name}
                          alt={artist.name}
                          fallbackInitial={
                            <span className="text-4xl">{initial}</span>
                          }
                          className="absolute left-[-12.5%] top-[-12.5%] h-[125%] w-[125%] rounded-full object-cover object-[50%_28%]"
                        />
                      </div>
                      <span className="max-w-full truncate text-center text-sm font-medium text-white/70 transition-colors group-hover:text-white">
                        {artist.name}
                      </span>
                    </button>
                  );
                })}
              </InfiniteCarousel>
            </div>
          )}

          <div className="w-full min-w-0 space-y-3">
              <h2 className="text-lg font-bold text-white">Recently Added</h2>

            {recentTracks.length === 0 ? (
              <p className="text-xs text-white/40">
                No tracks uploaded in the last day.
              </p>
            ) : (
              <InfiniteCarousel gap={20} storageKey="recent">
                {recentTracks.map((track) => (
                  <div key={`recent-${track.id}`} className="w-40 shrink-0 sm:w-48">
                    <TrackCard
                      track={track}
                      onPlayTrack={onPlayTrack}
                      widthClass="w-full"
                      playlists={playlists}
                      onAddToPlaylist={onAddToPlaylist}
                      onDeleteTrack={onDeleteTrack}
                    />
                  </div>
                ))}
              </InfiniteCarousel>
            )}
          </div>

          <div className="w-full space-y-3 pt-4">
            <h2 className="text-lg font-bold text-white">All Songs</h2>
            <AppleResizableGrid>
              {userTracks.map((track) => (
                <AppleResizableTile key={`grid-${track.id}`} id={`track-${track.id}`} defaultSize="1x1" onRemove={() => onDeleteTrack?.(track)}>
                  <TrackCard
                    track={track}
                    onPlayTrack={onPlayTrack}
                    playlists={playlists}
                    onAddToPlaylist={onAddToPlaylist}
                    onDeleteTrack={onDeleteTrack}
                  />
                </AppleResizableTile>
              ))}
            </AppleResizableGrid>
          </div>
        </>
      )}
    </div>
  );
}
