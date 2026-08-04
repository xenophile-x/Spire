import React, { useRef } from "react";

export default function HomeView({ userTracks = [], isUploading, onFileUpload, onPlayTrack }) {
  const scrollContainerRef = useRef(null);

  // Smooth scroll handler for slider arrows
  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === "left" ? -350 : 350;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  return (
    <div className="space-y-8 w-full min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Home</h1>
          <p className="text-xs text-white/50">{userTracks.length} tracks in library</p>
        </div>
        <label className="cursor-pointer bg-transparent hover:bg-white/20 border border-white/20 rounded-full px-4 py-2 text-xs font-medium text-white transition-all flex items-center gap-2 backdrop-blur-md shrink-0">
          <span>{isUploading ? "Uploading..." : "Upload Song"}</span>
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
        <div className="flex flex-col items-center justify-center py-16 text-center text-white/60 space-y-2">
          <p className="text-sm font-medium">No tracks in your library yet.</p>
          <p className="text-xs text-white/40">Upload an audio file above to get started.</p>
        </div>
      ) : (
        <>
          {/* SECTION 1: Horizontal Music Slider */}
          <div className="space-y-3 w-full min-w-0">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Recently Added</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => scroll("left")}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white text-sm transition-all active:scale-95"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => scroll("right")}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white text-sm transition-all active:scale-95"
                >
                  ›
                </button>
              </div>
            </div>

            {/* Scrollable Track Row */}
            <div
              ref={scrollContainerRef}
              className="flex gap-5 overflow-x-auto flex-nowrap scroll-smooth pb-2 pt-1 w-full min-w-0 no-scrollbar"
            >
              {userTracks.map((track) => (
                <div
                  key={`slider-${track.id}`}
                  onClick={() => onPlayTrack(track)}
                  className="group cursor-pointer shrink-0 w-40 sm:w-48 flex flex-col text-left transition-all"
                >
                  <div className="relative aspect-square w-full rounded-2xl overflow-hidden mb-2.5 shadow-md bg-white/5 group-hover:shadow-xl transition-all duration-300">
                    <img
                      src={track.cover || track.artworkUrl}
                      alt={track.title}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src =
                          "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=300";
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-out"
                    />
                  </div>
                  <p className="text-xs font-semibold text-white truncate w-full leading-snug">
                    {track.title}
                  </p>
                  <p className="text-[11px] text-white/60 truncate w-full leading-snug mt-0.5">
                    {track.artist}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 2: Standard Apple Music Grid */}
          <div className="space-y-3 pt-4 w-full">
            <h2 className="text-lg font-bold text-white">All Songs</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
              {userTracks.map((track) => (
                <div
                  key={`grid-${track.id}`}
                  onClick={() => onPlayTrack(track)}
                  className="group cursor-pointer flex flex-col text-left transition-all"
                >
                  <div className="relative aspect-square w-full rounded-2xl overflow-hidden mb-2.5 shadow-lg bg-white/5 group-hover:shadow-2xl transition-all duration-300">
                    <img
                      src={track.cover || track.artworkUrl}
                      alt={track.title}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src =
                          "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=300";
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-out"
                    />
                  </div>
                  <p className="text-xs font-semibold text-white truncate w-full leading-snug">
                    {track.title}
                  </p>
                  <p className="text-[11px] text-white/60 truncate w-full leading-snug mt-0.5">
                    {track.artist}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}