// src/views/SettingsView.jsx
import React, { useRef } from "react";

export default function SettingsView({
  user,
  isUploading,
  onBackgroundUpload,
  onSignOut,
}) {
  const fileInputRef = useRef(null);

  const handleBoxClick = () => {
    fileInputRef.current?.click();
  };

  const userAvatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight text-white">Account & Settings</h2>

      <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 flex items-center gap-4">
        {userAvatar ? (
          <img
            src={userAvatar}
            alt="Google Profile"
            className="w-12 h-12 rounded-full border border-white/20 object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
            <span className="material-symbols-rounded text-2xl text-white">account_circle</span>
          </div>
        )}
        <div>
          <p className="font-semibold text-sm text-white">{user?.user_metadata?.full_name || "Google User"}</p>
          <p className="text-xs text-white/60">{user?.email}</p>
        </div>
      </div>

      <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-6 space-y-4">
        <div>
          <h3 className="font-semibold text-base text-white">App Wallpaper Background</h3>
          <p className="text-xs text-white/60 mt-0.5">
            Choose an image file to instantly update your application wallpaper.
          </p>
        </div>

        <div
          onClick={handleBoxClick}
          className={`
            border-2 border-dashed border-white/25 hover:border-white/60
            rounded-xl p-8 text-center cursor-pointer transition-all bg-white/5 hover:bg-white/10
            flex flex-col items-center justify-center gap-2
            ${isUploading ? "opacity-50 pointer-events-none" : ""}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onBackgroundUpload}
          />

          <span className="material-symbols-rounded text-4xl text-white">
            {isUploading ? "sync" : "wallpaper"}
          </span>

          <p className="text-sm text-white font-medium">
            {isUploading ? "Updating Wallpaper..." : "Click to Select Wallpaper Image"}
          </p>
        </div>
      </div>

      <button
        onClick={onSignOut}
        className="px-6 py-2.5 bg-white/10 hover:bg-white text-white hover:text-black border border-white/20 font-semibold text-xs rounded-xl transition-all duration-200 cursor-pointer shadow-lg"
      >
        Log Out
      </button>
    </div>
  );
}