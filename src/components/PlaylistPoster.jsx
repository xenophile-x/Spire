import React from "react";
import { Play } from "lucide-react";
import gradientsData from "@/data/gradients.json";


export function gradientForTitle(title = "") {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = (hash * 31 + title.charCodeAt(i)) >>> 0;
  }
  return gradientsData[hash % gradientsData.length];
}


export default function PlaylistPoster({
  variant = "apple",
  title = "My Playlist",
  subtitle = "Generated",
  artists = [],
  images = [],
  gradient,
  className = "",
  children,
}) {
  const baseGradient = gradient || gradientForTitle(title);
  const artistList = Array.isArray(artists) ? artists : [artists];


  const displayArtists =
    artistList.length === 0
      ? ""
      : `${artistList.slice(0, 5).join(", ")}${
          artistList.length > 5 ? ", ..." : ""
        }`;


  const titleSizeClass = title.length > 18 ? "text-2xl" : "text-3xl";


  const formatTitle = (text) =>
    text
      .trim()
      .split(" ")
      .filter(Boolean)
      .map((word, i) => (
        <React.Fragment key={i}>
          {word}
          <br />
        </React.Fragment>
      ));

  if (variant === "spotify") {
    const gridImages =
      images.length === 4
        ? images
        : [1, 2, 3, 4].map(
            (i) => `https://picsum.photos/seed/${encodeURIComponent(title)}-${i}/200`
          );
    return (
      <div
        className={`group relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-xl bg-[#181818] shadow-2xl transition-transform duration-300 hover:scale-[1.02] ${className}`}
      >
        <div className="relative z-0 grid h-full w-full grid-cols-2 grid-rows-2">
          {gridImages.map((src, i) => (
            <img
              key={i}
              src={src}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
              crossOrigin="anonymous"
            />
          ))}
        </div>

        <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 z-20 p-4 transition-transform duration-300 group-hover:-translate-y-2">
          <h3 className="line-clamp-2 text-lg font-bold leading-tight tracking-tight text-white">
            {title}
          </h3>
          <p className="mt-1 text-xs font-medium text-white/70">{subtitle}</p>
        </div>

        <div className="absolute bottom-4 right-4 z-30 translate-y-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1DB954] text-black shadow-[0_8px_16px_rgba(0,0,0,0.3)] transition-colors hover:bg-[#1ed760]">
            <Play className="ml-1 h-6 w-6 fill-current" />
          </div>
        </div>

        {children}
      </div>
    );
  }

  return (
    <div
      className={`group relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-2xl ${className}`}
      style={{ backgroundColor: baseGradient.colors[0] }}
    >

      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">

        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(160deg, ${baseGradient.colors[0]} 0%, ${baseGradient.colors[1]} 100%)`,
          }}
        />


        <div
          className="absolute -right-[20%] -top-[30%] h-[90%] w-[120%] -rotate-15 scale-y-75 rounded-full opacity-80 blur-[50px] mix-blend-screen"
          style={{
            background: `radial-gradient(ellipse at center, #ffffff 0%, ${baseGradient.colors[1]} 50%, transparent 80%)`,
          }}
        />


        <div
          className="absolute -left-[30%] top-[10%] h-[80%] w-[130%] rotate-25 rounded-full opacity-60 blur-[60px] mix-blend-overlay"
          style={{
            background: `radial-gradient(ellipse at center, #ffffff 10%, ${baseGradient.colors[0]} 60%, transparent 90%)`,
          }}
        />


        <div
          className="absolute -bottom-[30%] -left-[10%] h-[80%] w-[100%] rounded-full opacity-40 blur-[60px] mix-blend-soft-light"
          style={{
            background: `radial-gradient(ellipse at center, rgba(0,0,0,0.6) 0%, transparent 70%)`,
          }}
        />


        <div className="absolute inset-0 rounded-2xl shadow-[inset_0_0_60px_rgba(0,0,0,0.35)]" />
      </div>


      <div className="absolute left-4 top-4 z-20 flex items-center gap-1 text-white drop-shadow-sm">
        <span className="text-[11px] font-bold tracking-tight">Spire</span>
      </div>


      <div className="absolute left-4 right-4 top-[3.2rem] z-20">
        <h2
          className={`${titleSizeClass} font-extrabold leading-[1.05] tracking-tighter text-white drop-shadow-md`}
        >
          {formatTitle(title)}
        </h2>
      </div>


      {displayArtists && (
        <div className="absolute bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-black/20 px-3 py-3 backdrop-blur-[8px]">
          <p className="line-clamp-2 text-[9px] font-medium leading-snug tracking-wide text-white/95">
            {displayArtists}
          </p>
        </div>
      )}

      {children}
    </div>
  );
}