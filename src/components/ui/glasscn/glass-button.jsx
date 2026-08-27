"use client";
import { glassVariantStyles } from "@/lib/glass-variants";
import { cn } from "@/lib/utils";

import { Button } from "../button";
import { LiquidGlass } from "./liquid-glass";

function GlassButton({
  className,
  glassVariant = "liquid-refract",
  ...props
}) {
  const variantStyles = glassVariantStyles[glassVariant] || "";
  const isLiquidRefract = glassVariant === "liquid-refract";

  if (isLiquidRefract) {
    return (
      <LiquidGlass
        className={cn("rounded-full", className)}
        blur={8}
        refraction={10}
        saturation={1.5}
      >
        <Button
          data-slot="glass-button"
          data-glass-variant={glassVariant}
          className={cn(
            "text-foreground cursor-pointer bg-transparent border-0 shadow-none",
            variantStyles,
            className
          )}
          {...props} />
      </LiquidGlass>
    );
  }

  return (
    <Button
      data-slot="glass-button"
      data-glass-variant={glassVariant}
      className={cn(
        "text-foreground cursor-pointer",
        variantStyles,
        className
      )}
      {...props} />
  );
}

export { GlassButton };
