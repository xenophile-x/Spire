import React, { useEffect, useRef, useState } from "react";
import { isVideoUrl } from "@/utils/imageUtils";
import { cn } from "@/lib/utils";

function MediaLayer({ url, isVideo, className, onLoad, onError }) {
  if (!url) return null;

  if (isVideo) {
    return (
      <video
        key={url}
        src={url}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        controls={false}
        controlsList="nodownload noplaybackrate noremoteplayback nofullscreen"
        disablePictureInPicture
        disableRemotePlayback
        onLoadedData={onLoad}
        onCanPlay={onLoad}
        onPlaying={onLoad}
        onError={onError}
        className={cn("absolute inset-0 h-full w-full object-cover", className)}
      />
    );
  }

  return (
    <div
      className={cn("absolute inset-0 bg-cover bg-center bg-no-repeat", className)}
      style={{ backgroundImage: `url("${url}")` }}
    >
      <img
        src={url}
        alt=""
        className="hidden"
        onLoad={onLoad}
        onError={onError}
      />
    </div>
  );
}

const FADE_MS = 600;

export default function BackgroundManager({ targetBgUrl, preloadUrl }) {
  const [currentBg, setCurrentBg] = useState(targetBgUrl);
  const [prevBg, setPrevBg] = useState(null);
  const [isFading, setIsFading] = useState(false);

  const swapTokenRef = useRef(0);
  const currentBgRef = useRef(targetBgUrl);
  currentBgRef.current = currentBg;

  useEffect(() => {
    if (targetBgUrl === currentBgRef.current) return;

    const token = ++swapTokenRef.current;
    setPrevBg(currentBgRef.current);
    setCurrentBg(targetBgUrl);
    setIsFading(true);

    const fadeTimer = setTimeout(() => {
      if (token === swapTokenRef.current) {
        setIsFading(false);
        setPrevBg(null);
      }
    }, FADE_MS);

    return () => clearTimeout(fadeTimer);
  }, [targetBgUrl]);

  const currentIsVideo = isVideoUrl(currentBg);
  const prevIsVideo = isVideoUrl(prevBg);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-black select-none pointer-events-none">
      {/* Previous background during transition */}
      {prevBg && (
        <MediaLayer
          url={prevBg}
          isVideo={prevIsVideo}
          className="pointer-events-none z-0"
        />
      )}

      {/* Current background */}
      <MediaLayer
        url={currentBg}
        isVideo={currentIsVideo}
        className={cn(
          "pointer-events-none z-0 transition-opacity duration-500 ease-in-out",
          isFading && prevBg ? "opacity-90" : "opacity-100"
        )}
      />

      {/* Hidden preloader for next background */}
      {preloadUrl && preloadUrl !== currentBg && preloadUrl !== prevBg && (
        isVideoUrl(preloadUrl) ? (
          <video
            key={preloadUrl}
            src={preloadUrl}
            preload="auto"
            muted
            playsInline
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 h-1 w-1 opacity-0"
          />
        ) : (
          <img
            key={preloadUrl}
            src={preloadUrl}
            alt=""
            className="pointer-events-none absolute left-0 top-0 h-1 w-1 opacity-0"
          />
        )
      )}

      <div className="absolute inset-0 pointer-events-none z-0 bg-black/20" />
    </div>
  );
}
