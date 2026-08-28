import React, { useEffect, useState, useCallback } from "react";

export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);

  const goOnline = useCallback(() => {
    setIsOffline(false);
    setShowReconnected(true);
    // Trigger a global event so data layers can retry
    window.dispatchEvent(new CustomEvent("spire:online"));
    setTimeout(() => setShowReconnected(false), 2500);
  }, []);

  const goOffline = useCallback(() => {
    setIsOffline(true);
    setShowReconnected(false);
  }, []);

  useEffect(() => {
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [goOnline, goOffline]);

  if (!isOffline && !showReconnected) return null;

  const isReconnect = showReconnected && !isOffline;

  return (
    <div
      className={`fixed left-1/2 top-3 z-[9999] flex -translate-x-1/2 items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium shadow-lg backdrop-blur-xl transition-all select-none ${
        isReconnect
          ? "border-emerald-400/30 bg-emerald-500/20 text-emerald-100"
          : "border-amber-400/20 bg-amber-500/15 text-amber-100"
      }`}
      role="status"
      aria-live="polite"
    >
      <span
        className={`h-2 w-2 rounded-full ${isReconnect ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`}
        aria-hidden="true"
      />
      <span>{isReconnect ? "Back online — syncing…" : "You’re offline — retrying automatically"}</span>
    </div>
  );
}
