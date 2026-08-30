import React from "react";
import { GoogleIcon } from "@/assets/icons";
import { useAuth } from "@/context/AuthContext";

export default function PublicHome({ onEnterExperience }) {
  const { signInWithGoogle } = useAuth();

  return (
    <div className="min-h-screen w-full bg-black text-white flex flex-col">
      {/* Centered hero — exact to your screenshot: pure black, centered */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 blur-2xl opacity-20 bg-white rounded-full scale-110" />
          <img
            src="/spire.png"
            alt="Spire logo"
            className="relative h-20 w-20 md:h-24 md:w-24 rounded-full object-cover bg-white/5 border border-white/10 shadow-2xl"
          />
        </div>

        <h1 className="text-[2.5rem] font-semibold tracking-tight text-white">Spire</h1>

        <p className="mt-4 max-w-[560px] text-[14px] leading-[1.7] text-white/65">
          Spire is a personal cloud music player. It keeps your entire music library in your own
          Google Drive — upload your songs once and stream them anywhere. Build playlists, follow
          synced lyrics, record karaoke, explore radio stations, and share your library with friends.
        </p>

        {/* Primary CTA: Enter the experience */}
        <div className="mt-8 flex flex-col items-center gap-4">
          {onEnterExperience && (
            <button
              onClick={onEnterExperience}
              className="rounded-full bg-white px-10 py-4 text-sm font-semibold text-black transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-[0_8px_30px_rgba(255,255,255,0.15)]"
            >
              Enter the experience
            </button>
          )}
          {/* Secondary CTA: Continue with Google - prominent button */}
          <button
            onClick={signInWithGoogle}
            className="w-full max-w-xs rounded-full bg-white/10 backdrop-blur-md border border-white/20 px-8 py-3 text-sm font-medium text-white hover:bg-white/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <GoogleIcon className="h-5 w-5" />
            Continue with Google
          </button>
        </div>

        <p className="mt-4 text-xs text-white/35">Free · Your files stay in your Google Drive</p>
      </main>

      <footer className="flex items-center justify-center gap-3 py-6 text-xs text-white/30">
        <a href="/privacypolicy" className="transition-colors hover:text-white/70">Privacy Policy</a>
        <span aria-hidden="true">·</span>
        <a href="/termsofservice" className="transition-colors hover:text-white/70">Terms of Service</a>
      </footer>
    </div>
  );
}
