"use client";
import { glassVariantStyles } from "@/lib/glass-variants";
import { cn } from "@/lib/utils";

import { Input } from "../input";
import { LiquidGlass } from "./liquid-glass";

function GlassInput({
  className,
  glassVariant = "liquid-refract",
  ...props
}) {
  if (glassVariant === "liquid-refract") {
    return (
      <LiquidGlass className={cn("rounded-lg overflow-hidden flex items-center justify-center", className)}>
        <Input
          data-slot="glass-input"
          data-glass-variant={glassVariant}
          className={cn(className, "bg-transparent border-0 shadow-none w-full")}
          {...props} />
      </LiquidGlass>
    );
  }

  return (
    <Input
      data-slot="glass-input"
      data-glass-variant={glassVariant}
      className={cn("text-foreground", glassVariantStyles[glassVariant], className)}
      {...props} />
  );
}

export { GlassInput };
