"use client";;
import { glassVariantStyles } from "@/lib/glass-variants";
import { cn } from "@/lib/utils";

import { Item } from "../item";
import { LiquidGlass } from "./liquid-glass";

function GlassItem({
  className,
  glassVariant = "liquid-refract",
  ...props
}) {
  if (glassVariant === "liquid-refract") {
    return (
      <LiquidGlass className="rounded-2xl">
        <Item
          data-slot="glass-item"
          data-glass-variant={glassVariant}
          className={cn("text-foreground border-0 bg-transparent shadow-none", className)}
          {...props} />
      </LiquidGlass>
    );
  }

  return (
    <Item
      data-slot="glass-item"
      data-glass-variant={glassVariant}
      className={cn("text-foreground", glassVariantStyles[glassVariant], className)}
      {...props} />
  );
}

export { GlassItem };
