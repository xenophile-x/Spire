import React, { useEffect, useRef, useState } from "react";
import { isVideoUrl } from "@/utils/imageUtils";

function BackgroundLayer({ url, className, onError }) {
  if (!url) return null;

  if (isVideoUrl(url)) {
    return (
      <video
        key={url}
        className={`${className} h-full w-full object-cover`}
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
        onError={(e) => {
          // Suppress Safari placard errors (pip/airplay) when network is down — fallback silently
          if (typeof navigator !== "undefined" && !navigator.onLine) {
            e?.preventDefault?.();
          }
          onError?.(e);
        }}
      />
    );
  }

  return <div className={className} style={{ backgroundImage: `url("${url}")` }} />;
}

const FADE_MS = 1100;

export default function BackgroundManager({ targetBgUrl, preloadUrl }) {
  const [currentBg, setCurrentBg] = useState(targetBgUrl);
  const [prevBg, setPrevBg] = useState(null);
  const [isFading, setIsFading] = useState(false);
  const swapTokenRef = useRef(0);
  const layersRef = useRef({ current: targetBgUrl, prev: null });
  layersRef.current = { current: currentBg, prev: prevBg };

  useEffect(() => {
    if (!preloadUrl || preloadUrl === layersRef.current.current || preloadUrl === layersRef.current.prev) return;

    if (isVideoUrl(preloadUrl)) {
      const probe = document.createElement("video");
      probe.preload = "auto";
      probe.muted = true;
      probe.src = preloadUrl;
      return () => {
        probe.removeAttribute("src");
        probe.load();
      };
    }

    const img = new Image();
    img.src = preloadUrl;
    return () => {
      img.src = "";
    };
  }, [preloadUrl]);

  useEffect(() => {
    if (targetBgUrl === currentBg) return;

    let isMounted = true;
    let failSafe;
    let raf1;
    let raf2;
    let dropTimer;
    const token = ++swapTokenRef.current;

    const commitSwap = () => {
      if (!isMounted || token !== swapTokenRef.current) return;
      setPrevBg(currentBg);
      setCurrentBg(targetBgUrl);
      setIsFading(true);
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          if (isMounted && token === swapTokenRef.current) setIsFading(false);
        });
      });
      dropTimer = setTimeout(() => {
        if (isMounted && token === swapTokenRef.current) setPrevBg(null);
      }, FADE_MS);
    };

    if (targetBgUrl.startsWith("blob:")) {
      commitSwap();
      return () => {
        isMounted = false;
        clearTimeout(dropTimer);
      };
    }

    failSafe = setTimeout(commitSwap, 8000);

    const finishEarly = () => {
      clearTimeout(failSafe);
      commitSwap();
    };

    if (isVideoUrl(targetBgUrl)) {
      const probe = document.createElement("video");
      probe.preload = "auto";
      probe.muted = true;
      probe.src = targetBgUrl;
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        finishEarly();
        probe.removeAttribute("src");
        probe.load();
      };
      probe.addEventListener("canplay", finish, { once: true });
      probe.addEventListener("error", finish, { once: true });

      return () => {
        isMounted = false;
        settled = true;
        clearTimeout(failSafe);
        clearTimeout(dropTimer);
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
        probe.removeAttribute("src");
        probe.load();
      };
    }

    const img = new Image();
    img.src = targetBgUrl;
    img.onload = finishEarly;
    img.onerror = finishEarly;

    return () => {
      isMounted = false;
      clearTimeout(failSafe);
      clearTimeout(dropTimer);
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      img.onload = null;
      img.onerror = null;
      img.src = "";
    };
  }, [targetBgUrl, currentBg]);

  return (
    <>
      {prevBg && (
        <BackgroundLayer
          url={prevBg}
          className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none z-0"
        />
      )}
      <BackgroundLayer
        url={currentBg}
        className={`absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none z-0 transition-opacity duration-1000 ease-in-out ${
          isFading ? "opacity-0" : "opacity-100"
        }`}
        onError={() => {
          if (currentBg && !currentBg.startsWith("blob:") && currentBg !== prevBg) {
            setCurrentBg(prevBg || currentBg);
          }
        }}
      />

      {preloadUrl && isVideoUrl(preloadUrl) && preloadUrl !== currentBg && preloadUrl !== prevBg && (
        <video
          key={preloadUrl}
          src={preloadUrl}
          preload="auto"
          muted
          playsInline
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 h-1 w-1 opacity-0"
        />
      )}

      <div className="absolute inset-0 pointer-events-none z-0 bg-black/10" />
    </>
  );
}
