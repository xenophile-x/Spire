import React, { useState, useEffect, useRef } from "react";
import "material-symbols/rounded.css";
import { LiquidGlass } from "@/components/ui/glasscn/liquid-glass";
import { GlassIcon } from "@/components/ui/glasscn/glass-icon";
import { cn } from "@/lib/utils";
import { useGlassVariant } from "@/context/GlassVariantContext";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

const VARIANT_LABELS = {
  clear: "Clear",
  frosted: "Frosted",
  subtle: "Subtle",
  liquid: "Liquid",
  "liquid-refract": "Liquid Refract",
};

const VARIANT_DESCRIPTIONS = {
  clear: "Minimal blur, subtle transparency",
  frosted: "Heavy blur, high opacity",
  subtle: "Light blur, very transparent",
  liquid: "Animated gradients, dynamic rim",
  "liquid-refract": "Refractive glass, subtle depth",
};

export default function GlassSearchBar({
  onSearch = () => {},
  onBack,
  onForward,
  canGoBack = true,
  canGoForward = true,
  onThemeToggle,
}) {
  const {
    isNightMode,
    toggleNightMode,
    primaryVariant,
    secondaryVariant,
    setPrimary,
    setSecondary,
    availableVariants,
  } = useGlassVariant();

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

  const handleVariantSelect = (variant, isPrimary) => {
    if (isPrimary) setPrimary(variant);
    else setSecondary(variant);
  };

  const renderVariantOptions = (isPrimary) => (
    <>
      <DropdownMenuLabel className="text-white/70 px-2 py-1 text-xs font-medium uppercase tracking-wide">
        {isPrimary ? "Primary Style" : "Secondary Style"}
      </DropdownMenuLabel>
      <DropdownMenuSeparator className="border-white/10" />
      {availableVariants.map((variant) => (
        <DropdownMenuItem
          key={variant}
          onSelect={() => handleVariantSelect(variant, isPrimary)}
          className={cn(
            "flex items-center gap-2 text-white",
            (isPrimary ? primaryVariant : secondaryVariant) === variant &&
              "bg-white/10"
          )}
        >
          <span className="flex items-center gap-2">
            <span className="font-medium">{VARIANT_LABELS[variant]}</span>
            <span className="text-white/40 text-xs hidden sm:block">
              {VARIANT_DESCRIPTIONS[variant]}
            </span>
          </span>
          {(isPrimary ? primaryVariant : secondaryVariant) === variant && (
            <span className="material-symbols-rounded text-green-400 text-sm">check</span>
          )}
        </DropdownMenuItem>
      ))}
    </>
  );

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

        <div className="flex items-center gap-1.5 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <GlassIcon
                size="sm"
                aria-label="Glass style options"
                className="text-white rounded-full flex items-center justify-center p-0 h-10 w-10 border border-white/10 hover:border-white/20 active:scale-95 transition-all"
                liquidProps={{ blur: 2, refraction: 2, saturation: 1 }}
              >
                <span className="material-symbols-rounded text-lg leading-none">tune</span>
              </GlassIcon>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={4}
              className="w-64 p-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl"
            >
              <div className="space-y-2">
                {renderVariantOptions(true)}
                <DropdownMenuSeparator className="border-white/10 my-1" />
                {renderVariantOptions(false)}
                <DropdownMenuSeparator className="border-white/10 my-1" />
                <DropdownMenuItem
                  onSelect={toggleNightMode}
                  className="flex items-center gap-2 text-white"
                >
                  <span className="material-symbols-rounded text-lg">
                    {isNightMode ? "dark_mode" : "light_mode"}
                  </span>
                  <span className="flex-1">
                    <span className="font-medium">{isNightMode ? "Day Mode" : "Night Mode"}</span>
                    <span className="block text-white/40 text-xs">
                      {isNightMode
                        ? "Switch to liquid primary style"
                        : "Switch to frosted primary style"}
                    </span>
                  </span>
                  <span className="material-symbols-rounded text-green-400 text-sm">check</span>
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <GlassIcon
            size="sm"
            onClick={onThemeToggle}
            aria-label="Toggle theme"
            className="shrink-0 text-white rounded-full flex items-center justify-center p-0 h-10 w-10 border border-white/10 hover:border-white/20 active:scale-95 transition-all"
            liquidProps={{ blur: 2, refraction: 2, saturation: 1 }}
          >
            <span className="material-symbols-rounded text-lg leading-none">
              {isNightMode ? "wb_sunny" : "dark_mode"}
            </span>
          </GlassIcon>
        </div>
      </LiquidGlass>
    </header>
  );
}