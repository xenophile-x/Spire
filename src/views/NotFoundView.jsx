import React from "react";
import { useNavigate } from "react-router-dom";
import { LiquidGlass } from "@/components/ui/glasscn/liquid-glass";

export default function NotFoundView() {
  const navigate = useNavigate();

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-5 text-center">
      <span className="material-symbols-rounded text-7xl text-white/30">music_off</span>
      <div>
        <h1 className="text-5xl font-black tracking-tighter text-white">404</h1>
        <p className="mt-2 text-sm font-medium text-white/60">
          This page doesn't exist — the song you're looking for isn't here.
        </p>
      </div>
      <LiquidGlass
        blur={8}
        refraction={10}
        onClick={() => navigate("/")}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            navigate("/");
          }
        }}
        className="flex cursor-pointer items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold text-white transition-opacity hover:opacity-90 [--liquid-glass-rim-width:0.5px]"
      >
        <span className="material-symbols-rounded text-base">home</span>
        Back to Home
      </LiquidGlass>
    </div>
  );
}