import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "material-symbols/rounded.css";
import { LiquidGlass } from "@/components/ui/glasscn/liquid-glass";
import { cn } from "@/lib/utils";

const navItems = [
  { id: "home", title: "Home", icon: "home", path: "/" },
  { id: "explore", title: "Explore", icon: "explore", path: "/explore" },
  { id: "album", title: "Playlists", icon: "home_storage", path: "/playlists" },
  { id: "settings", title: "Settings", icon: "settings", path: "/settings" },
];

export default function MobileNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="mb-1.5 flex w-full justify-center md:hidden">
      <LiquidGlass
        blur={12}
        refraction={12}
        saturation={1.35}
        className="flex items-center gap-1 rounded-full p-1.5 shadow-2xl [--liquid-glass-rim-light:rgba(255,255,255,0.5)] [--liquid-glass-rim-width:1px]"
      >
        {navItems.map((item) => {
          // Artist pages are reached from Home, so Home stays selected there.
          const isActive =
            item.id === "home"
              ? location.pathname === "/" || location.pathname.startsWith("/artist/")
              : location.pathname === item.path;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.path)}
              aria-label={item.title}
              className={cn(
                "flex h-10 w-14 flex-col items-center justify-center gap-0.5 rounded-full transition-all duration-200 active:scale-95 focus:outline-none",
                isActive ? "text-white" : "text-white/50 hover:text-white/90"
              )}
            >
              <span
                className="material-symbols-rounded text-[22px] leading-none select-none"
                style={{ fontVariationSettings: `'FILL' ${isActive ? 1 : 0}, 'wght' ${isActive ? 700 : 400}, 'GRAD' 0, 'opsz' 24` }}
              >
                {item.icon}
              </span>
              <span className="text-[8px] font-semibold uppercase tracking-wider leading-none">
                {item.title}
              </span>
            </button>
          );
        })}
      </LiquidGlass>
    </div>
  );
}