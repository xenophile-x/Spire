import React from "react";
import { useAuth } from "@/context/AuthContext";
import { GoogleIcon } from "@/assets/icons";
import { GlassButton } from "@/components/ui/glasscn/glass-button";
import { LiquidGlass } from "@/components/ui/glasscn/liquid-glass";

const FEATURES = [
  {
    icon: "cloud_upload",
    title: "Your music, your Drive",
    description:
      "Upload your songs to your own Google Drive and stream them anywhere — no storage limits imposed on you, your files stay yours.",
  },
  {
    icon: "queue_music",
    title: "Playlists",
    description:
      "Organize your library into playlists with beautiful posters and instant access across all your devices.",
  },
  {
    icon: "lyrics",
    title: "Synced lyrics & karaoke",
    description:
      "Follow along with time-synced lyrics, or grab the mic — record karaoke takes right inside the app.",
  },
  {
    icon: "radio",
    title: "Explore radio",
    description:
      "Discover new stations and recommendations tuned to the taste of your own library.",
  },
  {
    icon: "share",
    title: "Share your library",
    description:
      "Publish a read-only link so friends can listen to your curated collection.",
  },
  {
    icon: "offline_bolt",
    title: "Works offline",
    description:
      "Spire detects when you're offline and keeps everything ready the moment you're back.",
  },
];

export default function PublicHome({ onEnterExperience }) {
  const { signInWithGoogle } = useAuth();

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-neutral-950 text-white">
      {/* Ambient backdrop */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-40"
        style={{
          backgroundImage:
            'url("https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=2070&auto=format&fit=crop")',
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-neutral-950/60 via-neutral-950/80 to-neutral-950" />

      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <img src="/spire.png" alt="Spire logo" className="h-10 w-10 rounded-xl" />
          <span className="text-lg font-bold tracking-tight">Spire</span>
        </div>
        <nav className="flex items-center gap-5 text-sm text-white/70">
          <a href="/privacypolicy" className="transition-colors hover:text-white">
            Privacy Policy
          </a>
          <a href="/termsofservice" className="transition-colors hover:text-white">
            Terms of Service
          </a>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col items-center px-6 pb-24">
        <section className="flex flex-col items-center gap-6 pt-16 text-center md:pt-24">
          <h1 className="text-4xl font-black tracking-tighter md:text-6xl">
            Spire
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-white/75 md:text-xl">
            Your personal cloud music player. Spire keeps your entire music
            library in your own Google Drive — upload your songs once, then
            stream them anywhere, build playlists, sing along with synced
            lyrics, and share your collection with friends.
          </p>

          <div className="mt-2 flex flex-col items-center gap-4 sm:flex-row">
            <div className="transition-transform duration-300 hover:scale-105 active:scale-95">
              <GlassButton
                onClick={signInWithGoogle}
                glassVariant="liquid-refract"
                className="flex items-center justify-center gap-3 rounded-full bg-white/10 px-8 py-4 text-sm font-medium text-white backdrop-blur-md md:text-base"
              >
                <GoogleIcon className="h-5 w-5" />
                Sign in with Google
              </GlassButton>
            </div>
            {onEnterExperience && (
              <LiquidGlass
                blur={8}
                refraction={14}
                saturation={1.4}
                onClick={onEnterExperience}
                className="cursor-pointer rounded-full border border-white/20 bg-white/5 px-8 py-4 text-sm font-medium text-white/85 transition-all hover:bg-white/15 hover:text-white md:text-base"
              >
                Enter the experience
              </LiquidGlass>
            )}
          </div>

          <p className="text-xs text-white/40">
            Free to use · Your files stay in your Google Drive · Sign-in is only
            required to upload and stream your own library
          </p>
        </section>

        <section className="mt-20 grid w-full grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm transition-colors hover:border-white/20 hover:bg-white/[0.07]"
            >
              <span className="material-symbols-rounded text-3xl text-white/85">
                {f.icon}
              </span>
              <h2 className="mt-4 text-base font-semibold tracking-tight">
                {f.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-white/65">
                {f.description}
              </p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 px-6 text-xs text-white/45 sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} Spire</span>
          <div className="flex items-center gap-4">
            <a href="/privacypolicy" className="transition-colors hover:text-white/80">
              Privacy Policy
            </a>
            <a href="/termsofservice" className="transition-colors hover:text-white/80">
              Terms of Service
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
