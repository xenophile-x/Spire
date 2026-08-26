import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LibraryProvider } from "@/context/LibraryContext";
import { PlayerProvider } from "@/context/PlayerContext";
import AppLayout from "@/components/AppLayout";
import Opening from "@/components/Opening";
import Landing from "@/components/Landing";
import OfflineIndicator from "@/components/OfflineIndicator";
import TermsView from "@/views/TermsView";
import PrivacyView from "@/views/PrivacyView";
import SharedLibraryView from "@/views/SharedLibraryView";
import { GoogleIcon } from "@/assets/icons";
import { getOptimizedUnsplashUrl } from "@/utils/imageUtils";
import { GlassButton } from "@/components/ui/glasscn/glass-button";
import { LiquidGlass } from "@/components/ui/glasscn/liquid-glass";
import "material-symbols/rounded.css";

const DEFAULT_BG_IMAGE =
  "https://images.unsplash.com/photo-1778789172863-a137613623e0?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

const LOCAL_BG_VIDEO = "/wallpapers/x-136641_medium.mp4";
const FALLBACK_BG_VIDEO =
  "https://videos.pexels.com/video-files/9714261/9714261-uhd_3840_2160_30fps.mp4";
const DEFAULT_BG_POSTER = getOptimizedUnsplashUrl(DEFAULT_BG_IMAGE, { width: 1280 });

const SHARE_ROUTE_RE = /^\/share\/[^/]+$/;

function AppContent({ onBackToLanding }) {
  const { user, loading, signInWithGoogle } = useAuth();
  const location = useLocation();

  const [loginVideoSrc, setLoginVideoSrc] = React.useState(LOCAL_BG_VIDEO);

  const handleLoginVideoError = () => {
    setLoginVideoSrc((src) => {
      if (src === LOCAL_BG_VIDEO) return FALLBACK_BG_VIDEO;
      return src;
    });
  };

  const isLegalRoute =
    location.pathname === "/privacypolicy" ||
    location.pathname === "/termsofservice";
  if (isLegalRoute) {
    return location.pathname === "/termsofservice" ? (
      <TermsView />
    ) : (
      <PrivacyView />
    );
  }

  if (SHARE_ROUTE_RE.test(location.pathname)) {
    return <SharedLibraryView />;
  }

  if (loading) {
    return (
      <div className="h-screen w-screen bg-black text-white flex items-center justify-center">
        <div className="text-sm text-white/70">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative h-screen w-screen overflow-hidden text-white flex flex-col items-center justify-center p-4 select-none">
        <video
          key={loginVideoSrc}
          src={loginVideoSrc}
          onError={handleLoginVideoError}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          disableRemotePlayback
          poster={DEFAULT_BG_POSTER}
          className="absolute inset-0 w-full h-full object-cover -z-20 scale-105 transform transition-transform duration-1000"
        />

        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/20 via-transparent to-black/30 backdrop-brightness-90" />

        {onBackToLanding && (
          <LiquidGlass
            blur={10}
            refraction={18}
            saturation={1.6}
            onClick={onBackToLanding}
            className="absolute left-6 top-6 z-20 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white/15 border border-white/30 [--liquid-glass-rim-light:rgba(255,255,255,0.7)] transition-all hover:bg-white/25 hover:scale-105 shadow-lg shadow-black/10"
            aria-label="Back to landing"
          >
            <span className="material-symbols-rounded text-lg text-white pl-1 opacity-90">
              arrow_back_ios
            </span>
          </LiquidGlass>
        )}

        <div className="z-10 flex flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-4">
            <img
              src="/spire.png"
              alt="spire logo"
              className="w-20 h-20 opacity-90 md:w-24 md:h-24 drop-shadow-2xl"
            />
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-wide drop-shadow-lg">
              Welcome Back !
            </h1>
          </div>

          <div className="transition-transform duration-300 hover:scale-105 active:scale-95">
            <GlassButton
              onClick={signInWithGoogle}
              glassVariant="liquid-refract"
              className="flex items-center justify-center gap-3 rounded-full bg-transparent px-8 py-5 text-sm font-medium text-white backdrop-blur-md md:text-base"
            >
              <GoogleIcon className="w-5 h-5" />
              Continue with Google
            </GlassButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <LibraryProvider>
      <PlayerProvider>
        <AppLayout />
      </PlayerProvider>
    </LibraryProvider>
  );
}

export default function App() {
  const location = useLocation();
  const [currentScreen, setCurrentScreen] = useState(() => {
    if (SHARE_ROUTE_RE.test(window.location.pathname)) return "app";
    return sessionStorage.getItem("spire_screen") || "opening";
  });

  const handleScreenChange = (screen) => {
    sessionStorage.setItem("spire_screen", screen);
    setCurrentScreen(screen);
  };

  if (SHARE_ROUTE_RE.test(location.pathname)) {
    return (
      <>
        <OfflineIndicator />
        <SharedLibraryView />
      </>
    );
  }

  if (currentScreen === "opening") {
    return (
      <>
        <OfflineIndicator />
        <Opening onComplete={() => handleScreenChange("landing")} />
      </>
    );
  }

  if (currentScreen === "landing") {
    return (
      <>
        <OfflineIndicator />
        <Landing onLaunchSpire={() => handleScreenChange("app")} />
      </>
    );
  }

  return (
    <>
      <OfflineIndicator />
      <AppContent onBackToLanding={() => handleScreenChange("landing")} />
    </>
  );
}
