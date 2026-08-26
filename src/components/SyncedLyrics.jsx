import React, { useMemo, useEffect, useRef, useCallback } from "react";
import { parseLRC, getActiveLyricIndex } from "@/utils/lyricsParser";


export default function SyncedLyrics({
  lines,
  syncedLyrics,
  plainLyrics = "",
  currentTime = 0,
  onSeek,
  autoFollow = true,
  onAutoFollowChange,
  emptyMessage = "No lyrics available for this track.",
  containerClassName = "",
  spacerClassName = "h-32",
  lineClassName,
}) {
  const containerRef = useRef(null);
  const activeLineRef = useRef(null);


  const isAutoScrollingRef = useRef(false);
  const releaseTimerRef = useRef(null);

  const parsedLines = useMemo(
    () => lines || parseLRC(syncedLyrics || ""),
    [lines, syncedLyrics]
  );

  const activeIndex = useMemo(
    () => getActiveLyricIndex(parsedLines, currentTime),
    [parsedLines, currentTime]
  );

  const centerActiveLine = useCallback(() => {
    const container = containerRef.current;
    const el = activeLineRef.current;
    if (!container || !el) return;
    const target =
      el.offsetTop - container.clientHeight / 2 + el.offsetHeight / 2;
    const clamped = Math.max(
      0,
      Math.min(target, container.scrollHeight - container.clientHeight)
    );
    isAutoScrollingRef.current = true;
    container.scrollTo({ top: clamped, behavior: "smooth" });


    if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
    releaseTimerRef.current = setTimeout(() => {
      isAutoScrollingRef.current = false;
    }, 450);
  }, []);

  useEffect(() => {
    if (autoFollow && activeIndex >= 0) {
      centerActiveLine();
    }
  }, [activeIndex, autoFollow, centerActiveLine]);

  useEffect(() => {
    return () => {
      if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  const scrollTimeoutRef = useRef(null);

  const handleScroll = () => {
    if (!isAutoScrollingRef.current) {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        onAutoFollowChange?.(false);
      }, 150);
    }
  };

  const handleLineClick = (time) => {
    onAutoFollowChange?.(false);
    onSeek?.(time);
  };

  const defaultLineClass = useCallback((index, isActive, isPast) =>
    `cursor-pointer text-center font-bold tracking-tight transition-all duration-300 ${
      isActive
        ? "text-white text-3xl sm:text-4xl drop-shadow-[0_0_18px_rgba(255,255,255,0.5)]"
        : isPast
        ? "text-white/60 text-xl sm:text-2xl hover:text-white/80"
        : "text-white/45 text-xl sm:text-2xl hover:text-white/70"
    }`, []);


  if (!parsedLines.length) {
    if (plainLyrics) {
      return (
        <div className="h-full w-full overflow-y-auto whitespace-pre-line px-8 py-6 text-center text-lg font-medium leading-relaxed custom-scrollbar">
          {plainLyrics}
        </div>
      );
    }
    return (
      <div className="flex h-full w-full items-center justify-center text-center">
        <p className="text-sm font-medium">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={containerClassName}
    >
      <div className={spacerClassName} />
      {parsedLines.map((line, index) => {
        const isActive = index === activeIndex;
        const isPast = index < activeIndex;
        const cls = lineClassName
          ? lineClassName(index, isActive, isPast)
          : defaultLineClass(index, isActive, isPast);
        return (
          <p
            key={`${line.time}-${index}`}
            ref={isActive ? activeLineRef : null}
            onClick={() => handleLineClick(line.time)}
            className={`select-none ${cls}`}
          >
            {line.text}
          </p>
        );
      })}
      <div className={spacerClassName} />
    </div>
  );
}
