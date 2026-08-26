
import React from "react";
import { getOptimizedUnsplashUrl } from "@/utils/imageUtils";

export default function EnhancedBackground({ imageUrl }) {

  const enhancedUrl = getOptimizedUnsplashUrl(imageUrl, {
    width: 2560,
    quality: 85,
    saturation: 15,
    contrast: 10,
    brightness: -5,
  });

  return (
    <div className="fixed inset-0 -z-50 overflow-hidden bg-black select-none">

      <div
        className="absolute inset-0 bg-cover bg-center duration-1000 scale-105"
        style={{ backgroundImage: `url("${enhancedUrl}")` }}
      />


      <div className="absolute inset-0 bg-radial from-transparent via-black/20 to-black/60 pointer-events-none" />


      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/40 pointer-events-none" />
    </div>
  );
}
