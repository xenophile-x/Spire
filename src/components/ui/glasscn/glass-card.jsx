"use client";
import { glassVariantStyles } from "@/lib/glass-variants";
import { cn } from "@/lib/utils";

import { Card, CardFooter } from "../card";
import { LiquidGlass } from "./liquid-glass";

function GlassCard({
  className,
  glassVariant = "liquid-refract",
  liquidProps,
  surfaceClassName,
  ...props
}) {
  if (glassVariant === "liquid-refract") {
    return (
      <LiquidGlass
        {...liquidProps}
        className={cn("rounded-2xl", surfaceClassName, liquidProps?.className)}>
        <Card
          data-slot="glass-card"
          data-glass-variant={glassVariant}
          className={cn("bg-transparent border-0 shadow-none ring-0", className)}
          {...props} />
      </LiquidGlass>
    );
  }

  return (
    <Card
      data-slot="glass-card"
      data-glass-variant={glassVariant}
      className={cn(glassVariantStyles[glassVariant], className)}
      {...props} />
  );
}

const footerVariantStyles = {
  clear: "bg-white/10 dark:bg-black/10",
  frosted: "bg-white/20 dark:bg-black/20",
  subtle: "bg-white/15 dark:bg-white/[0.04]",
  liquid: "bg-white/15 dark:bg-white/[0.06] [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.45)]",
  "liquid-refract": "bg-white/10 dark:bg-white/[0.04]",
};

function GlassCardFooter({
  className,
  glassVariant = "liquid-refract",
  ...props
}) {
  return (
    <CardFooter
      data-glass-variant={glassVariant}
      className={cn(footerVariantStyles[glassVariant], className)}
      {...props} />
  );
}

export { GlassCard, GlassCardFooter };
