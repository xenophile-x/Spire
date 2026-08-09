 import React, { useMemo, useEffect, useRef } from 'react';

function parseLRC(lrcString) {
  if (!lrcString) return [];

  const lines = lrcString.split('\n');
  const parsed = [];

  const timeRegex = /\[(\d{2}):(\d{2})[.:](\d{2,3})\]/;

  for (const line of lines) {
    const match = timeRegex.exec(line);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const milliseconds = parseInt(match[3].padEnd(3, '0'), 10);

      const timeInSeconds = minutes * 60 + seconds + milliseconds / 1000;
      const text = line.replace(timeRegex, '').trim();

      if (text) {
        parsed.push({ time: timeInSeconds, text });
      }
    }
  }

  return parsed.sort((a, b) => a.time - b.time);
}

export default function SyncedLyrics({ syncedLyrics, plainLyrics, currentTime = 0, onSeek }) {
  const containerRef = useRef(null);
  const activeLineRef = useRef(null);

  const parsedLyrics = useMemo(() => parseLRC(syncedLyrics), [syncedLyrics]);

  const activeIndex = useMemo(() => {
    if (!parsedLyrics.length) return -1;

    for (let i = parsedLyrics.length - 1; i >= 0; i--) {
      if (currentTime >= parsedLyrics[i].time) {
        return i;
      }
    }
    return 0;
  }, [parsedLyrics, currentTime]);

  useEffect(() => {
    if (activeLineRef.current && containerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex]);

  if (!syncedLyrics && plainLyrics) {
    return (
      <div className="h-full overflow-y-auto p-6 text-neutral-300 whitespace-pre-line text-lg leading-relaxed text-center font-medium">
        {plainLyrics}
      </div>
    );
  }

  // Fallback 2: No lyrics found
  if (!parsedLyrics.length) {
    return (
      <div className="h-full flex items-center justify-center text-neutral-500 font-medium">
        No lyrics available for this track.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto p-10 space-y-6 scrollbar-none no-scrollbar text-center select-none"
    >
      {}
      <div className="h-32" />

      {parsedLyrics.map((line, index) => {
        const isActive = index === activeIndex;
        const isPast = index < activeIndex;

        return (
          <p
            key={`${line.time}-${index}`}
            ref={isActive ? activeLineRef : null}
            onClick={() => onSeek && onSeek(line.time)}
            className={`cursor-pointer transition-all duration-300 font-bold tracking-tight transform origin-center ${
              isActive
                ? 'text-white text-2xl md:text-3xl scale-105 opacity-100 drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]'
                : isPast
                ? 'text-neutral-500 text-lg md:text-xl opacity-60 hover:opacity-90'
                : 'text-neutral-400 text-lg md:text-xl opacity-40 hover:opacity-80'
            }`}
          >
            {line.text}
          </p>
        );
      })}

      {/* Bottom spacer to allow last lines to center properly */}
      <div className="h-32" />
    </div>
  );
}