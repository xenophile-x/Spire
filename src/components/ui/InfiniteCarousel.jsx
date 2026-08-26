import React, { useEffect, useRef } from "react";

const WRAP_THRESHOLD_PX = 8;
const SCROLL_STORE_PREFIX = "carousel_scroll_";
const RESTORE_TICK_MS = 120;
const RESTORE_MAX_TRIES = 25;

export function InfiniteCarousel({
  children,
  gap = 20,
  className = "",
  storageKey,
}) {
  const scrollRef = useRef(null);
  const childCount = React.Children.count(children);
  // Keep the effect off `children` — that array is re-created on every parent
  // render and would reset the scroll position each time.

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || childCount === 0) return;

    let blockWidth = 0;
    let frame = null;
    let restoreTimer = null;
    let restored = false;

    // Saved shape: { i, off } — index of the item under the viewport's left
    // edge plus the pixel offset into it. Survives reorders and list growth,
    // unlike raw scrollLeft. Legacy entries were bare numbers; they are
    // ignored once and replaced on the next scroll.
    const readSaved = () => {
      if (!storageKey) return null;
      try {
        const parsed = JSON.parse(
          sessionStorage.getItem(SCROLL_STORE_PREFIX + storageKey)
        );
        if (
          parsed &&
          typeof parsed === "object" &&
          Number.isFinite(parsed.i) &&
          Number.isFinite(parsed.off)
        ) {
          return { i: parsed.i, off: parsed.off };
        }
      } catch {}
      return null;
    };

    const writeSaved = (payload) => {
      if (!storageKey) return;
      try {
        sessionStorage.setItem(
          SCROLL_STORE_PREFIX + storageKey,
          JSON.stringify(payload)
        );
      } catch {
        // Storage unavailable — persistence is best-effort only.
      }
    };

    // Exact width of one repeated block: distance between child #0 of copy 0
    // and child #0 of copy 1. Unlike scrollWidth/3, this tolerates the flex
    // `gap`, which sits between blocks only once and skewed the old math.
    const measure = () => {
      const kids = container.children;
      if (kids.length !== childCount * 3) return false;
      const width = kids[childCount].offsetLeft - kids[0].offsetLeft;
      if (!(width > 0)) return false;
      blockWidth = width;
      return true;
    };

    const blockOffsetOf = (index) =>
      container.children[index].offsetLeft - container.children[0].offsetLeft;

    const capturePosition = () => {
      const { scrollLeft } = container;
      const last = childCount - 1;
      let i = 0;
      while (i < last && blockOffsetOf(i + 1) <= scrollLeft) i += 1;
      const off = Math.min(Math.max(scrollLeft - blockOffsetOf(i), 0), blockWidth);
      writeSaved({ i, off: Math.round(off) });
    };

    const applySaved = () => {
      const saved = readSaved();
      if (saved) {
        const i = Math.min(Math.max(saved.i, 0), childCount - 1);
        const off = Math.min(Math.max(saved.off, 0), blockWidth);
        container.scrollLeft = blockWidth + blockOffsetOf(i) + off;
      } else {
        // No history — park at the start of the middle copy.
        container.scrollLeft = blockWidth + WRAP_THRESHOLD_PX;
      }
      restored = true;
    };

    const handleScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        if (!blockWidth) return;
        let { scrollLeft } = container;
        // Stepped into the left clone — snap forward one full block.
        if (scrollLeft <= WRAP_THRESHOLD_PX) {
          scrollLeft += blockWidth;
          container.scrollLeft = scrollLeft;
        }
        // Stepped into the right clone — snap back one full block.
        else if (scrollLeft >= blockWidth * 2 - WRAP_THRESHOLD_PX) {
          scrollLeft -= blockWidth;
          container.scrollLeft = scrollLeft;
        }
        capturePosition();
      });
    };

    const observer = new ResizeObserver(() => {
      if (!measure()) return;
      if (restored) {
        // Content shrank under us — pull the viewport back into the middle.
        const { scrollLeft } = container;
        if (scrollLeft < blockWidth || scrollLeft >= blockWidth * 2) {
          container.scrollLeft = blockWidth + WRAP_THRESHOLD_PX;
        }
      } else {
        applySaved();
      }
    });
    observer.observe(container);

    // Layout can settle long after mount (async library data, images,
    // webfonts). A single rAF misses that window and the carousel silently
    // stays at zero, so poll briefly until a measurement sticks.
    const scheduleRestoreTick = (tries = 0) => {
      if (restored || tries >= RESTORE_MAX_TRIES) return;
      restoreTimer = setTimeout(() => {
        if (restored) return;
        if (measure()) {
          applySaved();
        } else {
          scheduleRestoreTick(tries + 1);
        }
      }, RESTORE_TICK_MS);
    };

    if (measure()) {
      applySaved();
    } else {
      scheduleRestoreTick();
    }

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      if (restoreTimer) clearTimeout(restoreTimer);
      // Persist on unmount too (covers navigating away without a final
      // scroll event).
      if (blockWidth) capturePosition();
    };
  }, [childCount, storageKey]);

  if (childCount === 0) return null;

  return (
    <div className={`w-full min-w-0 overflow-hidden ${className}`}>
      <div
        ref={scrollRef}
        className="no-scrollbar flex w-full flex-nowrap overflow-x-auto"
        style={{ gap: `${gap}px` }}
      >
        {/* Three identical blocks; the viewport always lives in the middle
            one, so scrolling wraps seamlessly in either direction. */}
        {[0, 1, 2].map((copy) => (
          <React.Fragment key={copy}>
            {childCount > 0 &&
              React.Children.map(children, (child, index) =>
                React.cloneElement(child, { key: `${copy}-${index}` })
              )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
