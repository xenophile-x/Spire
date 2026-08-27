"use client";
import { glassVariantStyles } from "@/lib/glass-variants";
import { cn } from "@/lib/utils";

import { Skeleton } from "../skeleton";
import { LiquidGlass } from "./liquid-glass";

function GlassSkeleton({
  className,
  glassVariant = "liquid-refract",
  ...props
}) {
  if (glassVariant === "liquid-refract") {
    return (
      <LiquidGlass className={cn("rounded-md", className)}>
        <Skeleton
          data-slot="glass-skeleton"
          data-glass-variant={glassVariant}
          className={cn("bg-transparent", className)}
          {...props} />
      </LiquidGlass>
    );
  }

  return (
    <Skeleton
      data-slot="glass-skeleton"
      data-glass-variant={glassVariant}
      className={cn(glassVariantStyles[glassVariant], className)}
      {...props} />
  );
}

export { GlassSkeleton };
