
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Play, Info, Music2 } from "lucide-react";
import "material-symbols/rounded.css";
import { LiquidGlass } from "@/components/ui/glasscn/liquid-glass";
import ImageWithFallback from "@/components/ImageWithFallback";
import ArtistOverview from "@/components/artist/ArtistOverview";
import ArtistWikiDetails from "@/components/artist/ArtistWikiDetails";
import StickyGlassHeader from "@/components/ui/StickyGlassHeader";
import {
  trackMatchesArtist,
  splitArtistNames,
} from "@/utils/artistNames";
import {
  fetchWikipediaBioText,
  fetchArtistImageFallback,
} from "@/utils/mediaResolver";

export default function ArtistView({
  userTracks = [],
  onPlayTrack,
  playlists = [],
  onAddToPlaylist,
  onDeleteTrack,
  isLibraryLoading = false,
}) {
  const { artistName } = useParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("overview");

  const [wikiBio, setWikiBio] = useState(null);
  const [wikiLoading, setWikiLoading] = useState(true);

  // Level 2 fallback when no DB photo exists for this artist.
  const [fallbackPhoto, setFallbackPhoto] = useState(null);


  const artistNameDecoded = useMemo(() => {
    const rawName = artistName || "";
    try {
      return decodeURIComponent(rawName).trim();
    } catch {
      return rawName.trim();
    }
  }, [artistName]);

  useEffect(() => {
    if (!artistNameDecoded) return;

    // Text-only Wikipedia lookup — cached per session inside the resolver,
    // abortable so rapid navigation between artists can't race.
    const controller = new AbortController();
    const { signal } = controller;

    setWikiLoading(true);
    fetchWikipediaBioText(artistNameDecoded, signal)
      .then((bio) => {
        if (signal.aborted) return;
        setWikiBio(bio);
        setWikiLoading(false);
      })
      .catch(() => {
        if (!signal.aborted) {
          setWikiBio(null);
          setWikiLoading(false);
        }
      });

    return () => controller.abort();
  }, [artistNameDecoded]);

  const artistTracks = useMemo(() => {
    if (!artistNameDecoded) return [];
    return userTracks.filter((t) => trackMatchesArtist(t, artistNameDecoded));
  }, [userTracks, artistNameDecoded]);

  const sortedTracks = useMemo(
    () =>
      [...artistTracks].sort(
        (a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0)
      ),
    [artistTracks]
  );

  const latestRelease = sortedTracks[0] || null;


  // Level 1: DB artist photo — the exact one the home carousel shows.
  const dbPhoto = useMemo(() => {
    const matchingTrack = artistTracks.find((t) => {
      if (!t.artistPhotoUrl) return false;
      const primaryArtist = splitArtistNames(t.artist)[0] || "";
      return primaryArtist.toLowerCase() === artistNameDecoded.toLowerCase();
    });
    return matchingTrack?.artistPhotoUrl || "";
  }, [artistTracks, artistNameDecoded]);

  useEffect(() => {
    if (dbPhoto) return;
    let alive = true;
    setFallbackPhoto(null);
    fetchArtistImageFallback(artistNameDecoded).then((src) => {
      if (alive && src) setFallbackPhoto(src);
    });
    return () => {
      alive = false;
    };
  }, [dbPhoto, artistNameDecoded]);

  const photo = dbPhoto || fallbackPhoto;


  if (!artistTracks.length) {
    if (isLibraryLoading) {
      return (
        <div className="flex w-full h-full flex-col items-center justify-center space-y-4 py-20 text-center text-white/50">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
          <p className="text-sm font-medium animate-pulse">Loading artist…</p>
        </div>
      );
    }
    return (
      <div className="flex w-full h-full flex-col items-center justify-center space-y-4 py-20 text-center text-white/60">
        <p className="text-sm font-medium">Artist not found in your library.</p>
        <LiquidGlass
          blur={8}
          refraction={10}
          onClick={() => navigate("/")}
          className="cursor-pointer rounded-full px-4 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90 [--liquid-glass-rim-width:0.5px]"
        >
          Back to Home
        </LiquidGlass>
      </div>
    );
  }


  return (
    <div className="absolute inset-0 z-50 flex flex-col rounded-3xl overflow-hidden bg-white/[0.06] border border-white/25 shadow-2xl">

      {photo ? (
        <div className="absolute inset-0 z-0 pointer-events-none">
          <ImageWithFallback
            src={photo}
            alt={artistNameDecoded}
            decoding="async"
            className="w-full h-full object-cover scale-110 blur-md"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
        </div>
      ) : null}


      <div className="relative z-10 flex flex-col flex-1 min-h-0 p-8 sm:p-12 overflow-y-auto custom-scrollbar">
        <div className="sticky top-0 z-30 -mx-8 sm:-mx-12 -mt-8 sm:-mt-12 mb-6 sm:mb-8 flex items-center justify-between gap-4 px-8 sm:px-12 py-4 bg-black/40 border-b border-white/10 will-change-transform">
          <LiquidGlass
            blur={10}
            refraction={18}
            saturation={1.6}
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white/15 border border-white/30 [--liquid-glass-rim-light:rgba(255,255,255,0.7)] transition-all hover:bg-white/25 hover:scale-105 shadow-lg shadow-black/10"
            aria-label="Go back"
          >
            <span className="material-symbols-rounded text-lg text-white pl-1 opacity-90">
              arrow_back_ios
            </span>
          </LiquidGlass>

          <LiquidGlass
            blur={10}
            refraction={18}
            saturation={1.6}
            className="flex items-center gap-1 rounded-full p-1.5 bg-white/10 border border-white/30 [--liquid-glass-rim-light:rgba(255,255,255,0.7)] shadow-lg shadow-black/10"
          >
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${
                activeTab === "overview"
                  ? "bg-white/25 text-white shadow-sm"
                  : "text-white/80 hover:text-white hover:bg-white/15"
              }`}
            >
              <Music2 className="w-3.5 h-3.5" />
              Overview
            </button>
            <button
              onClick={() => setActiveTab("details")}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${
                activeTab === "details"
                  ? "bg-white/25 text-white shadow-sm"
                  : "text-white/80 hover:text-white hover:bg-white/15"
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              Details
            </button>
          </LiquidGlass>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10 w-full shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <h1 className="text-[clamp(2.25rem,5vw,4.5rem)] font-black tracking-tighter text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.6)] break-words leading-[0.95] transition-all duration-300">
              {artistNameDecoded}
            </h1>
            <p className="mt-2 text-[clamp(0.75rem,1.5vw,0.875rem)] font-medium text-white/85 tracking-wide drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]">
              {artistTracks.length} song
              {artistTracks.length !== 1 ? "s" : ""} in library
            </p>
          </div>


          {activeTab === "overview" && sortedTracks.length > 0 && (
            <div className="shrink-0 sm:mb-8">
              <LiquidGlass
                blur={10}
                refraction={18}
                saturation={1.6}
                // The third arg sets activeArtist in PlayerContext, which
                // makes getActiveQueue() derive the full sorted discography
                // as the queue — passing sortedTracks as arg 2 would corrupt
                // playlistId instead.
                onClick={() => onPlayTrack(sortedTracks[0], null, artistNameDecoded)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full cursor-pointer bg-white/15 border border-white/30 [--liquid-glass-rim-light:rgba(255,255,255,0.7)] hover:bg-white/25 transition-all font-semibold text-sm text-white shadow-xl shadow-black/10"
                aria-label={`Play all songs by ${artistNameDecoded}`}
              >
                <Play className="w-4 h-4 fill-current text-white" />
                Play All
              </LiquidGlass>
            </div>
          )}
        </div>


        {activeTab === "overview" ? (
          <ArtistOverview
            artistName={artistNameDecoded}
            sortedTracks={sortedTracks}
            latestRelease={latestRelease}
            onPlayTrack={onPlayTrack}
            playlists={playlists}
            onAddToPlaylist={onAddToPlaylist}
            onDeleteTrack={onDeleteTrack}
          />
        ) : (
          <ArtistWikiDetails
            artistName={artistNameDecoded}
            wikiBio={wikiBio}
            wikiLoading={wikiLoading}
          />
        )}
      </div>
    </div>
  );
}
