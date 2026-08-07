import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "material-symbols/rounded.css";
import { LiquidGlass } from "@/components/ui/glasscn/liquid-glass";
import { cn } from "@/lib/utils";

const navItems = [
  { id: "home",     title: "Home",     icon: "home",         path: "/" },
  { id: "explore",  title: "Explore",  icon: "explore",      path: "/explore" },
  { id: "album",    title: "Album",    icon: "home_storage", path: "/playlists" },
  { id: "settings", title: "Settings", icon: "settings",     path: "/settings" },
];

export default function FloatingBar() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <aside className="fixed left-4 top-1/2 -translate-y-1/2 z-40 hidden md:flex flex-col items-center">
      <LiquidGlass
        blur={10}
        refraction={12}
        saturation={1.35}
        className="flex flex-col items-center gap-1.5 rounded-full p-2 shadow-2xl [--liquid-glass-rim-light:rgba(255,255,255,0.5)] [--liquid-glass-rim-width:1px]"
      >
        <nav className="flex flex-col gap-1.5 items-center">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;

            return (
              <div key={item.id} className="relative group">
                {isActive ? (
                  /* Active: full LiquidGlass bubble with bright rim */
                  <LiquidGlass
                    blur={8}
                    refraction={12}
                    saturation={1.5}
                    className="rounded-full [--liquid-glass-rim-light:rgba(255,255,255,0.75)] [--liquid-glass-rim-width:1.5px] [--liquid-glass-rim-fade:10%] shadow-[0_4px_20px_rgba(255,255,255,0.15)]"
                  >
                    <button
                      type="button"
                      onClick={() => navigate(item.path)}
                      aria-label={item.title}
                      className="flex h-11 w-11 items-center justify-center rounded-full text-white focus:outline-none"
                    >
                      <span
                        className="material-symbols-rounded text-[26px] select-none pointer-events-none"
                        style={{ fontVariationSettings: "'FILL' 1, 'wght' 700, 'GRAD' 0, 'opsz' 24" }}
                      >
                        {item.icon}
                      </span>
                    </button>
                  </LiquidGlass>
                ) : (
                  /* Inactive: plain button, no glass bubble, hover brightens */
                  <button
                    type="button"
                    onClick={() => navigate(item.path)}
                    aria-label={item.title}
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-full",
                      "text-white/50 hover:text-white/90 transition-all duration-200",
                      "hover:bg-white/10 active:scale-95 focus:outline-none"
                    )}
                  >
                    <span
                      className="material-symbols-rounded text-[24px] select-none pointer-events-none transition-transform duration-200 group-hover:scale-110"
                      style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
                    >
                      {item.icon}
                    </span>
                  </button>
                )}

                {/* Tooltip */}
                <span className="absolute left-full ml-3 px-2.5 py-1 bg-gray-900/90 text-white text-xs font-medium rounded-md opacity-0 pointer-events-none transition-opacity duration-200 group-hover:opacity-100 whitespace-nowrap shadow-lg border border-white/10">
                  {item.title}
                </span>
              </div>
            );
          })}
        </nav>
      </LiquidGlass>
    </aside>
  );
}
