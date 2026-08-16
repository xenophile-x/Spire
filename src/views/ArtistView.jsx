// src/views/ArtistView.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Play, Info, Music2 } from "lucide-react";
import "material-symbols/rounded.css";
import { LiquidGlass } from "@/components/ui/glasscn/liquid-glass";
import { GlassCard } from "@/components/ui/glasscn/glass-card";
import { DEFAULT_COVER } from "@/utils/trackMetadata";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { GlassDropdownMenuContent } from "@/components/ui/glasscn/glass-dropdown-menu";
import { trackMatchesArtist } from "@/utils/artistNames";

function trackCover(track) {
  return track.cover || track.artworkUrl || track.artwork_url || DEFAULT_COVER;
}

function trackYear(track) {
  if (track.release_year) return track.release_year;
  if (track.uploadedAt) return new Date(track.uploadedAt).getFullYear();
  return "";
}

export default function ArtistView({
  userTracks = [],
  onPlayTrack,
  playlists = [],
  onAddToPlaylist,
  isLibraryLoading = false,
}) {
  const { artistName } = useParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("overview");

  const [wikiBio, setWikiBio] = useState(null);
  const [wikiLoading, setWikiLoading] = useState(false);

  // Prevent URIError crash if the parameter contains a literal '%' symbol
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

    let isMounted = true;

    async function fetchWikipediaBio() {
      setWikiLoading(true);
      try {
        const res = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
            artistNameDecoded
          )}`
        );
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setWikiBio(data);
        } else {
          if (isMounted) setWikiBio(null);
        }
      } catch (err) {
        console.error("Error fetching Wikipedia bio:", err);
        if (isMounted) setWikiBio(null);
      } finally {
        if (isMounted) setWikiLoading(false);
      }
    }

    fetchWikipediaBio();

    return () => {
      isMounted = false;
    };
  }, [artistNameDecoded]);

  const artistTracks = useMemo(() => {
    const name = artistNameDecoded.toLowerCase();
    if (!name) return [];
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
  const photo =
    artistTracks.find((t) => t.artistPhotoUrl)?.artistPhotoUrl || "";

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
    // min-h-full (instead of h-full) so the card fills the entire parent scroll
    // container even when its height collapses in a scroll context.
    <div className="relative w-full min-h-full flex-1 flex flex-col rounded-[2.5rem] overflow-hidden bg-white/[0.06] border border-white/25 shadow-2xl">

      {/* IMMERSIVE FULL-WIDTH BACKGROUND — crisp, bright hero photo */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <img
          src={photo || DEFAULT_COVER}
          alt={artistNameDecoded}
          className="w-full h-full object-cover"
          onError={(e) => {
            if (e.currentTarget.src !== DEFAULT_COVER) {
              e.currentTarget.src = DEFAULT_COVER;
            }
          }}
        />
        {/* Light bottom scrim only: keeps the top crisp and bright, darkens the bottom edge for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
      </div>

      {/* CONTENT WRAPPER */}
      <div className="relative z-10 flex flex-col flex-1 min-h-0 p-8 sm:p-12 overflow-y-auto">

        {/* Top Controls Toolbar */}
        <div className="flex items-center justify-between mb-16 sm:mb-24 shrink-0">
          {/* Apple Vision Pro Style Back Button */}
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

          {/* View Switcher Tabs (Segmented Control Style) */}
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

        {/* Artist Hero Info */}
        {/* flex-1 min-w-0 on text, and shrink-0 on the button to prevent breaking on long names */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10 w-full shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <h1 className="text-5xl font-black tracking-tighter text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.6)] sm:text-7xl break-words leading-[0.95]">
              {artistNameDecoded}
            </h1>
            <p className="mt-2 text-sm font-medium text-white/85 tracking-wide drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]">
              {artistTracks.length} song{artistTracks.length !== 1 ? "s" : ""} in library
            </p>
          </div>

          {/* Quick Play All Button */}
          {sortedTracks.length > 0 && (
            <div className="shrink-0">
              <LiquidGlass
                blur={10}
                refraction={18}
                saturation={1.6}
                onClick={() => onPlayTrack(sortedTracks[0])}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full cursor-pointer bg-white/15 border border-white/30 [--liquid-glass-rim-light:rgba(255,255,255,0.7)] hover:bg-white/25 transition-all font-semibold text-sm text-white shadow-xl shadow-black/10"
              >
                <Play className="w-4 h-4 fill-current text-white" />
                Play All
              </LiquidGlass>
            </div>
          )}
        </div>

        {/* VIEW 1: OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-[1fr_2fr] animate-in fade-in duration-500 pb-8">
            {/* Latest Addition Card (Left Column) */}
            <div className="space-y-4">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/85 pl-1">
                Latest Addition
              </h2>
              {latestRelease && (
                <GlassCard
                  glassVariant="liquid-refract"
                  liquidProps={{ blur: 12, refraction: 22, saturation: 1.6 }}
                  surfaceClassName="rounded-3xl border border-white/30 bg-white/10 [--liquid-glass-rim-light:rgba(255,255,255,0.65)]"
                  className="p-4 flex flex-col h-full shadow-2xl shadow-black/10"
                >
                  <div className="relative w-full aspect-square rounded-2xl overflow-hidden shadow-2xl shadow-black/60 mb-3 group">
                    <img
                      src={trackCover(latestRelease)}
                      alt={latestRelease.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      onError={(e) => {
                        if (e.currentTarget.src !== DEFAULT_COVER) {
                          e.currentTarget.src = DEFAULT_COVER;
                        }
                      }}
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={() => onPlayTrack(latestRelease)}
                        className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white hover:scale-110 transition-transform"
                      >
                        <Play className="w-5 h-5 fill-current ml-1" />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col justify-end">
                    <h4 className="text-base font-bold leading-tight text-white truncate drop-shadow-sm">
                      {latestRelease.title}
                    </h4>
                    <p className="mt-0.5 text-xs font-medium text-white/85 truncate">
                      {trackYear(latestRelease) ? `${artistNameDecoded} · ${trackYear(latestRelease)}` : artistNameDecoded}
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
                              {playlists.map((pl, index) => (
                                <DropdownMenuItem
                                  key={`${pl.id}-${index}`}
                                  onClick={() => onAddToPlaylist(pl.id, latestRelease.id)}
                                  className="focus:bg-white/20"
                                >
                                  <span className="text-sm font-medium text-white truncate">
                                    {pl.title}
                                  </span>
                                </DropdownMenuItem>
                              ))}
                            </GlassDropdownMenuContent>
                          </DropdownMenuPortal>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                </GlassCard>
              )}
            </div>

            {/* Popular List (Right Column) */}
            <div className="space-y-4 flex flex-col">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/85 pl-1">
                Popular
              </h2>
              <GlassCard
                glassVariant="liquid-refract"
                liquidProps={{ blur: 12, refraction: 22, saturation: 1.6 }}
                surfaceClassName="rounded-3xl border border-white/30 bg-white/[0.08] [--liquid-glass-rim-light:rgba(255,255,255,0.65)]"
                className="p-2 flex-1 shadow-2xl shadow-black/10 overflow-hidden flex flex-col gap-1"
              >
                {sortedTracks.map((track, index) => (
                  <div
                    key={track.id}
                    onClick={() => onPlayTrack(track)}
                    className="group flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 transition-all duration-300 hover:bg-white/10"
                  >
                    <span className="w-5 shrink-0 text-center text-sm font-semibold tabular-nums text-white/60 group-hover:text-white/90 transition-colors">
                      {index + 1}
                    </span>
                    <img
                      src={trackCover(track)}
                      alt={track.title}
                      className="h-11 w-11 shrink-0 rounded-xl object-cover shadow-lg shadow-black/40 border border-white/5"
                      onError={(e) => {
                        if (e.currentTarget.src !== DEFAULT_COVER) {
                          e.currentTarget.src = DEFAULT_COVER;
                        }
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white drop-shadow-sm">
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
              </GlassCard>
            </div>
          </div>
        )}

        {/* VIEW 2: DETAILS TAB (Wikipedia Integration) */}
        {activeTab === "details" && (
          <div className="animate-in fade-in duration-500 pt-4 pb-8 h-full">
            <LiquidGlass
              blur={12}
              refraction={22}
              saturation={1.6}
              className="rounded-[2rem] p-10 border border-white/30 bg-white/10 [--liquid-glass-rim-light:rgba(255,255,255,0.65)] shadow-2xl shadow-black/10 h-full"
            >
              <div className="max-w-3xl">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/85 mb-6">
                  About the Artist
                </h3>

                {wikiLoading ? (
                  <div className="space-y-3">
                    <div className="h-4 w-3/4 bg-white/10 rounded animate-pulse" />
                    <div className="h-4 w-full bg-white/10 rounded animate-pulse" />
                    <div className="h-4 w-5/6 bg-white/10 rounded animate-pulse" />
                    <div className="h-4 w-full bg-white/10 rounded animate-pulse" />
                    <div className="h-4 w-2/3 bg-white/10 rounded animate-pulse" />
                    <div className="h-4 w-4/5 bg-white/10 rounded animate-pulse" />
                  </div>
                ) : wikiBio?.extract ? (
                  <p className="text-lg leading-relaxed text-white/80 font-medium drop-shadow-sm line-clamp-6">
                    {wikiBio.extract}
                  </p>
                ) : (
                  <p className="text-base text-white/50">
                    No Wikipedia background information found for "{artistNameDecoded}".
                  </p>
                )}

                {wikiBio?.content_urls?.desktop?.page && (
                  <div className="pt-8 mt-8 border-t border-white/25">
                    <a
                      href={wikiBio.content_urls.desktop.page}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/15 hover:bg-white/25 border border-white/30 text-sm font-semibold text-white transition-all shadow-md"
                    >
                      Read on Wikipedia <Info className="w-4 h-4" />
                    </a>
                  </div>
                )}
              </div>
            </LiquidGlass>
          </div>
        )}
      </div>
    </div>
  );
}
