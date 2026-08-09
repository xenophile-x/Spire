"use client";;
import { glassVariantStyles } from "@/lib/glass-variants";
import { cn } from "@/lib/utils";

import { RadioGroupItem } from "../radio-group";

function GlassRadioGroupItem({
  className,
  glassVariant = "liquid-refract",
  ...props
}) {
  const effectiveVariant = glassVariant === "liquid-refract" ? "subtle" : glassVariant;

  return (
    <RadioGroupItem
      data-slot="glass-radio-group-item"
      data-glass-variant={glassVariant}
      className={cn(glassVariantStyles[effectiveVariant], className)}
      {...props} />
  );
}

export { GlassRadioGroupItem };
