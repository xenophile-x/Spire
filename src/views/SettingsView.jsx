import React, { useRef, useState, useEffect } from "react";
import { GlassCard } from "@/components/ui/glasscn/glass-card";
import { LiquidGlass } from "@/components/ui/glasscn/liquid-glass";
import PrivacyPolicyModal from "@/components/PrivacyPolicyModal";
import "material-symbols/rounded.css";

export default function SettingsView({
  user,
  isUploading,
  onBackgroundUpload,
  onSignOut,
}) {
  const fileInputRef = useRef(null);
  const [showPrivacy, setShowPrivacy] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  const handleBoxClick = () => {
    fileInputRef.current?.click();
  };

  const userAvatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const userName = user?.user_metadata?.full_name || "Danny Rico";
  const userEmail = user?.email || "daniel_rico1@icloud.com";

  return (
    <>
      <div className="mx-auto h-full max-h-full max-w-md flex flex-col justify-between p-4 font-sans text-white overflow-hidden select-none">
        <div className="flex items-center justify-center gap-2 pt-1">
          <h1 className="text-lg font-bold tracking-wide text-white/90">Personal Info</h1>
          <LiquidGlass
            blur={4}
            refraction={4}
            className="rounded-full px-2 py-0.5 [--liquid-glass-rim-width:0.5px]"
          >
            <span className="text-[10px] font-semibold tracking-wider text-white/90">v1.0.0</span>
          </LiquidGlass>
        </div>

        <GlassCard
          glassVariant="liquid-refract"
          liquidProps={{
            blur: 14,
            refraction: 15,
            className: "rounded-3xl [--liquid-glass-rim-light:rgba(255,255,255,0.4)]",
          }}
          className="gap-0 overflow-hidden py-0 my-auto"
        >
          <div className="flex flex-col items-center justify-center px-4 pt-6 pb-4">
            <LiquidGlass
              blur={8}
              refraction={10}
              className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full [--liquid-glass-rim-light:rgba(255,255,255,0.45)]"
            >
              {userAvatar ? (
                <img
                  src={userAvatar}
                  alt={userName}
                  className="h-full w-full scale-105 object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-white/10 to-black/30">
                  <span className="material-symbols-rounded text-6xl text-white/80">account_circle</span>
                </div>
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            </LiquidGlass>

            <h2 className="mt-3 text-lg font-semibold tracking-tight text-white">{userName}</h2>
            <p className="text-xs font-medium text-white/60">{userEmail}</p>
          </div>

          <div className="divide-y divide-white/10 border-t border-white/10">
            <button
              type="button"
              onClick={handleBoxClick}
              disabled={isUploading}
              className="group flex w-full cursor-pointer items-center justify-between px-5 py-3 text-left transition-all hover:bg-white/10 active:bg-white/15 disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <span className={`material-symbols-rounded text-lg text-white/80 group-hover:text-white ${isUploading ? 'animate-spin' : ''}`}>
                  {isUploading ? "sync" : "wallpaper"}
                </span>
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-white/90 group-hover:text-white">
                    Change Wallpaper
                  </span>
                  <span className="text-[10px] text-white/50">
                    {isUploading ? "Uploading image..." : "Upload custom background"}
                  </span>
                </div>
              </div>
              <span className="material-symbols-rounded text-base text-white/40 group-hover:text-white/70">
                chevron_right
              </span>
            </button>

            <button
              type="button"
              onClick={onSignOut}
              className="group flex w-full cursor-pointer items-center justify-between px-5 py-3 text-left text-xs font-medium text-red-500 transition-all hover:bg-white/10 "
            >
              <span>Sign Out</span>
              <span className="material-symbols-rounded text-base text-red-400">logout</span>
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onBackgroundUpload}
          />
        </GlassCard>

        <button 
          type="button"
          onClick={() => setShowPrivacy(true)}
          className="flex w-full items-center justify-center py-1 cursor-pointer transition-opacity hover:opacity-80 focus:outline-none"
        >
          <p className="text-[11px] font-medium text-cyan-200 text-center">
            Privacy Policy &amp; Terms of Service
          </p>
        </button>
      </div>

      <PrivacyPolicyModal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} />
    </>
  );
}