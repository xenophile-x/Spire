import React from "react";

export default function PlaylistsView({ trackCount = 0 }) {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Playlists & Albums</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white/10 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-white/20 transition-all">
          <span className="text-3xl mb-2">Liked</span>
          <p className="font-semibold text-sm">Liked Songs</p>
          <p className="text-xs text-white/60">{trackCount} tracks</p>
        </div>
        <div className="bg-white/10 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-white/20 transition-all">
          <span className="text-3xl mb-2">Playlists</span>
          <p className="font-semibold text-sm">Heavy Rotation</p>
          <p className="text-xs text-white/60">Recently Uploaded</p>
        </div>
      </div>
    </div>
  );
}