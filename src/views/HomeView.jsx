// src/views/HomeView.jsx
import React, { useRef } from "react";
import TrackCard from "@/components/TrackCard";
import { GlassIcon } from "@/components/ui/glasscn/glass-icon";
import { LiquidGlass } from "@/components/ui/glasscn/liquid-glass";

export default function HomeView({
  userTracks = [],
  isUploading,
  onFileUpload,
  onPlayTrack,
  searchQuery = "",
  playlists = [],
  onAddToPlaylist,
}) {
  const scrollContainerRef = useRef(null);

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === "left" ? -350 : 350;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const recentTracks = userTracks.filter(
    (t) => t.uploadedAt && Date.now() - new Date(t.uploadedAt).getTime() <= ONE_DAY_MS
  );

  const searchTerm = (searchQuery || "").trim().toLowerCase();
  const filteredTracks = searchTerm
    ? userTracks.filter(
        (t) =>
          (t.title || "").toLowerCase().includes(searchTerm) ||
          (t.artist || "").toLowerCase().includes(searchTerm)
      )
    : [];
  const hasSearch = searchTerm.length > 0;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 pb-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Home</h1>
          <p className="text-xs text-white/50">{userTracks.length} tracks in library</p>
        </div>
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
            onChange={onFileUpload}
            className="hidden"
            disabled={isUploading}
          />
        </label>
      </div>

      {userTracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center space-y-2 py-16 text-center text-white/60">
          <p className="text-sm font-medium">No tracks in your library yet.</p>
          <p className="text-xs text-white/40">Upload an audio file above to get started.</p>
        </div>
      ) : hasSearch ? (
        <div className="w-full space-y-3">
          <h2 className="text-lg font-bold tracking-tight text-white">
            Search results for "{searchQuery}"
          </h2>
          {filteredTracks.length === 0 ? (
            <p className="text-sm text-white/50">No songs found.</p>
          ) : (
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4">
              {filteredTracks.map((track) => (
                <TrackCard
                  key={`search-${track.id}`}
                  track={track}
                  onPlayTrack={onPlayTrack}
                  playlists={playlists}
                  onAddToPlaylist={onAddToPlaylist}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="w-full min-w-0 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Recently Added</h2>
              <div className="flex items-center gap-2">
                <GlassIcon
                  size="sm"
                  onClick={() => scroll("left")}
                  aria-label="Scroll left"
                  className="text-white"
                  liquidProps={{ blur: 4, refraction: 4 }}
                >
                  <span className="text-sm">‹</span>
                </GlassIcon>
                <GlassIcon
                  size="sm"
                  onClick={() => scroll("right")}
                  aria-label="Scroll right"
                  className="text-white"
                  liquidProps={{ blur: 4, refraction: 4 }}
                >
                  <span className="text-sm">›</span>
                </GlassIcon>
              </div>
            </div>

            <div
              ref={scrollContainerRef}
              className="no-scrollbar flex w-full min-w-0 flex-nowrap gap-5 overflow-x-auto scroll-smooth pt-1 pb-2"
            >
              {recentTracks.map((track) => (
                <TrackCard
                  key={`slider-${track.id}`}
                  track={track}
                  onPlayTrack={onPlayTrack}
                  widthClass="w-40 sm:w-48"
                  playlists={playlists}
                  onAddToPlaylist={onAddToPlaylist}
                />
              ))}
            </div>
            {recentTracks.length === 0 && (
              <p className="text-xs text-white/40">No tracks uploaded in the last day.</p>
            )}
          </div>

          <div className="w-full space-y-3 pt-4">
            <h2 className="text-lg font-bold text-white">All Songs</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {userTracks.map((track) => (
                <TrackCard
                  key={`grid-${track.id}`}
                  track={track}
                  onPlayTrack={onPlayTrack}
                  playlists={playlists}
                  onAddToPlaylist={onAddToPlaylist}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
