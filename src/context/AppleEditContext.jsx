import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";

const STORAGE_KEY = "spire_apple_tile_sizes_v1";
const REMOVED_KEY = "spire_apple_removed_v1";

export const TILE_PRESETS = [
  { id: "1x1", colSpan: 1, rowSpan: 1, label: "Small" },
  { id: "2x1", colSpan: 2, rowSpan: 1, label: "Wide" },
  { id: "1x2", colSpan: 1, rowSpan: 2, label: "Tall" },
  { id: "2x2", colSpan: 2, rowSpan: 2, label: "Large" },
];

export function presetForId(id) {
  return TILE_PRESETS.find((p) => p.id === id) || TILE_PRESETS[0];
}

const AppleEditContext = createContext(null);

export function AppleEditProvider({ children }) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [sizes, setSizes] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [removedIds, setRemovedIds] = useState(() => {
    try {
      const raw = localStorage.getItem(REMOVED_KEY);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes));
    } catch {}
  }, [sizes]);

  useEffect(() => {
    try {
      localStorage.setItem(REMOVED_KEY, JSON.stringify([...removedIds]));
    } catch {}
  }, [removedIds]);

  const getSize = useCallback((tileId, fallback = "1x1") => sizes[tileId] || fallback, [sizes]);

  const setSize = useCallback((tileId, presetId) => {
    setSizes((prev) => ({ ...prev, [tileId]: presetId }));
  }, []);

  const cycleSize = useCallback((tileId, direction = 1) => {
    setSizes((prev) => {
      const cur = prev[tileId] || "1x1";
      const idx = TILE_PRESETS.findIndex((p) => p.id === cur);
      const nextIdx = Math.max(0, Math.min(TILE_PRESETS.length - 1, idx + direction));
      return { ...prev, [tileId]: TILE_PRESETS[nextIdx].id };
    });
  }, []);

  const removeTile = useCallback((tileId) => {
    setRemovedIds((prev) => new Set([...prev, tileId]));
  }, []);

  const restoreTile = useCallback((tileId) => {
    setRemovedIds((prev) => {
      const n = new Set(prev);
      n.delete(tileId);
      return n;
    });
  }, []);

  const restoreAll = useCallback(() => setRemovedIds(new Set()), []);
  const isRemoved = useCallback((tileId) => removedIds.has(tileId), [removedIds]);

  const toggleEditMode = useCallback(() => setIsEditMode((v) => !v), []);

  const value = useMemo(
    () => ({
      isEditMode,
      setIsEditMode,
      toggleEditMode,
      sizes,
      getSize,
      setSize,
      cycleSize,
      removedIds,
      removeTile,
      restoreTile,
      restoreAll,
      isRemoved,
      TILE_PRESETS,
    }),
    [isEditMode, sizes, removedIds, getSize, setSize, cycleSize, removeTile, restoreTile, restoreAll, isRemoved, toggleEditMode],
  );

  return <AppleEditContext.Provider value={value}>{children}</AppleEditContext.Provider>;
}

export function useAppleEdit() {
  const ctx = useContext(AppleEditContext);
  if (!ctx) throw new Error("useAppleEdit must be used within AppleEditProvider");
  return ctx;
}
