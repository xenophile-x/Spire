import React, { useEffect, useState } from "react";

export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black text-white flex flex-col items-center justify-center gap-2 select-none">
      <span className="text-xl font-semibold tracking-wide">You are offline</span>
      <span className="text-sm text-white/60 font-light">
        Reconnect to continue using Spire
      </span>
    </div>
  );
}
