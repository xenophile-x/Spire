import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { glassVariantStyles } from "@/lib/glass-variants";
import { LiquidGlass } from "@/components/ui/glasscn/liquid-glass";
import { useGlassVariant } from "@/context/GlassVariantContext";

export default function StickyGlassHeader({
  title,
  subtitle,
  action,
  icon,
  children,
  className = "",
  glassVariant,
  liquidProps,
}) {
  const sentinelRef = useRef(null);
  const headerRef = useRef(null);
  const [stuck, setStuck] = useState(false);

  // Proper glasscn: resolve variant from GlassVariantContext (secondary = card secondary)
  // Falls back to liquid-refract — the refractive header default.
  let resolvedVariant = glassVariant ?? "liquid";
  try {
    const ctx = useGlassVariant();
    if (!glassVariant && ctx?.secondaryVariant) {
      const v = ctx.secondaryVariant;
      // clear/subtle are too transparent for a sticky header over scrolled content;
      // promote to frosted for legibility (proper glasscn keeps header readable).
      resolvedVariant = v === "clear" || v === "subtle" ? "frosted" : v;
    }
  } catch {
    // outside provider (tests) -> keep default
  }

  const variantStyles = glassVariantStyles[resolvedVariant] ?? glassVariantStyles["liquid-refract"];
  const isLiquidRefract = resolvedVariant === "liquid-refract";

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const header = headerRef.current;
    if (!sentinel || !header) return;
    const scrollContainer = header.closest(".overflow-y-auto");
    const observer = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { root: scrollContainer || null, threshold: 0, rootMargin: "0px 0px 0px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // Separate props for the glass layer vs outer wrapper
  const { className: liquidClassName, style: liquidStyle, blur: liquidBlur, saturation: liquidSaturation, ...restLiquidProps } = liquidProps ?? {};

  return (
    <>
      <div ref={sentinelRef} className="h-px w-full pointer-events-none" aria-hidden="true" />
      <div
        ref={headerRef}
        data-slot="sticky-glass-header"
        data-stuck={stuck ? "true" : "false"}
        data-glass-variant={resolvedVariant}
        className={cn(
          // sticky geometry — negative margins make it bleed to the card's top edge
          "sticky -top-6 sm:-top-8 z-30 -mx-6 sm:-mx-8 -mt-6 sm:-mt-8 mb-6 sm:mb-8 px-6 sm:px-8 rounded-t-3xl overflow-hidden",
          "border-b transition-all duration-300 ease-out will-change-transform",
          stuck
            ? isLiquidRefract
              // liquid-refract: glass comes from inner <LiquidGlass isolate> (proper glasscn)
              // outer only provides padding/border/shadow and positioning
              ? "bg-transparent border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.12)] py-3"
              : cn(
                  variantStyles,
                  "py-3",
                  // boost opacity for variants that are too transparent to hide scrolling text
                  // (image blur is obvious at 12px, but thin white text at 0.16 remains legible)
                  resolvedVariant === "liquid" && "!bg-white/[0.32] [.night-mode_&]:!bg-white/[0.10] backdrop-blur-[20px]",
                  resolvedVariant === "clear" && "!bg-white/[0.42] backdrop-blur-[20px]",
                  resolvedVariant === "subtle" && "!bg-white/[0.38] backdrop-blur-[20px]"
                )
            : "bg-transparent border-transparent shadow-none py-4 sm:py-5",
          className
        )}
        style={{ transform: "translateZ(0)", backfaceVisibility: "hidden" }}
      >
        {/* Proper glasscn liquid glass background — isolate forces blur even when nested
            inside TemperedGlassCard's LiquidGlass (which otherwise suppresses nested blurs).
            bg + blur boosted so scrolling text behind is equally blurred/obscured as images
            (96px original was ~6x stronger; 24px+2 = 26px ensures text is frosted, not legible). */}
        {stuck && isLiquidRefract && (
          <LiquidGlass
            isolate
            blur={liquidBlur ?? 24}
            saturation={liquidSaturation ?? 1.9}
            aria-hidden
            className={cn(
              "absolute inset-0 rounded-[inherit] !overflow-hidden bg-white/[0.32] [.night-mode_&]:bg-white/[0.14] border border-white/[0.18] [.night-mode_&]:border-white/[0.10] shadow-[0_8px_32px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.22)]",
              "[--liquid-glass-rim-light:rgba(255,255,255,0.50)] [--liquid-glass-rim-dark:rgba(0,0,0,0.14)] [--liquid-glass-rim-width:1px] [.night-mode_&]:[--liquid-glass-rim-light:rgba(180,200,255,0.38)]",
              liquidClassName
            )}
            style={liquidStyle}
            {...restLiquidProps}
          />
        )}

        <div className="relative flex items-center justify-between gap-4 max-w-5xl mx-auto w-full">
          <div className="flex items-center gap-3 min-w-0">
            {icon && <div className="shrink-0 hidden sm:flex">{icon}</div>}
            <div className="min-w-0">
              <h1
                className={cn(
                  "font-bold tracking-tight text-white leading-none truncate transition-all duration-300",
                  stuck ? "text-[clamp(1.15rem,2vw,1.35rem)]" : "text-[clamp(1.35rem,2.5vw,1.875rem)]"
                )}
              >
                {title}
              </h1>
              {subtitle !== undefined && subtitle !== null && subtitle !== "" && (
                <p
                  className={cn(
                    "font-medium text-white/60 truncate transition-all duration-300",
                    stuck ? "text-[11px] mt-0" : "text-xs mt-0.5"
                  )}
                >
                  {subtitle}
                </p>
              )}
              {children && (
                <div className={cn("transition-all duration-300", stuck ? "scale-[0.98] origin-left" : "scale-100")}>
                  {children}
                </div>
              )}
            </div>
          </div>
          {action && (
            <div className={cn("shrink-0 transition-all duration-300 ease-out", stuck ? "scale-95 opacity-90" : "scale-100 opacity-100")}>
              {action}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
