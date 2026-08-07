// src/components/LyricsModal.jsx
import React, { useEffect, useRef, useState } from "react";
import { parseLRC, getActiveLyricIndex } from "@/utils/lyricsParser";
import { GlassCard } from "@/components/ui/glasscn/glass-card";
import { GlassButton } from "@/components/ui/glasscn/glass-button";

export default function LyricsModal({
  isOpen,
  onClose,
  activeTrack,
  currentTime,
  onSeek,
}) {
  const [lyrics, setLyrics] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const activeLineRef = useRef(null);

  useEffect(() => {
    const rawLrc = activeTrack?.synced_lyrics || activeTrack?.syncedLyrics || "";
    const parsed = parseLRC(rawLrc);
    setLyrics(parsed);
  }, [activeTrack]);

  useEffect(() => {
    if (lyrics.length > 0) {
      const idx = getActiveLyricIndex(lyrics, currentTime);
      setActiveIndex(idx);
    }
  }, [currentTime, lyrics]);

  useEffect(() => {
    if (activeLineRef.current && containerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [activeIndex]);

  if (!isOpen) return null;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 duration-300 transition-all">
      <GlassCard
        glassVariant="liquid-refract"
        liquidProps={{
          blur: 16,
          refraction: 14,
          className: "rounded-3xl shadow-2xl [--liquid-glass-rim-light:rgba(255,255,255,0.35)]",
        }}
        className="relative flex max-h-[380px] w-full max-w-2xl flex-col gap-0 py-0 text-white"
      >
        <div className="mb-4 flex shrink-0 items-center justify-between border-b border-white/10 px-6 pb-3 pt-6">
          <div className="flex items-center gap-2">
            <span className="material-symbols-rounded text-xl text-yellow-400">lyrics</span>
            <h3 className="text-sm font-bold tracking-wide">Live Synchronized Lyrics</h3>
          </div>
          <GlassButton
            onClick={onClose}
            glassVariant="liquid-refract"
            className="rounded-full px-3 py-1 text-xs font-semibold text-white"
          >
            Close
          </GlassButton>
        </div>

        <div
          ref={containerRef}
          className="scrollbar-none flex-1 space-y-4 overflow-y-auto px-8 py-4 text-center"
        >
          {lyrics.length === 0 ? (
            <div className="py-12 text-sm font-medium italic text-white/40">
              No synced lyrics available for this track.
            </div>
          ) : (
            lyrics.map((line, idx) => {
              const isActive = idx === activeIndex;
              return (
                <p
                  key={idx}
                  ref={isActive ? activeLineRef : null}
                  onClick={() => onSeek && onSeek(line.time)}
                  className={`text-md cursor-pointer font-bold transition-all duration-300 select-none ${
                    isActive
                      ? "scale-100 text-white opacity-100 drop-shadow-[0_0_12px_rgba(255,255,255,0.6)]"
                      : "text-base text-white/30 hover:text-white/60"
                  }`}
                >
                  {line.text}
                </p>
              );
            })
          )}
        </div>
      </GlassCard>
    </div>
  );
}
