import React, { useEffect, useRef, useState } from "react";

/**
 * Apple-style sticky glass header
 * - Sticks to scroll container (overflow-y-auto) with backdrop blur
 * - Shrinks dynamically on scroll (scale + padding + font size)
 * - Full-bleed via negative margins to counter parent p-6/p-8
 */
export default function StickyGlassHeader({
  title,
  subtitle,
  action,
  icon,
  children,
  className = "",
}) {
  const sentinelRef = useRef(null);
  const headerRef = useRef(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const header = headerRef.current;
    if (!sentinel || !header) return;

    // Find nearest scroll container (AppLayout's overflow-y-auto)
    const scrollContainer = header.closest(".overflow-y-auto");
    const observer = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      {
        root: scrollContainer || null,
        threshold: 0,
        rootMargin: "-1px 0px 0px 0px",
      }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinelRef} className="h-px w-full pointer-events-none" aria-hidden="true" />
      <div
        ref={headerRef}
        className={`sticky top-0 z-30 -mx-6 sm:-mx-8 -mt-6 sm:-mt-8 mb-6 sm:mb-8 px-6 sm:px-8 backdrop-blur-2xl backdrop-saturate-150 border-b transition-all duration-300 ease-out will-change-transform ${
          stuck
            ? "bg-black/50 py-3 border-white/10 shadow-lg shadow-black/20"
            : "bg-black/30 py-4 sm:py-5 border-white/5"
        } ${className}`}
      >
        <div className="flex items-center justify-between gap-4 max-w-5xl mx-auto w-full">
          <div className="flex items-center gap-3 min-w-0">
            {icon && <div className="shrink-0 hidden sm:flex">{icon}</div>}
            <div className="min-w-0">
              <h1
                className={`font-bold tracking-tight text-white leading-none truncate transition-all duration-300 ${
                  stuck
                    ? "text-[clamp(1.15rem,2vw,1.35rem)]"
                    : "text-[clamp(1.35rem,2.5vw,1.875rem)]"
                }`}
              >
                {title}
              </h1>
              {subtitle !== undefined && subtitle !== null && subtitle !== "" && (
                <p
                  className={`font-medium text-white/60 truncate transition-all duration-300 ${
                    stuck ? "text-[11px] mt-0" : "text-xs mt-0.5"
                  }`}
                >
                  {subtitle}
                </p>
              )}
              {children && (
                <div className={`transition-all duration-300 ${stuck ? "scale-[0.98] origin-left" : "scale-100"}`}>
                  {children}
                </div>
              )}
            </div>
          </div>
          {action && (
            <div
              className={`shrink-0 transition-all duration-300 ease-out ${
                stuck ? "scale-95 opacity-90" : "scale-100 opacity-100"
              }`}
            >
              {action}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
