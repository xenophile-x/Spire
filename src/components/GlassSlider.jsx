import React, { useCallback, useRef, useState } from "react";

export default function GlassSlider({
  value = 0,
  max = 0,
  onChange,
  onScrubStart,
  onScrubEnd,
  disabled = false,
  label,
  className = "",
}) {
  const trackRef = useRef(null);
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  const clamp = useCallback((v) => Math.min(max, Math.max(0, v)), [max]);

  const valueFromEvent = useCallback(
    (clientX) => {
      const rect = trackRef.current.getBoundingClientRect();
      if (rect.width <= 0) return 0;
      return clamp(((clientX - rect.left) / rect.width) * max);
    },
    [clamp, max]
  );

  const handlePointerDown = (e) => {
    if (disabled || max <= 0) return;
    e.preventDefault();
    draggingRef.current = true;
    setDragging(true);
    try {
      trackRef.current.setPointerCapture(e.pointerId);
    } catch {}

    onScrubStart?.();
    onChange?.(valueFromEvent(e.clientX));
  };

  const handlePointerMove = (e) => {
    if (!draggingRef.current) return;
    onChange?.(valueFromEvent(e.clientX));
  };

  const handlePointerUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    onScrubEnd?.();
  };

  const handleKeyDown = (e) => {
    if (disabled || max <= 0) return;
    const step = e.shiftKey ? 10 : 5;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      onChange?.(clamp(value + step));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      onChange?.(clamp(value - step));
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange?.(0);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange?.(max);
    }
  };

  const pct = max > 0 ? Math.min(100, (clamp(value) / max) * 100) : 0;

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(clamp(value))}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      className={`group relative h-6 w-full cursor-pointer touch-none select-none ${
        disabled ? "cursor-default opacity-50" : ""
      } ${className}`}
    >
      <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 overflow-hidden rounded-full bg-white/15">
        <div
          className="h-full rounded-full bg-gradient-to-r from-white/60 to-white"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div
        className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-lg shadow-black/40 ring-2 ring-white/30 transition-all ${
          dragging ? "scale-125 opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}