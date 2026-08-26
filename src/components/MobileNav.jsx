import React from "react";
import "material-symbols/rounded.css";
import { LiquidGlass } from "@/components/ui/glasscn/liquid-glass";
import { NAV_ITEMS } from "@/constants/navigation";
import NavButton from "@/components/NavButton";

export default function MobileNav() {
  return (
    <div className="mb-1.5 flex w-full justify-center md:hidden">
      <LiquidGlass
        blur={12}
        refraction={12}
        saturation={1.35}
        className="flex items-center gap-1 rounded-full p-1.5 shadow-2xl glass-rim-default"
      >
        {NAV_ITEMS.map((item) => (
          <NavButton key={item.id} item={item} variant="mobile" />
        ))}
      </LiquidGlass>
    </div>
  );
}