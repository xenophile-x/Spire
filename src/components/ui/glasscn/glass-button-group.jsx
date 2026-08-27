"use client";
import { glassVariantStyles } from "@/lib/glass-variants";
import { cn } from "@/lib/utils";

import { ButtonGroup } from "../button-group";
import { LiquidGlass } from "./liquid-glass";

function GlassButtonGroup({
  className,
  glassVariant = "liquid-refract",
  children,
  ...props
}) {
  if (glassVariant === "liquid-refract") {
    return (
      <LiquidGlass className={cn("", className)}>
        <ButtonGroup
          data-slot="glass-button-group"
          data-glass-variant={glassVariant}
          className={cn("bg-transparent", className)}
          {...props}>
          {children}
        </ButtonGroup>
      </LiquidGlass>
    );
  }

  return (
    <ButtonGroup
      data-slot="glass-button-group"
      data-glass-variant={glassVariant}
      className={cn("rounded-lg", glassVariantStyles[glassVariant], className)}
      {...props}>
      {children}
    </ButtonGroup>
  );
}

export { GlassButtonGroup };
