import React from "react";
import { cn } from "@/lib/utils";

// ---- Simplified: edit part removed ----
// Keep same exports for compatibility, but without edit mode, jiggle, resize, or dim logic.
// AppleResizableGrid is now a plain responsive grid.
// AppleResizableTile is a plain wrapper with fixed 1x1 size (ignores resizable/removable props).

export const TILE_PRESETS = [
  { id: "1x1", colSpan: 1, rowSpan: 1, label: "Small" },
  { id: "2x1", colSpan: 2, rowSpan: 1, label: "Wide" },
  { id: "1x2", colSpan: 1, rowSpan: 2, label: "Tall" },
  { id: "2x2", colSpan: 2, rowSpan: 2, label: "Large" },
];

export function presetForId(id) {
  return TILE_PRESETS.find((p) => p.id === id) || TILE_PRESETS[0];
}

// ---- Grid container ----
export function AppleResizableGrid({ children, className, cols = "default", gap = "gap-4", ...props }) {
  const colsClass =
    cols === "default"
      ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
      : cols;
  return (
    <div
      className={cn(
        "grid auto-rows-[minmax(0,auto)] grid-auto-flow-dense",
        colsClass,
        gap,
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ---- Tile wrapper (edit removed - renders as static 1x1 tile) ----
export function AppleResizableTile({
  id,
  defaultSize = "1x1",
  className,
  children,
  onRemove,
  removable = true,
  resizable = true,
  hideWhenRemoved = true,
}) {
  // edit removed: always render as 1x1, no jiggle, no long-press, no remove/resize UI
  return (
    <div
      data-apple-tile={id}
      className={cn("relative select-none", className)}
      style={{
        gridColumn: `span 1 / span 1`,
        gridRow: `span 1 / span 1`,
      }}
    >
      <div className="h-full w-full">{children}</div>
    </div>
  );
}

// Stub: previously enabled long-press to enter edit mode — now no-op
export function useLongPressToEdit({ delay = 480 } = {}) {
  return { onPointerDown: undefined, onPointerUp: undefined, onPointerLeave: undefined, onPointerCancel: undefined };
}

// Stub: global edit toggle button removed — renders nothing
export function AppleEditToggle({ className }) {
  return null;
}

// Stub: dim overlay removed — renders nothing
export function AppleEditDimOverlay() {
  return null;
}
