import React, { useState, useEffect, useRef } from "react";
import "material-symbols/rounded.css";
import { LiquidGlass } from "@/components/ui/glasscn/liquid-glass";
import { GlassIcon } from "@/components/ui/glasscn/glass-icon";
import { cn } from "@/lib/utils";

export default function GlassSearchBar({
  onSearch = () => {},
  onBack,
  onForward,
  canGoBack = true,
  canGoForward = true,
  onThemeToggle,
}) {
  const [query, setQuery] = useState("");
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const handleChange = (e) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearch(value);
    }, 150);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setQuery("");
    onSearch("");
  };

  return (
    <header className="w-full max-w-2xl mx-auto p-1 select-none font-sans relative" ref={searchRef}>
      <LiquidGlass
        blur={12}
        refraction={14}
        saturation={1.45}
        className="flex h-16 items-center justify-between gap-3 rounded-full px-4 border border-white/20 glass-rim-bright"
      >
        <div className="flex items-center gap-2.5 shrink-0">
          <GlassIcon
            size="sm"
            onClick={onBack || (() => window.history.back())}
            disabled={!canGoBack}
            aria-label="Go back"
            className={cn(
              "text-white rounded-full flex items-center justify-center p-0 h-10 w-10 border border-white/10 hover:border-white/20 active:scale-95 transition-all",
              !canGoBack && "opacity-30 cursor-not-allowed border-none"
            )}
            liquidProps={{ blur: 2, refraction: 2, saturation: 1 }}
          >
            <span className="material-symbols-rounded text-lg leading-none">undo</span>
          </GlassIcon>

          <GlassIcon
            size="sm"
            onClick={onForward || (() => window.history.forward())}
            disabled={!canGoForward}
            aria-label="Go forward"
            className={cn(
              "text-white rounded-full flex items-center justify-center p-0 h-10 w-10 border border-white/10 hover:border-white/20 active:scale-95 transition-all",
              !canGoForward && "opacity-30 cursor-not-allowed border-none"
            )}
            liquidProps={{ blur: 2, refraction: 2, saturation: 1 }}
          >
            <span className="material-symbols-rounded text-lg leading-none">redo</span>
          </GlassIcon>
        </div>
        <LiquidGlass
          blur={4}
          refraction={6}
          saturation={1.2}
          variant="liquid"
          className="relative flex h-10 max-w-lg flex-1 items-center justify-between overflow-hidden rounded-full px-3.5 border border-white/10 shadow-inner [--liquid-glass-rim-width:0.5px]"
        >
          <div className="flex w-full items-center gap-2">
            <span className="material-symbols-rounded shrink-0 text-sm text-white/30">
              search
            </span>

            <input
              type="text"
              value={query}
              onChange={handleChange}
              className="w-full bg-transparent text-sm font-medium tracking-wide text-white placeholder-white/50 focus:outline-none border-0 shadow-none focus-visible:ring-0 p-0"
              placeholder="Search by title, artist..."
            />
          </div>

          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="shrink-0 cursor-pointer rounded-full p-1 text-white/30 transition-all hover:bg-white/10 hover:text-white ml-2 flex items-center justify-center"
            >
              <span className="material-symbols-rounded block text-sm leading-none">close</span>
            </button>
          )}
        </LiquidGlass>

        <GlassIcon
          size="sm"
          onClick={onThemeToggle}
          aria-label="Toggle theme"
          className="shrink-0 text-white rounded-full flex items-center justify-center p-0 h-10 w-10 border border-white/10 hover:border-white/20 active:scale-95 transition-all"
          liquidProps={{ blur: 2, refraction: 2, saturation: 1 }}
        >
          <span className="material-symbols-rounded text-lg leading-none">light_mode</span>
        </GlassIcon>
      </LiquidGlass>
    </header>
  );
}

