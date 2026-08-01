"use client";
import { cn } from "@/lib/utils";

import { Card } from "../card";
import { LiquidGlass } from "./liquid-glass";

function GlassScrimCard({
  className,
  liquidProps,
  surfaceClassName,
  scrim,
  scrimOpacity,
  scrimCoverage,
  scrimClassName,
  ...props
}) {
  return (
    <LiquidGlass
      {...liquidProps}
      className={cn("rounded-[3rem]", surfaceClassName, liquidProps?.className)}>
      <Card
        data-slot="glass-scrim-card"
        className={cn(
          "relative border-0 bg-transparent text-white shadow-none ring-0",
          className
        )}
        {...props} />
    </LiquidGlass>
  );
}

export { GlassScrimCard };