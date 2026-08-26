import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LiquidGlass } from "@/components/ui/glasscn/liquid-glass";
import { cn } from "@/lib/utils";

function isItemActive(item, pathname) {

  return item.id === "home"
    ? pathname === "/" || pathname.startsWith("/artist/")
    : pathname === item.path;
}

function NavButtonDesktop({ item, navigate, isActive }) {
  return (
    <div className="relative group">
      {isActive ? (
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


      <span className="absolute left-full ml-3 px-2.5 py-1 bg-gray-900/90 text-white text-xs font-medium rounded-md opacity-0 pointer-events-none transition-opacity duration-200 group-hover:opacity-100 whitespace-nowrap shadow-lg border border-white/10">
        {item.title}
      </span>
    </div>
  );
}

function NavButtonMobile({ item, navigate, isActive }) {
  return (
    <button
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
}

export default function NavButton({ item, variant = "mobile" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = isItemActive(item, location.pathname);

  return variant === "desktop" ? (
    <NavButtonDesktop item={item} navigate={navigate} isActive={isActive} />
  ) : (
    <NavButtonMobile item={item} navigate={navigate} isActive={isActive} />
  );
}