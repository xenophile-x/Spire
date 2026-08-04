// src/views/ExploreView.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Skeleton } from "@/components/ui/skeleton";

export default function ExploreView({ onPlayTrack, currentTrack }) {
  const [loading, setLoading] = useState(true);
  const [driveTracks, setDriveTracks] = useState([]);
  const [followingArtists, setFollowingArtists] = useState([]);
  const [recentSongs, setRecentSongs] = useState([]);

  useEffect(() => {
    fetchUploadedDriveTracks();
  }, []);

  const fetchUploadedDriveTracks = async () => {
    setLoading(true);
    try {
      // Get the currently authenticated user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      

      // Query user_tracks joined with central tracks, metadata, and lyrics
      const { data: userTracksData, error } = await supabase
        .from("user_tracks")
        .select(`
          id,
          drive_file_id,
          uploaded_filename,
          created_at,
          tracks (
            id,
            canonical_title,
            canonical_artist,
            duration_seconds,
            track_metadata (
              album_name,
              artwork_url,
              primary_genre
            ),
            track_lyrics (
              synced_lyrics,
              plain_lyrics,
              is_synced
            )
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (userTracksData && userTracksData.length > 0) {
        // Format track records cleanly
        const formatted = userTracksData.map((ut) => {
          const trackObj = ut.tracks || {};
          const meta = Array.isArray(trackObj.track_metadata)
            ? trackObj.track_metadata[0]
            : trackObj.track_metadata;
          const lyrics = Array.isArray(trackObj.track_lyrics)
            ? trackObj.track_lyrics[0]
            : trackObj.track_lyrics;

          // Determine Title (Canonical title -> Uploaded Filename -> Fallback)
          const displayTitle =
            trackObj.canonical_title ||
            ut.uploaded_filename?.replace(/\.[^/.]+$/, "") ||
            "Untitled Track";

          // Determine Artist
          const displayArtist = trackObj.canonical_artist || "Unknown Artist";

          // Determine Artwork
          const artworkUrl =
            meta?.artwork_url ||
            "https://img.icons8.com/ios_filled/1200/music-album.jpg";

          return {
            id: ut.id, // user_tracks UUID
            track_id: trackObj.id,
            drive_file_id: ut.drive_file_id,
            title: displayTitle,
            artist: displayArtist,
            album: meta?.album_name || "Uploaded Single",
            cover: artworkUrl,
            artworkUrl: artworkUrl,
            duration: trackObj.duration_seconds || 0,
            synced_lyrics: lyrics?.synced_lyrics || "",
            plain_lyrics: lyrics?.plain_lyrics || "",
            uploadedAt: ut.created_at,
          };
        });

        setDriveTracks(formatted);
        setRecentSongs(formatted.slice(0, 5));

        // Dynamically group existing artists from the uploaded Drive tracks
        const artistMap = {};
        formatted.forEach((item) => {
          const artistName = item.artist;
          if (!artistMap[artistName]) {
            artistMap[artistName] = {
              name: artistName,
              cover: item.cover,
              songCount: 1,
            };
          } else {
            artistMap[artistName].songCount += 1;
          }
        });

        setFollowingArtists(Object.values(artistMap));
      } else {
        setDriveTracks([]);
        setRecentSongs([]);
        setFollowingArtists([]);
      }
    } catch (err) {
      console.error("Failed to load uploaded Drive tracks:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 text-white select-none">
      {/* 1. UPLOADED DRIVE TRACKS / RECOMMENDATIONS */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Your Drive Library</h2>
            <p className="text-xs text-white/50 mt-0.5">
              Tracks synced directly from Google Drive
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchUploadedDriveTracks}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center transition-all"
              title="Refresh Tracks"
            >
              <span className="material-symbols-rounded text-sm">refresh</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-3 p-3 bg-white/5 rounded-2xl border border-white/10">
                <Skeleton className="h-36 w-full rounded-xl bg-white/10" />
                <Skeleton className="h-4 w-3/4 bg-white/10" />
                <Skeleton className="h-3 w-1/2 bg-white/10" />
              </div>
            ))
          ) : driveTracks.length === 0 ? (
            <div className="col-span-full py-12 text-center bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
              <span className="material-symbols-rounded text-4xl text-white/40 mb-2">
                cloud_off
              </span>
              <p className="text-sm font-semibold text-white/70">No Drive tracks found</p>
              <p className="text-xs text-white/40 mt-1">
                Upload audio files to sync them with your library.
              </p>
            </div>
          ) : (
            driveTracks.map((track) => (
              <div
                key={track.id}
                onClick={() => onPlayTrack(track)}
                className="group bg-white/5 hover:bg-white/15 border border-white/10 rounded-2xl p-3 transition-all duration-300 cursor-pointer backdrop-blur-md flex flex-col justify-between"
              >
                <div className="relative aspect-square rounded-xl overflow-hidden mb-3 bg-black/20">
                  <img
                    src={track.cover}
                    alt={track.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="material-symbols-rounded text-3xl text-white drop-shadow-md">
                      play_circle
                    </span>
                  </div>
                </div>
                <div className="overflow-hidden">
                  <h3 className="font-bold text-sm truncate text-white">{track.title}</h3>
                  <p className="text-xs text-white/60 truncate mt-0.5">{track.artist}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 2. LOWER SECTION: ARTISTS & RECENT PLAYBACK */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* FOLLOWING ARTISTS (Grouped from User's Uploaded Tracks) */}
        <section className="lg:col-span-7 space-y-4">
          <h2 className="text-xl font-bold tracking-tight">Artists in Library</h2>
          <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center space-y-2">
                  <Skeleton className="w-16 h-16 rounded-full bg-white/10" />
                  <Skeleton className="h-3 w-12 bg-white/10" />
                </div>
              ))
            ) : followingArtists.length === 0 ? (
              <p className="text-xs text-white/40 col-span-full">No artists detected yet.</p>
            ) : (
              followingArtists.map((artist, idx) => (
                <div key={idx} className="flex flex-col items-center text-center group cursor-pointer">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/20 group-hover:border-white transition-all shadow-md mb-2 bg-black/30">
                    <img
                      src={artist.cover}
                      alt={artist.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-xs font-semibold text-white truncate max-w-[90px]">
                    {artist.name}
                  </span>
                  <span className="text-[10px] text-white/50 flex items-center gap-0.5 mt-0.5">
                    <span className="material-symbols-rounded text-[10px]">headphones</span>
                    {artist.songCount} {artist.songCount === 1 ? "song" : "songs"}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* RECENT UPLOADS / CONTINUE PLAYING */}
        <section className="lg:col-span-5 space-y-4">
          <h2 className="text-xl font-bold tracking-tight">Recently Uploaded</h2>
          <div className="space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3 bg-white/5 rounded-2xl border border-white/10">
                  <Skeleton className="w-12 h-12 rounded-xl bg-white/10" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/2 bg-white/10" />
                    <Skeleton className="h-3 w-1/3 bg-white/10" />
                  </div>
                </div>
              ))
            ) : recentSongs.length === 0 ? (
              <p className="text-xs text-white/40">No recent songs available.</p>
            ) : (
              recentSongs.map((track) => (
                <div
                  key={track.id}
                  onClick={() => onPlayTrack(track)}
                  className="bg-white/5 hover:bg-white/15 border border-white/10 backdrop-blur-md rounded-2xl p-3 flex items-center justify-between transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <img
                      src={track.cover}
                      alt={track.title}
                      className="w-12 h-12 rounded-xl object-cover shrink-0 bg-black/30"
                    />
                    <div className="overflow-hidden">
                      <h4 className="font-bold text-sm text-white truncate">{track.title}</h4>
                      <p className="text-xs text-white/60 truncate">{track.artist}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayTrack(track);
                      }}
                      className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold flex items-center gap-1 border border-white/10 transition-all"
                    >
                      <span className="material-symbols-rounded text-sm">play_arrow</span>
                      <span>Play</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}