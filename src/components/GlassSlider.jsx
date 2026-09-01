import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

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
  const [localVal, setLocalVal] = useState(value);

  useEffect(() => {
    if (!draggingRef.current) {
      setLocalVal(value);
    }
  }, [value]);

  const clamp = useCallback((v) => Math.min(max, Math.max(0, v)), [max]);

  const valueFromEvent = useCallback(
    (clientX) => {
      if (!trackRef.current) return 0;
      const rect = trackRef.current.getBoundingClientRect();
      if (rect.width <= 0) return 0;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return ratio * max;
    },
    [max]
  );

  const handlePointerDown = (e) => {
    if (disabled || max <= 0) return;
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    setDragging(true);
    try {
      trackRef.current.setPointerCapture(e.pointerId);
    } catch {}

    const newVal = valueFromEvent(e.clientX);
    setLocalVal(newVal);
    onScrubStart?.();
    onChange?.(newVal);
  };

  const handlePointerMove = (e) => {
    if (!draggingRef.current) return;
    const newVal = valueFromEvent(e.clientX);
    setLocalVal(newVal);
    onChange?.(newVal);
  };

  const handlePointerUp = (e) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    try {
      if (e?.pointerId && trackRef.current?.hasPointerCapture(e.pointerId)) {
        trackRef.current.releasePointerCapture(e.pointerId);
      }
    } catch {}
    onScrubEnd?.();
  };

  const handleKeyDown = (e) => {
    if (disabled || max <= 0) return;
    const step = e.shiftKey ? 10 : 5;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const nv = clamp((dragging ? localVal : value) + step);
      setLocalVal(nv);
      onChange?.(nv);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const nv = clamp((dragging ? localVal : value) - step);
      setLocalVal(nv);
      onChange?.(nv);
    } else if (e.key === "Home") {
      e.preventDefault();
      setLocalVal(0);
      onChange?.(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setLocalVal(max);
      onChange?.(max);
    }
  };

  const displayVal = dragging ? localVal : value;
  const pct = max > 0 ? Math.min(100, Math.max(0, (clamp(displayVal) / max) * 100)) : 0;

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(clamp(displayVal))}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      className={cn(
        "group relative flex h-6 w-full cursor-pointer touch-none select-none items-center py-2",
        disabled && "cursor-default opacity-50 pointer-events-none",
        className
      )}
    >
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/20 transition-all group-hover:h-2">
        <div
          className="h-full rounded-full bg-gradient-to-r from-white/70 to-white transition-[width] duration-75"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div
        className={cn(
          "absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-lg shadow-black/50 ring-2 ring-white/40 transition-transform",
          dragging ? "scale-125 opacity-100 ring-white" : "opacity-0 group-hover:opacity-100 group-hover:scale-110"
        )}
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}