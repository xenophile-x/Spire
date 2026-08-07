import React from "react";
import { GlassCard } from "@/components/ui/glasscn/glass-card";
import { cn } from "@/lib/utils";

export default function TemperedGlassCard({
  children,
  className = "",
  liquidProps,
  ...props
}) {
  return (
    <GlassCard
      glassVariant="liquid-refract"
      liquidProps={{
        blur: 12,
        refraction: 15,
        saturation: 1.4,
        bezel: 0.34,
        className: cn(
          "rounded-3xl text-white [--liquid-glass-rim-light:rgba(255,255,255,0.45)] [--liquid-glass-rim-width:1px]",
          liquidProps?.className
        ),
        ...liquidProps,
      }}
      className={cn(
        "flex flex-col min-h-0 gap-0 py-0 bg-transparent border-0 shadow-none ring-0 overflow-hidden text-white",
        className
      )}
      {...props}
    >
      <div className="relative z-10 flex-1 min-h-0 flex flex-col">{children}</div>
    </GlassCard>
  );
}
