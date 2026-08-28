import React, { useRef, useState, useCallback, useEffect } from "react";
import { useAppleEdit, presetForId, TILE_PRESETS } from "@/context/AppleEditContext";
import { cn } from "@/lib/utils";

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

// ---- Tile wrapper ----
export function AppleResizableTile({
  id,
  defaultSize = "1x1",
  className,
  children,
  onRemove,
  removable = true,
  resizable = true,
  // when true, tile hides instead of being unmounted when removed (so restore works)
  hideWhenRemoved = true,
}) {
  const { isEditMode, getSize, setSize, removeTile, isRemoved, setIsEditMode } = useAppleEdit();
  const presetId = getSize(id, defaultSize);
  const preset = presetForId(presetId);
  const removed = isRemoved(id);

  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, startPresetIdx: 0, active: false });
  const longPressRef = useRef(null);

  const presetIdx = TILE_PRESETS.findIndex((p) => p.id === presetId);

  const cancelLongPress = useCallback(() => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }, []);

  // Long-press on tile to enter edit mode (Apple-like)
  const handleTilePointerDown = useCallback(
    (e) => {
      if (isEditMode) return;
      if (e.button !== undefined && e.button !== 0) return;
      cancelLongPress();
      longPressRef.current = setTimeout(() => {
        setIsEditMode(true);
        try { navigator.vibrate?.(40); } catch {}
      }, 460);
    },
    [isEditMode, cancelLongPress, setIsEditMode],
  );

  const handleTilePointerUp = useCallback(() => cancelLongPress(), [cancelLongPress]);

  const handlePointerDown = useCallback(
    (e) => {
      if (!isEditMode || !resizable) return;
      e.preventDefault();
      e.stopPropagation();
      const idx = TILE_PRESETS.findIndex((p) => p.id === getSize(id, defaultSize));
      dragRef.current = { startX: e.clientX, startY: e.clientY, startPresetIdx: idx, active: true };
      setDragging(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
    },
    [isEditMode, resizable, getSize, id, defaultSize],
  );

  const handlePointerMove = useCallback(
    (e) => {
      if (!dragRef.current.active) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      // Apple-like: diagonal drag decisive - average of dx/dy but favor positive
      const dist = (dx + dy) / 2;
      // threshold 34px per step - enables 1-2 step drag
      const steps = Math.round(dist / 42);
      let nextIdx = dragRef.current.startPresetIdx + steps;
      nextIdx = Math.max(0, Math.min(TILE_PRESETS.length - 1, nextIdx));
      if (nextIdx !== presetIdx) {
        setSize(id, TILE_PRESETS[nextIdx].id);
      }
    },
    [id, presetIdx, setSize],
  );

  const handlePointerUp = useCallback(
    (e) => {
      if (!dragRef.current.active) return;
      dragRef.current.active = false;
      setDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    },
    [],
  );

  // jiggle delay per tile for organic feel
  const jiggleDelay = React.useMemo(() => `${(parseInt(id.slice(-2), 36) % 7) * 40}ms`, [id]);

  if (removed && hideWhenRemoved) return null;

  const colSpan = preset.colSpan;
  const rowSpan = preset.rowSpan;

  return (
    <div
      data-apple-tile={id}
      data-apple-size={presetId}
      data-edit-mode={isEditMode ? "1" : "0"}
      onPointerDown={handleTilePointerDown}
      onPointerUp={handleTilePointerUp}
      onPointerLeave={handleTilePointerUp}
      onPointerCancel={handleTilePointerUp}
      className={cn(
        "relative select-none",
        // grid placement
        className,
      )}
      style={{
        gridColumn: `span ${colSpan} / span ${colSpan}`,
        gridRow: `span ${rowSpan} / span ${rowSpan}`,
        // transition on grid placement for smooth reflow (framer-like)
        transition: dragging ? "none" : "grid-column 260ms cubic-bezier(0.32,0.72,0,1), grid-row 260ms cubic-bezier(0.32,0.72,0,1), transform 260ms ease, opacity 200ms ease",
      }}
    >
      {/* Jiggle wrapper - only when editing */}
      <div
        className={cn(
          "h-full w-full",
          isEditMode && "apple-jiggle",
          dragging && "apple-dragging",
        )}
        style={
          isEditMode
            ? {
                animationDelay: jiggleDelay,
                // scale down slightly while dragging like iOS
                transform: dragging ? "scale(0.985)" : undefined,
              }
            : undefined
        }
      >
        {/* Scale inner for smooth size transition */}
        <div
          className={cn(
            "h-full w-full transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
            isEditMode && "pointer-events-none", // prevent clicks on content while editing (except controls)
            dragging && "scale-[0.99]",
          )}
        >
          {children}
        </div>
      </div>

      {/* Edit-mode chrome */}
      {isEditMode && (
        <>
          {/* dim/blur overlay on tile content hint */}
          <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-black/0" />

          {/* minus button top-left like iOS: small grey circle with white minus, outside corner */}
          {removable && (
            <button
              type="button"
              aria-label="Remove tile"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (onRemove) onRemove(id);
                else removeTile(id);
              }}
              className="absolute -left-2 -top-2 z-20 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-[#8e8e93] shadow-[0_2px_10px_rgba(0,0,0,0.35)] ring-1 ring-white/20 transition-all hover:scale-105 active:scale-90 md:h-[26px] md:w-[26px]"
            >
              <span className="h-[2px] w-3 rounded-full bg-white" />
            </button>
          )}

          {/* resize handle bottom-right: Apple Control Center curved L */}
          {resizable && (
            <div
              role="slider"
              aria-label={`Resize ${id}, current ${preset.label}`}
              aria-valuenow={presetIdx}
              aria-valuemin={0}
              aria-valuemax={TILE_PRESETS.length - 1}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                  e.preventDefault();
                  const next = Math.min(TILE_PRESETS.length - 1, presetIdx + 1);
                  setSize(id, TILE_PRESETS[next].id);
                } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                  e.preventDefault();
                  const next = Math.max(0, presetIdx - 1);
                  setSize(id, TILE_PRESETS[next].id);
                }
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className={cn(
                "absolute -bottom-1 -right-1 z-20 flex h-9 w-9 cursor-nwse-resize touch-none items-center justify-center rounded-full transition-transform active:scale-95",
                dragging && "scale-110",
              )}
              title="Drag to resize — Apple-like"
            >
              {/* curved handle visual: outer rounded corner with inner cut */}
              <div
                className={cn(
                  "pointer-events-none absolute inset-0 rounded-full",
                  // the handle shape - white thick arc at bottom-right
                )}
                style={{
                  background: "transparent",
                }}
              />
              {/* Actual visible handle: bottom-right corner chevron with border */}
              <div
                className={cn(
                  "absolute bottom-0 right-0 h-[30px] w-[30px] overflow-hidden rounded-br-[22px]",
                  "border-[3px] border-white/90 bg-transparent",
                  "shadow-[0_1px_8px_rgba(0,0,0,0.25)]",
                  // only show border on bottom and right
                  "border-l-transparent border-t-transparent",
                  dragging ? "border-white bg-white/10" : "bg-transparent",
                )}
                style={{
                  borderTopLeftRadius: 10,
                  // cut inner corner
                }}
              >
                {/* diagonal grip lines */}
                <div className="absolute bottom-[7px] right-[3px] h-[2px] w-[10px] rotate-[-45deg] rounded-full bg-white/0" />
              </div>
              {/* inner highlight dot */}
              <div
                className={cn(
                  "pointer-events-none absolute bottom-[6px] right-[6px] h-1.5 w-1.5 rounded-full bg-white/0",
                )}
              />
              {/* visible handle icon: three lines or corner arrows */}
              <svg
                width="30"
                height="30"
                viewBox="0 0 30 30"
                className="pointer-events-none absolute bottom-0 right-0 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]"
                aria-hidden="true"
              >
                {/* Outer rounded L shape */}
                <path
                  d="M 9 22 C 9 26.5 11.5 29 16 29 L 29 29 L 29 16 C 29 11.5 26.5 9 22 9"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={dragging ? 1 : 0.92}
                />
                {/* inner small chevron hint */}
                <path
                  d="M 18 24 L 24 24 L 24 18"
                  fill="none"
                  stroke="white"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.95"
                />
              </svg>
            </div>
          )}
        </>
      )}

      {/* scoped jiggle keyframes */}
      <style>{`
        @keyframes apple-jiggle {
          0% { transform: rotate(-0.6deg) translateX(-0.4px); }
          25% { transform: rotate(0.7deg) translateX(0.5px); }
          50% { transform: rotate(-0.5deg) translateY(0.3px); }
          75% { transform: rotate(0.6deg) translateX(-0.3px); }
          100% { transform: rotate(-0.6deg) translateX(-0.4px); }
        }
        .apple-jiggle {
          animation: apple-jiggle 320ms ease-in-out infinite;
          transform-origin: center center;
          will-change: transform;
        }
        .apple-jiggle:nth-child(2n) { animation-duration: 300ms; animation-direction: reverse; }
        .apple-jiggle:nth-child(3n) { animation-duration: 340ms; }
        .apple-dragging {
          animation: none !important;
          z-index: 30;
        }
      `}</style>
    </div>
  );
}

// ---- Small helper: long-press to enter edit mode (Apple-like) ----
export function useLongPressToEdit({ delay = 480 } = {}) {
  const { setIsEditMode } = useAppleEdit();
  const timerRef = useRef(null);
  const start = useCallback(
    (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setIsEditMode(true);
        // haptic if available
        try { navigator.vibrate?.(40); } catch {}
      }, delay);
    },
    [setIsEditMode, delay],
  );
  const cancel = useCallback(() => clearTimeout(timerRef.current), []);
  return { onPointerDown: start, onPointerUp: cancel, onPointerLeave: cancel, onPointerCancel: cancel };
}

// ---- Global edit toggle button (pill) ----
export function AppleEditToggle({ className }) {
  const { isEditMode, toggleEditMode, removedIds, restoreAll } = useAppleEdit();
  const removedCount = removedIds.size;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {removedCount > 0 && isEditMode && (
        <button
          type="button"
          onClick={restoreAll}
          className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md border border-white/20 hover:bg-white/20 transition-colors"
        >
          Restore {removedCount}
        </button>
      )}
      <button
        type="button"
        onClick={toggleEditMode}
        aria-pressed={isEditMode}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold tracking-wide backdrop-blur-md border transition-all active:scale-95",
          isEditMode
            ? "bg-white text-black border-white shadow-lg shadow-black/20"
            : "bg-white/15 text-white border-white/20 hover:bg-white/20 hover:border-white/30",
        )}
      >
        <span className="material-symbols-rounded text-[16px] leading-none">{isEditMode ? "check" : "edit"}</span>
        {isEditMode ? "Done" : "Edit"}
      </button>
    </div>
  );
}

export function AppleEditDimOverlay() {
  const { isEditMode, setIsEditMode } = useAppleEdit();
  if (!isEditMode) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[5] bg-black/10 backdrop-blur-[1px] transition-opacity" aria-hidden="true" />
  );
}
