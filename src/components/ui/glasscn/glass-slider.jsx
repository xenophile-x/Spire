// src/components/ui/glasscn/glass-slider.jsx
// Glassmorphic range slider — drop-in replacement for <input type="range">
import React, { useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

/**
 * GlassSlider
 * A stylised range slider that matches the glasscn aesthetic.
 *
 * Props:
 *   value       — controlled value (number)
 *   min         — minimum value (default 0)
 *   max         — maximum value (default 100)
 *   step        — step increment (default 0.1)
 *   onChange    — called while dragging: (newValue: number) => void
 *   onCommit    — called when thumb is released: (newValue: number) => void
 *   disabled    — boolean
 *   className   — extra classes for the root element
 *   trackHeight — track thickness in px (default 3)
 *   thumbSize   — thumb diameter in px (default 12)
 */
export function GlassSlider({
  value = 0,
  min = 0,
  max = 100,
  step = 0.1,
  onChange,
  onCommit,
  disabled = false,
  className,
  trackHeight = 3,
  thumbSize = 12,
}) {
  const inputRef = useRef(null);

  const percent = max > min ? ((value - min) / (max - min)) * 100 : 0;

  const handleChange = useCallback(
    (e) => {
      onChange?.(Number(e.target.value));
    },
    [onChange]
  );

  const handleCommit = useCallback(
    (e) => {
      onCommit?.(Number(e.target.value));
    },
    [onCommit]
  );

  return (
    <div
      className={cn(
        "relative flex w-full items-center",
        disabled && "pointer-events-none opacity-40",
        className
      )}
      style={{ height: `${Math.max(thumbSize, 16)}px` }}
    >
      {/* Glass track background */}
      <div
        className="absolute inset-x-0 rounded-full overflow-hidden"
        style={{ height: `${trackHeight}px`, top: "50%", transform: "translateY(-50%)" }}
      >
        {/* Filled portion */}
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-[width] duration-75"
          style={{
            width: `${percent}%`,
            background:
              "linear-gradient(to right, rgba(255,255,255,0.92), rgba(255,255,255,0.75))",
            boxShadow: "0 0 6px rgba(255,255,255,0.4)",
          }}
        />
        {/* Unfilled portion */}
        <div
          className="absolute top-0 h-full rounded-full"
          style={{
            left: `${percent}%`,
            right: 0,
            background: "rgba(255,255,255,0.15)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
          }}
        />
      </div>

      {/* Invisible native range input sits on top for full native interaction */}
      <input
        ref={inputRef}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={handleChange}
        onMouseUp={handleCommit}
        onTouchEnd={handleCommit}
        onKeyUp={handleCommit}
        className={cn(
          // Make the native input transparent but interactive
          "absolute inset-0 w-full h-full cursor-pointer appearance-none bg-transparent focus:outline-none",
          // Webkit thumb — size must be set; colour transparent so our custom DOM thumb shows
          "[&::-webkit-slider-thumb]:appearance-none",
          "[&::-webkit-slider-thumb]:rounded-full",
          "[&::-webkit-slider-thumb]:bg-white",
          "[&::-webkit-slider-thumb]:shadow-[0_0_0_2px_rgba(255,255,255,0.3),0_2px_8px_rgba(0,0,0,0.5)]",
          "[&::-webkit-slider-thumb]:transition-transform",
          "[&::-webkit-slider-thumb]:duration-100",
          "[&::-webkit-slider-thumb]:hover:scale-125",
          "[&::-webkit-slider-thumb]:active:scale-110",
          // Firefox thumb
          "[&::-moz-range-thumb]:border-0",
          "[&::-moz-range-thumb]:rounded-full",
          "[&::-moz-range-thumb]:bg-white",
          "[&::-moz-range-thumb]:shadow-[0_0_0_2px_rgba(255,255,255,0.3),0_2px_8px_rgba(0,0,0,0.5)]",
          // Remove webkit track so our DOM track shows through
          "[&::-webkit-slider-runnable-track]:bg-transparent",
          "[&::-moz-range-track]:bg-transparent"
        )}
        style={{
          // Force thumb size via CSS variables since Tailwind can't interpolate px values from props
          "--thumb-size": `${thumbSize}px`,
        } /* @ts-ignore */}
      />

      {/* Override thumb size via a style tag approach — inject via inline style on the input */}
      <style>{`
        input[type=range]::-webkit-slider-thumb {
          width: ${thumbSize}px;
          height: ${thumbSize}px;
        }
        input[type=range]::-moz-range-thumb {
          width: ${thumbSize}px;
          height: ${thumbSize}px;
        }
      `}</style>
    </div>
  );
}
