// src/components/LyricsModal.jsx
import React, { useEffect, useRef, useState } from "react";
import { parseLRC, getActiveLyricIndex } from "@/utils/lyricsParser";

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

  // Parse raw LRC string whenever track changes
  useEffect(() => {
    const rawLrc = activeTrack?.synced_lyrics || activeTrack?.syncedLyrics || "";
    const parsed = parseLRC(rawLrc);
    setLyrics(parsed);
  }, [activeTrack]);

  // Sync active index with currentTime
  useEffect(() => {
    if (lyrics.length > 0) {
      const idx = getActiveLyricIndex(lyrics, currentTime);
      setActiveIndex(idx);
    }
  }, [currentTime, lyrics]);

  // Auto-scroll active lyric line to center
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
    <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 transition-all animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="w-full max-w-2xl bg-black/70 border border-white/15 backdrop-blur-2xl rounded-3xl p-6 shadow-2xl text-white relative flex flex-col max-h-[380px]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4 shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-rounded text-yellow-400 text-xl">
              lyrics
            </span>
            <h3 className="text-sm font-bold tracking-wide">
              Live Synchronized Lyrics
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-xs font-semibold px-3 py-1 bg-white/10 hover:bg-white/20 border border-white/10 rounded-full transition-all cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Scrollable Lyrics Container */}
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto space-y-4 px-2 py-4 scrollbar-none text-center"
        >
          {lyrics.length === 0 ? (
            <div className="py-12 text-white/40 text-sm font-medium italic">
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
                  className={`transition-all duration-300 cursor-pointer text-lg font-bold select-none ${
                    isActive
                      ? "text-white scale-105 opacity-100 drop-shadow-[0_0_12px_rgba(255,255,255,0.6)]"
                      : "text-white/30 hover:text-white/60 text-base"
                  }`}
                >
                  {line.text}
                </p>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}