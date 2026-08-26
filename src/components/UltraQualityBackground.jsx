import React, { useState, useEffect } from "react";
import { getUltraQualityUnsplashUrl } from "@/utils/imageUtils";

export default function UltraQualityBackground({ imageUrl }) {
  const [loadedUrl, setLoadedUrl] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!imageUrl) return;

    let cancelled = false;
    const ultraUrl = getUltraQualityUnsplashUrl(imageUrl);
    setIsReady(false);

    const img = new Image();
    img.decoding = "async";
    img.src = ultraUrl;
    img.onload = () => {
      if (cancelled) return;
      setLoadedUrl(ultraUrl);
      setIsReady(true);
    };
    img.onerror = () => {
      if (cancelled) return;
      setLoadedUrl(imageUrl);
      setIsReady(true);
    };

    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [imageUrl]);

  return (
    <div className="fixed inset-0 -z-50 overflow-hidden bg-black select-none">
      {loadedUrl && (
        <div
          className={`absolute inset-0 bg-cover bg-center transition-opacity duration-700 ease-out ${
            isReady ? "opacity-100 scale-100" : "opacity-0 scale-105"
          }`}
          style={{
            backgroundImage: `url("${loadedUrl}")`,
            imageRendering: "high-quality",
          }}
        />
      )}

      <div className="absolute inset-0 bg-black/15 pointer-events-none" />
    </div>
  );
}
