import React, { useEffect, useRef } from "react";

const WRAP_THRESHOLD_PX = 8;
const SCROLL_STORE_PREFIX = "carousel_scroll_";

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

    let third = 0;
    let frame = null;
    let restored = false;

    const readSavedOffset = () => {
      if (!storageKey) return null;
      try {
        const raw = sessionStorage.getItem(SCROLL_STORE_PREFIX + storageKey);
        const num = raw === null ? NaN : Number(raw);
        return Number.isFinite(num) ? num : null;
      } catch {
        return null;
      }
    };

    const saveOffset = (value) => {
      if (!storageKey) return;
      try {
        sessionStorage.setItem(
          SCROLL_STORE_PREFIX + storageKey,
          String(Math.round(value))
        );
      } catch {
        // Storage unavailable — persistence is best-effort only.
      }
    };

    const measure = () => {
      if (container.children.length !== childCount * 3) return;
      third = container.scrollWidth / 3;
    };

    const clampToMiddle = () => {
      if (!third) return;
      if (
        container.scrollLeft < third ||
        container.scrollLeft >= third * 2
      ) {
        container.scrollLeft = third + WRAP_THRESHOLD_PX;
      }
    };

    const tryRestore = () => {
      if (restored || !third) return;
      const saved = readSavedOffset();
      if (
        saved !== null &&
        saved >= third - WRAP_THRESHOLD_PX &&
        saved < third * 2
      ) {
        container.scrollLeft = saved;
      } else {
        clampToMiddle();
      }
      restored = true;
    };

    const handleScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        if (!third) return;
        let { scrollLeft } = container;
        // Stepped into the left clone — snap forward one full block.
        if (scrollLeft <= WRAP_THRESHOLD_PX) {
          scrollLeft += third;
          container.scrollLeft = scrollLeft;
        }
        // Stepped into the right clone — snap back one full block.
        else if (scrollLeft >= third * 2 - WRAP_THRESHOLD_PX) {
          scrollLeft -= third;
          container.scrollLeft = scrollLeft;
        }
        saveOffset(scrollLeft);
      });
    };

    const observer = new ResizeObserver(() => {
      measure();
      if (!restored) {
        tryRestore();
      } else {
        clampToMiddle();
      }
    });
    observer.observe(container);

    // Defer initial measure until after paint so children exist in DOM
    requestAnimationFrame(() => {
      measure();
      tryRestore();
    });

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      // Persist on unmount too (covers navigating away without a final
      // scroll event).
      if (third) saveOffset(container.scrollLeft);
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
