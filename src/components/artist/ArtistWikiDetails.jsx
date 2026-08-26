import React from "react";

export default function ArtistWikiDetails({ artistName, wikiBio, wikiLoading }) {
  return (
    <div className="animate-in fade-in duration-500 pt-4 pb-8 h-full flex flex-col min-h-0">
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
          <p className="text-lg leading-relaxed text-white/80 font-medium drop-shadow-sm">
            {wikiBio.extract}
          </p>
        ) : (
          <p className="text-base text-white/50">
            No Wikipedia background information found for "{artistName}".
          </p>
        )}

        {wikiBio?.url && (
          <div className="pt-8 mt-8 border-t border-white/25">
            <a
              href={wikiBio.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold text-white underline-offset-4 transition-all hover:underline"
            >
              Read on Wikipedia
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
