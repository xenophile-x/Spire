import React from "react";
import "material-symbols/rounded.css";
import { LiquidGlass } from "@/components/ui/glasscn/liquid-glass";
import { NAV_ITEMS } from "@/constants/navigation";
import NavButton from "@/components/NavButton";

export default function FloatingBar() {
  return (
    <aside className="fixed left-6 top-1/2 -translate-y-1/2 z-40 hidden md:flex flex-col items-center">
      <LiquidGlass
        blur={10}
        refraction={12}
        saturation={1.35}
        className="flex flex-col items-center gap-1.5 rounded-full p-2 shadow-2xl glass-rim-default"
      >
        <nav className="flex flex-col gap-1.5 items-center">
          {NAV_ITEMS.map((item) => (
            <NavButton key={item.id} item={item} variant="desktop" />
          ))}
        </nav>
      </LiquidGlass>
    </aside>
  );
}