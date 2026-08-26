import React, { useState } from "react";

export default function ImageWithFallback({
  src,
  fallbackSrc,
  alt = "",
  className = "",
  ...rest
}) {
  const [stage, setStage] = useState(src ? 0 : 1);
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  const displaySrc = stage === 0 ? src : fallbackSrc;
  if (!displaySrc) return null;

  return (
    <img
      src={displaySrc}
      alt={alt}
      className={className}
      onError={() => {
        if (stage === 0 && fallbackSrc && fallbackSrc !== src) {
          setStage(1);
        } else {
          setFailed(true);
        }
      }}
      {...rest}
    />
  );
}
