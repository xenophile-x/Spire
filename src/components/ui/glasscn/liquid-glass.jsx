"use client";;
import { createContext, forwardRef, useContext } from "react";

import { cn } from "@/lib/utils";

// Chromium executes SVG-referenced backdrop filters (url(#filter)) on the CPU
// raster path every frame and mis-samples feImage displacement maps, causing
// smeared bands, ghost edges and heavy stutter over animated backdrops. All
// browsers therefore get the GPU-composited blur+saturate treatment; the
// liquid look comes from the rim highlight below instead of displacement.
//
// Nested glass elements skip their own backdrop-filter entirely: the parent
// already refracted those exact pixels, and stacking filters forces an extra
// Chromium readback pass per frame for no visible gain.
const LiquidGlassDepthContext = createContext(0);

export const LiquidGlass = forwardRef(function LiquidGlass(
  {
    blur = 2,
    refraction: _refraction,
    mapSize: _mapSize,
    bezel: _bezel,
    variant: _variant,
    saturation = 1.28,
    className,
    style,
    children,
    ...props
  },
  ref,
) {
  const depth = useContext(LiquidGlassDepthContext);
  const isNested = depth > 0;

  const backdropFilter = isNested
    ? "none"
    : `blur(${blur + 2}px) saturate(${saturation})`;

  return (
    <div
      ref={ref}
      className={cn("relative overflow-hidden rounded-full bg-white/[0.12]", className)}
      style={{
        ...style,
        backdropFilter,
        WebkitBackdropFilter: backdropFilter,
        transform: style?.transform ?? "translateZ(0)",
        backfaceVisibility: "hidden",
      }}
      {...props}>
      <LiquidGlassDepthContext.Provider value={depth + 1}>
        {children}
      </LiquidGlassDepthContext.Provider>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{
          padding: "var(--liquid-glass-rim-width, 0.5px)",
          background:
            "linear-gradient(to right, rgba(255,255,255,0), var(--liquid-glass-rim-light, rgba(255,255,255,0.25)) var(--liquid-glass-rim-fade, 18%), var(--liquid-glass-rim-light, rgba(255,255,255,0.25)) calc(100% - var(--liquid-glass-rim-fade, 18%)), rgba(255,255,255,0)), " +
            "linear-gradient(to bottom, rgba(0,0,0,0), var(--liquid-glass-rim-dark, rgba(0,0,0,0.2)) var(--liquid-glass-rim-fade, 18%), var(--liquid-glass-rim-dark, rgba(0,0,0,0.2)) calc(100% - var(--liquid-glass-rim-fade, 18%)), rgba(0,0,0,0))",
          WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          mask: "linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)",
        }} />
    </div>
  );
});
