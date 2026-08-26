"use client";;
import { cn } from "@/lib/utils";

import { Card } from "../card";
import { LiquidGlass } from "./liquid-glass";


const SCRIM_SAMPLES = 16;


const SCRIM_HOLD_RATIO = 0.3;

function scrimGradient(to, opacity, coverage) {
  const hold = coverage * SCRIM_HOLD_RATIO;
  const stops = [`rgba(0,0,0,${opacity}) 0%`];
  for (let i = 0; i <= SCRIM_SAMPLES; i += 1) {
    const t = i / SCRIM_SAMPLES;
    const eased = t * t * t * (t * (t * 6 - 15) + 10);
    const position = hold + t * (coverage - hold);
    stops.push(
      `rgba(0,0,0,${(opacity * (1 - eased)).toFixed(3)}) ${(position * 100).toFixed(1)}%`
    );
  }
  return `linear-gradient(to ${to}, ${stops.join(", ")})`;
}

function GlassScrimCard({
  className,
  liquidProps,
  surfaceClassName,
  scrim = "top",
  scrimOpacity = 0.9,
  scrimCoverage = 1,
  scrimClassName,
  ...props
}) {
  const layers = [];
  if (scrim === "top" || scrim === "both") layers.push(scrimGradient("bottom", scrimOpacity, scrimCoverage));
  if (scrim === "bottom" || scrim === "both") layers.push(scrimGradient("top", scrimOpacity, scrimCoverage));

  return (
    <LiquidGlass
      {...liquidProps}
      className={cn("rounded-[3rem]", surfaceClassName, liquidProps?.className)}>
      <span
        aria-hidden
        className={cn("pointer-events-none absolute inset-0 rounded-[inherit]", scrimClassName)}
        style={{ backgroundImage: layers.join(", ") }} />
      <Card
        data-slot="glass-scrim-card"
        data-scrim={scrim}
        className={cn(
          "relative border-0 bg-transparent text-white shadow-none ring-0",
          className
        )}
        {...props} />
    </LiquidGlass>
  );
}

export { GlassScrimCard };
