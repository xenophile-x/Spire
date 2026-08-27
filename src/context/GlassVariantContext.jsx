import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { dayModeVariantStyles, nightModeVariantStyles } from "@/lib/glass-variants";

const GlassVariantContext = createContext(null);

const STORAGE_KEY = "spire:glass-variant-mode";

export function GlassVariantProvider({ children }) {
  const [isNightMode, setIsNightMode] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) return JSON.parse(stored);
    } catch {}
    return false;
  });

  const [primaryVariant, setPrimaryVariant] = useState(() => {
    try {
      const stored = localStorage.getItem("spire:glass-primary-variant");
      if (stored) return stored;
    } catch {}
    return isNightMode ? nightModeVariantStyles.primary : dayModeVariantStyles.primary;
  });

  const [secondaryVariant, setSecondaryVariant] = useState(() => {
    try {
      const stored = localStorage.getItem("spire:glass-secondary-variant");
      if (stored) return stored;
    } catch {}
    return isNightMode ? nightModeVariantStyles.secondary : dayModeVariantStyles.secondary;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(isNightMode));
    document.documentElement.classList.toggle("night-mode", isNightMode);
  }, [isNightMode]);

  useEffect(() => {
    localStorage.setItem("spire:glass-primary-variant", primaryVariant);
  }, [primaryVariant]);

  useEffect(() => {
    localStorage.setItem("spire:glass-secondary-variant", secondaryVariant);
  }, [secondaryVariant]);

  const toggleNightMode = useCallback(() => {
    setIsNightMode((prev) => {
      const next = !prev;
      setPrimaryVariant(next ? nightModeVariantStyles.primary : dayModeVariantStyles.primary);
      setSecondaryVariant(next ? nightModeVariantStyles.secondary : dayModeVariantStyles.secondary);
      return next;
    });
  }, []);

  const setPrimary = useCallback((variant) => {
    setPrimaryVariant(variant);
  }, []);

  const setSecondary = useCallback((variant) => {
    setSecondaryVariant(variant);
  }, []);

  const value = {
    isNightMode,
    toggleNightMode,
    primaryVariant,
    secondaryVariant,
    setPrimary,
    setSecondary,
    availableVariants: ["clear", "frosted", "subtle", "liquid", "liquid-refract"],
  };

  return (
    <GlassVariantContext.Provider value={value}>
      {children}
    </GlassVariantContext.Provider>
  );
}

export function useGlassVariant() {
  const ctx = useContext(GlassVariantContext);
  if (!ctx) throw new Error("useGlassVariant must be used within a GlassVariantProvider");
  return ctx;
}