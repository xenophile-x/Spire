import React from "react";
import { useAuth } from "@/context/AuthContext";
import { GoogleIcon } from "@/assets/icons";
import { GlassButton } from "@/components/ui/glasscn/glass-button";

export default function PublicHome({ onEnterExperience }) {
  const { signInWithGoogle } = useAuth();

  return (
    <div className="min-h-screen w-full bg-black text-white flex flex-col">
      {/* Centered content — matches your screenshot: pure black, centered logo + title + description */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        {/* Logo — circular like screenshot, with subtle glow to echo the concentric rings */}
        <div className="relative mb-6">
          <div className="absolute inset-0 blur-2xl opacity-20 bg-white rounded-full scale-110" />
          <img
            src="/spire.png"
            alt="Spire logo"
            className="relative h-20 w-20 md:h-24 md:w-24 rounded-full object-cover bg-white/5 border border-white/10 shadow-2xl"
          />
        </div>

        <h1 className="text-[2.5rem] font-semibold tracking-tight text-white">
          Spire
        </h1>

        <p className="mt-4 max-w-[560px] text-[14px] leading-[1.7] text-white/65">
          Spire is a personal cloud music player. It keeps your entire music library in your own
          Google Drive — upload your songs once and stream them anywhere. Build playlists, follow
          synced lyrics, record karaoke, explore radio stations, and share your library with friends.
        </p>

        {/* Actions — primary: Sign in, secondary: Enter experience (skips sign-in, shows Landing) */}
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <GlassButton
            onClick={signInWithGoogle}
            glassVariant="liquid-refract"
            className="flex items-center justify-center gap-3 rounded-full bg-white/10 px-8 py-4 text-sm font-medium text-white backdrop-blur-md"
          >
            <GoogleIcon className="h-5 w-5" />
            Continue with Google
          </GlassButton>

          {onEnterExperience && (
            <button
              onClick={onEnterExperience}
              className="rounded-full border border-white/15 bg-white/[0.04] px-8 py-4 text-sm font-medium text-white/80 backdrop-blur-sm transition-colors hover:bg-white/10 hover:text-white"
            >
              Enter the experience
            </button>
          )}
        </div>

        <p className="mt-4 text-xs text-white/35">
          Free · Your files stay in your Google Drive · No storage limits
        </p>
      </main>

      <footer className="flex items-center justify-center gap-3 py-6 text-xs text-white/30">
        <a href="/privacypolicy" className="transition-colors hover:text-white/70">
          Privacy Policy
        </a>
        <span aria-hidden="true">·</span>
        <a href="/termsofservice" className="transition-colors hover:text-white/70">
          Terms of Service
        </a>
      </footer>
    </div>
  );
}
