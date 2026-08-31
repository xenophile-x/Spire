

import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "material-symbols/rounded.css";
import TrackCard from "@/components/TrackCard";
import { getRecommendedTracks } from "@/utils/recommend";
import { GlassIcon } from "@/components/ui/glasscn/glass-icon";
import { GlassSkeleton } from "@/components/ui/glasscn/glass-skeleton";
import PageHeader from "@/components/ui/PageHeader";
import { AppleResizableTile } from "@/components/ui/AppleResize";
import { ArtistProfileImage } from "@/components/ui/MediaImages";
import { useAuth } from "@/context/AuthContext";
import { useLibrary } from "@/context/LibraryContext";
import { supabase } from "@/lib/supabaseClient";
import { getRecentlyLikedSongs } from "@/services/supabaseService";
import { splitArtistNames } from "@/utils/artistNames";

export default function ExploreView({
  userTracks = [],
  onPlayTrack,
  currentTrack,
  continueListening = [],
  playlists = [],
  onAddToPlaylist,
  onDeleteTrack,
  listeningHistory = [],
  libraryLoaded: libraryLoadedProp,
}) {
  let libraryLoadedFromContext = true;
  try {
    libraryLoadedFromContext = useLibrary()?.libraryLoaded ?? true;
  } catch {
    // outside provider
  }
  const libraryLoaded = libraryLoadedProp ?? libraryLoadedFromContext;
  const [recommendedTracks, setRecommendedTracks] = useState([]);
  const [mostListenedTracks, setMostListenedTracks] = useState([]);
  const [topArtists, setTopArtists] = useState([]);
  const [recentlyLikedTracks, setRecentlyLikedTracks] = useState([]);
  const { user } = useAuth();
  const navigate = useNavigate();

  const recScrollRef = useRef(null);
  const continueScrollRef = useRef(null);
  const mostListenedScrollRef = useRef(null);
  const topArtistsScrollRef = useRef(null);
  const recentlyLikedScrollRef = useRef(null);

  useEffect(() => {
    const playedIds = new Set(continueListening.map((t) => t.id));

    const pool = userTracks.filter(
      (t) => t.id !== currentTrack?.id && !playedIds.has(t.id)
    );

    let recommendations = getRecommendedTracks(currentTrack, pool, listeningHistory, 10);
    if (recommendations.length === 0) {
      recommendations = pool.slice(0, 10);
    }
    setRecommendedTracks(recommendations);
  }, [userTracks, currentTrack, continueListening, listeningHistory]);

  // Most Listened + Top Artists — count frequency from listening_history (raw, not deduped)
  useEffect(() => {
    if (!user?.id || userTracks.length === 0) {
      setMostListenedTracks([]);
      setTopArtists([]);
      return;
    }
    let cancelled = false;
    async function loadStats() {
      try {
        const { data, error } = await supabase
          .from("listening_history")
          .select("track_id")
          .eq("user_id", user.id)
          .limit(200);
        if (error || !data || cancelled) return;

        const trackCounts = {};
        for (const row of data) {
          if (!row.track_id) continue;
          trackCounts[row.track_id] = (trackCounts[row.track_id] || 0) + 1;
        }

        const sortedIds = Object.entries(trackCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([id, c]) => ({ id, count: c }));
        const mapped = sortedIds
          .map(({ id, count }) => {
            const track = userTracks.find((t) => t.id === id);
            return track ? { ...track, playCount: count } : null;
          })
          .filter(Boolean);
        if (!cancelled) setMostListenedTracks(mapped);

        // Top Artists — aggregate per-track plays up to artist names
        const artistCounts = {};
        for (const track of userTracks) {
          const count = trackCounts[track.id];
          if (!count) continue;
          const names = splitArtistNames(track.artist);
          if (!names.length) continue;
          for (const name of names) {
            if (["unknown", "unknown artist"].includes(name.toLowerCase())) continue;
            if (!artistCounts[name]) {
              artistCounts[name] = { name, photo: "", playCount: 0 };
            }
            artistCounts[name].playCount += count;
            if (!artistCounts[name].photo && track.artistPhotoUrl) {
              artistCounts[name].photo = track.artistPhotoUrl;
            }
          }
        }
        const artistList = Object.values(artistCounts)
          .sort((a, b) => b.playCount - a.playCount)
          .slice(0, 10);
        if (!cancelled) setTopArtists(artistList);
      } catch (e) {
        console.warn("[Explore] Listening stats load failed:", e);
      }
    }
    loadStats();
    return () => { cancelled = true; };
  }, [user?.id, userTracks]);

  // Recently Liked — latest liked track ids, mapped onto library
  useEffect(() => {
    if (!user?.id || userTracks.length === 0) {
      setRecentlyLikedTracks([]);
      return;
    }
    let cancelled = false;
    async function loadRecentlyLiked() {
      try {
        const liked = await getRecentlyLikedSongs(user.id, 10);
        if (cancelled) return;
        const tracks = liked
          .map(({ track_id }) => {
            const track = userTracks.find((t) => t.id === track_id);
            return track ? track : null;
          })
          .filter(Boolean);
        if (!cancelled) setRecentlyLikedTracks(tracks);
      } catch (e) {
        console.warn("[Explore] Recently liked load failed:", e);
      }
    }
    loadRecentlyLiked();
    return () => { cancelled = true; };
  }, [user?.id, userTracks]);

  const scroll = (ref, direction) => {
    if (ref.current) {
      const scrollAmount = direction === "left" ? -350 : 350;
      ref.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  return (
    <div className="w-full min-w-0 space-y-8 text-white select-none">
      <PageHeader
        title="Explore"
        subtitle={userTracks.length ? `${userTracks.length} tracks • discovery` : "Discovery"}
      />

      {!libraryLoaded ? (
        <div className="w-full min-w-0 space-y-8 animate-in fade-in-0" aria-hidden="true" aria-label="Loading explore">
          {/* Recommended — skeleton */}
          <div className="w-full min-w-0 space-y-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight">Recommended for You</h2>
              <p className="text-xs text-white/50">Based on your library taste</p>
            </div>
            <div className="no-scrollbar flex w-full min-w-0 flex-nowrap gap-5 overflow-x-auto pt-1 pb-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={`rec-sk-${i}`} className="flex w-48 shrink-0 flex-col gap-2 sm:w-56">
                  <GlassSkeleton className="aspect-square w-full rounded-2xl" />
                  <GlassSkeleton className="h-3 w-3/4 rounded-full" />
                  <GlassSkeleton className="h-2.5 w-1/2 rounded-full opacity-60" />
                </div>
              ))}
            </div>
          </div>

          {/* Most Listened — skeleton */}
          <div className="w-full min-w-0 space-y-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-rounded text-[20px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>crown</span>
              <div>
                <h2 className="text-lg font-bold tracking-tight">Most Listened</h2>
                <p className="text-xs text-white/50">Your top replayed tracks</p>
              </div>
            </div>
            <div className="no-scrollbar flex w-full min-w-0 flex-nowrap gap-5 overflow-x-auto pt-1 pb-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={`most-sk-${i}`} className="flex w-48 shrink-0 flex-col gap-2 sm:w-56">
                  <GlassSkeleton className="aspect-square w-full rounded-2xl" />
                  <GlassSkeleton className="h-3 w-3/4 rounded-full" />
                  <GlassSkeleton className="h-2.5 w-1/2 rounded-full opacity-60" />
                </div>
              ))}
            </div>
          </div>

          {/* Top Artists — 9 skeletons like Home (3 more) */}
          <div className="w-full min-w-0 space-y-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-rounded text-[20px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
              <div>
                <h2 className="text-lg font-bold tracking-tight">Top Artists</h2>
                <p className="text-xs text-white/50">Your most-played artists</p>
              </div>
            </div>
            <div className="no-scrollbar flex w-full min-w-0 flex-nowrap gap-5 overflow-x-auto pt-1 pb-2">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={`top-artist-sk-${i}`} className="flex w-28 shrink-0 flex-col items-center gap-2">
                  <GlassSkeleton className="h-28 w-28 rounded-full" />
                  <GlassSkeleton className="h-3 w-20 rounded-full" />
                  <GlassSkeleton className="h-2 w-12 rounded-full opacity-60" />
                </div>
              ))}
            </div>
          </div>

          {/* Recently Liked — skeleton */}
          <div className="w-full min-w-0 space-y-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-rounded text-[20px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
              <div>
                <h2 className="text-lg font-bold tracking-tight">Recently Liked</h2>
                <p className="text-xs text-white/50">Your latest favorites</p>
              </div>
            </div>
            <div className="no-scrollbar flex w-full min-w-0 flex-nowrap gap-5 overflow-x-auto pt-1 pb-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={`liked-sk-${i}`} className="flex w-48 shrink-0 flex-col gap-2 sm:w-56">
                  <GlassSkeleton className="aspect-square w-full rounded-2xl" />
                  <GlassSkeleton className="h-3 w-3/4 rounded-full" />
                  <GlassSkeleton className="h-2.5 w-1/2 rounded-full opacity-60" />
                </div>
              ))}
            </div>
          </div>

          {/* Continue Listening — skeleton */}
          <div className="w-full min-w-0 space-y-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight">Continue Listening</h2>
              <p className="text-xs text-white/50">Played recently</p>
            </div>
            <div className="no-scrollbar flex w-full min-w-0 flex-nowrap gap-5 overflow-x-auto pt-1 pb-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={`cont-sk-${i}`} className="flex w-48 shrink-0 flex-col gap-2 sm:w-56">
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
          <p className="text-sm font-medium">No tracks available to explore.</p>
          <p className="text-xs text-white/40">Upload tracks on the Home tab to get started.</p>
        </div>
      ) : (
        <>
          <div className="w-full min-w-0 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold tracking-tight">Recommended for You</h2>
                <p className="text-xs text-white/50">
                  {currentTrack ? `Based on ${currentTrack.title}` : "Based on your library taste"}
                </p>
              </div>
            </div>

            <div
              ref={recScrollRef}
              className="no-scrollbar flex w-full min-w-0 flex-nowrap gap-5 overflow-x-auto scroll-smooth pt-1 pb-2"
            >
                {recommendedTracks.map((track) => (
                <AppleResizableTile key={`rec-${track.id}`} id={`explore-rec-${track.id}`} defaultSize="1x1" className="shrink-0">
                  <TrackCard
                    track={track}
                    onPlayTrack={onPlayTrack}
                    widthClass="w-48 sm:w-56"
                    playlists={playlists}
                    onAddToPlaylist={onAddToPlaylist}
                    onDeleteTrack={onDeleteTrack}
                  />
                </AppleResizableTile>
              ))}
            </div>
          </div>

          {mostListenedTracks.length > 0 && (
            <div className="w-full min-w-0 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold tracking-tight">Most Listened</h2>
                  <p className="text-xs text-white/50">Your top replayed tracks</p>
                </div>
              </div>

              <div
                ref={mostListenedScrollRef}
                className="no-scrollbar flex w-full min-w-0 flex-nowrap gap-5 overflow-x-auto scroll-smooth pt-1 pb-2"
              >
                {mostListenedTracks.map((track) => (
                  <AppleResizableTile key={`most-${track.id}`} id={`explore-most-${track.id}`} defaultSize="1x1" className="shrink-0">
                    <TrackCard
                      track={track}
                      onPlayTrack={onPlayTrack}
                      widthClass="w-48 sm:w-56"
                      playlists={playlists}
                      onAddToPlaylist={onAddToPlaylist}
                      onDeleteTrack={onDeleteTrack}
                    />
                  </AppleResizableTile>
                ))}
              </div>
            </div>
          )}

          {topArtists.length > 0 && (
            <div className="w-full min-w-0 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold tracking-tight">Top Artists</h2>
                  <p className="text-xs text-white/50">Your most-played artists</p>
                </div>
              </div>

              <div
                ref={topArtistsScrollRef}
                className="no-scrollbar flex w-full min-w-0 flex-nowrap gap-5 overflow-x-auto scroll-smooth pt-1 pb-2"
              >
                {topArtists.map((artist) => {
                  const initial = (artist.name[0] || "?").toUpperCase();
                  return (
                    <AppleResizableTile key={`top-artist-${artist.name}`} id={`explore-top-artist-${artist.name}`} defaultSize="1x1" className="shrink-0">
                      <button
                        type="button"
                        onClick={() => navigate(`/artist/${encodeURIComponent(artist.name)}`)}
                        className="group flex w-28 shrink-0 cursor-pointer flex-col items-center gap-2"
                        aria-label={`Open ${artist.name} page`}
                      >
                        <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-white/15 to-black/40 shadow-lg shadow-black/30 transition-transform group-hover:scale-105">
                          <ArtistProfileImage
                            initialSrc={artist.photo || null}
                            artistName={artist.name}
                            alt={artist.name}
                            fallbackInitial={<span className="text-4xl">{initial}</span>}
                            className="absolute left-[-12.5%] top-[-12.5%] h-[125%] w-[125%] rounded-full object-cover object-[50%_28%]"
                          />
                        </div>
                        <span className="max-w-full truncate text-center text-sm font-medium text-white/70 transition-colors group-hover:text-white">
                          {artist.name}
                        </span>
                        <span className="text-[10px] text-white/40">
                          {artist.playCount} {artist.playCount === 1 ? "play" : "plays"}
                        </span>
                      </button>
                    </AppleResizableTile>
                  );
                })}
              </div>
            </div>
          )}

          {recentlyLikedTracks.length > 0 && (
            <div className="w-full min-w-0 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold tracking-tight">Recently Liked</h2>
                  <p className="text-xs text-white/50">Your latest favorites</p>
                </div>
              </div>

              <div
                ref={recentlyLikedScrollRef}
                className="no-scrollbar flex w-full min-w-0 flex-nowrap gap-5 overflow-x-auto scroll-smooth pt-1 pb-2"
              >
                {recentlyLikedTracks.map((track) => (
                  <AppleResizableTile key={`recently-liked-${track.id}`} id={`explore-liked-${track.id}`} defaultSize="1x1" className="shrink-0">
                    <TrackCard
                      track={track}
                      onPlayTrack={onPlayTrack}
                      widthClass="w-48 sm:w-56"
                      playlists={playlists}
                      onAddToPlaylist={onAddToPlaylist}
                      onDeleteTrack={onDeleteTrack}
                    />
                  </AppleResizableTile>
                ))}
              </div>
            </div>
          )}

          {continueListening.length > 0 && (
            <div className="w-full min-w-0 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold tracking-tight">Continue Listening</h2>
                  <p className="text-xs text-white/50">Played recently</p>
                </div>
              </div>

              <div
                ref={continueScrollRef}
                className="no-scrollbar flex w-full min-w-0 flex-nowrap gap-5 overflow-x-auto scroll-smooth pt-1 pb-2"
              >
                {continueListening.slice(0, 8).map((track, index) => (
                  <AppleResizableTile key={`continue-${track.id}-${index}`} id={`explore-cont-${track.id}`} defaultSize="1x1" className="shrink-0">
                    <TrackCard
                      track={track}
                      onPlayTrack={onPlayTrack}
                      widthClass="w-48 sm:w-56"
                      playlists={playlists}
                      onAddToPlaylist={onAddToPlaylist}
                      onDeleteTrack={onDeleteTrack}
                    />
                  </AppleResizableTile>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

