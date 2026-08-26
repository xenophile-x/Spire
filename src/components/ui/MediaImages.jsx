import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_COVER,
  fetchArtistImageFallback,
  fetchTrackCoverFallback,
} from "@/utils/mediaResolver";

const LAZY_ROOT_MARGIN = "300px";

function useNearViewport(ref, enabled) {
  const [near, setNear] = useState(false);

  useEffect(() => {
    if (!enabled || near) return;
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          setNear(true);
        }
      },
      { rootMargin: LAZY_ROOT_MARGIN }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, enabled, near]);

  return near;
}

export function TrackCoverImage({ track, className, alt, onClick }) {
  const imgRef = useRef(null);
  // Level 1: DB metadata.
  const dbCover = track?.cover || track?.artworkUrl || track?.artwork_url;
  const [dbFailed, setDbFailed] = useState(false);
  const [fallbackSrc, setFallbackSrc] = useState(null);
  const [fallbackFailed, setFallbackFailed] = useState(false);

  const title = track?.title;
  const artist = track?.artist;

  // Level 2: lazily resolve a remote cover only when no DB artwork exists
  // AND the element is about to enter the viewport.
  const needsLookup = (!dbCover || dbFailed) && !fallbackSrc && !fallbackFailed;
  const near = useNearViewport(imgRef, needsLookup);

  useEffect(() => {
    setDbFailed(false);
    setFallbackSrc(null);
    setFallbackFailed(false);
  }, [dbCover, title, artist]);

  useEffect(() => {
    if (!near) return;
    let alive = true;

    fetchTrackCoverFallback(title, artist).then((src) => {
      if (alive && src) setFallbackSrc(src);
      else if (alive) setFallbackFailed(true);
    });

    return () => {
      alive = false;
    };
  }, [near, title, artist]);

  const src =
    dbCover && !dbFailed ? dbCover : fallbackSrc || DEFAULT_COVER;

  return (
    <img
      ref={imgRef}
      src={src}
      alt={alt || title || "Track"}
      className={className}
      onClick={onClick}
      loading="lazy"
      decoding="async"
      onError={() => {
        if (dbCover && !dbFailed) setDbFailed(true);
        else setFallbackFailed(true);
      }}
    />
  );
}

export function ArtistProfileImage({
  initialSrc,
  artistName,
  className,
  alt,
  fallbackInitial,
}) {
  const imgRef = useRef(null);
  const [resolvedSrc, setResolvedSrc] = useState(initialSrc || null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setResolvedSrc(initialSrc || null);
    setFailed(false);
  }, [initialSrc, artistName]);

  // Level 2: remote lookup only when the DB has no photo for this artist
  // and the avatar is about to be seen.
  const near = useNearViewport(imgRef, !initialSrc && !failed && !resolvedSrc);

  useEffect(() => {
    if (!near) return;
    let alive = true;

    fetchArtistImageFallback(artistName).then((src) => {
      if (!alive) return;
      if (src) setResolvedSrc(src);
      else setFailed(true);
    });

    return () => {
      alive = false;
    };
  }, [near, artistName]);

  if (failed || !resolvedSrc) {
    return (
      <div
        className={`${className} flex items-center justify-center bg-gradient-to-br from-white/20 via-white/10 to-black/50 text-white font-bold drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]`}
      >
        {fallbackInitial}
      </div>
    );
  }

  return (
    <img
      ref={imgRef}
      src={resolvedSrc}
      alt={alt || artistName}
      className={cn("max-w-none", className)}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
