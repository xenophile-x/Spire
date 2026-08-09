

import React, { useEffect } from "react";
import "material-symbols/rounded.css";
import { GlassCard } from "@/components/ui/glasscn/glass-card";
import { GlassProgress } from "@/components/ui/glasscn/glass-progress";
import { GlassButton } from "@/components/ui/glasscn/glass-button";
import { LiquidGlass } from "@/components/ui/glasscn/liquid-glass";

export default function UploadModal({
  isOpen,
  onClose,
  file,
  currentStep = 1,
  uploadProgress = 0,
  errorMessage,
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isComplete = currentStep >= 4 || uploadProgress >= 100;
  const clampedProgress = Math.min(100, Math.max(0, uploadProgress));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center  p-4 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
    >
      <GlassCard
        glassVariant="liquid-refract"
        liquidProps={{
          blur: 12,
          refraction: 14,
          saturation: 1.45,
          className: "rounded-3xl",
        }}
        className="relative w-full max-w-md space-y-5 p-6 text-white"
      >
        <div className="flex items-center justify-between pb-4">
          <div className="flex items-center gap-2.5">
            <span
              className="material-symbols-rounded text-2xl text-white"
              style={{
                fontVariationSettings: "'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 24",
              }}
            >
              cloud_upload
            </span>
            <h3 id="upload-modal-title" className="text-lg font-bold tracking-tight text-white">
              {isComplete ? "Upload Complete" : "Uploading Track"}
            </h3>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="cursor-pointer rounded-full p-1.5 text-white/70 transition-all  hover:text-white"
          >
            <span className="material-symbols-rounded block text-xl">close</span>
          </button>
        </div>

        <div className="space-y-4">
          {file && (
            <LiquidGlass
              blur={6}
              refraction={6}
              saturation={1.2}
              className="rounded-xl p-3.5 [--liquid-glass-rim-width:0.5px]"
            >
              <div className="flex items-center gap-3.5">
                <LiquidGlass
                  blur={4}
                  refraction={4}
                  saturation={1.2}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg [--liquid-glass-rim-width:0.5px]"
                >
                  <span className="material-symbols-rounded text-xl text-white">audio_file</span>
                </LiquidGlass>
                <div className="min-w-0 flex-1 space-y-0.5 overflow-hidden">
                  <p className="truncate text-xs leading-snug font-semibold text-white">{file.name}</p>
                  <p className="text-[10px] font-medium text-white/60">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
              </div>
            </LiquidGlass>
          )}

          {errorMessage && (
            <div className="flex items-center gap-2.5 rounded-xl border border-red-400/30 bg-red-500/20 p-3.5 text-xs text-red-100">
              <span className="material-symbols-rounded shrink-0 text-lg text-red-300">error</span>
              <span className="leading-tight">{errorMessage}</span>
            </div>
          )}

          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs text-white/80">
              <span className="font-medium">
                {isComplete ? "Processing finished" : "Uploading..."}
              </span>
              <span className="font-mono text-xs text-white/90">{Math.round(clampedProgress)}%</span>
            </div>

            <GlassProgress value={clampedProgress} className="h-2 w-full gap-0" />
          </div>
        </div>

        <div className="border-t border-white/10 pt-4">
          {isComplete ? (
            <button
              onClick={onClose}
              className="w-full cursor-pointer rounded-xl border border-white/20 bg-white/10 py-2.5 text-xs font-semibold text-white hover:bg-white/20 transition-all"
            >
              Done
            </button>
          ) : (
            <GlassButton
              onClick={onClose}
              glassVariant="liquid-refract"
              className="w-full rounded-xl py-2.5 text-xs font-semibold text-white"
              style={{ color: '#ffffff' }}
            >
              Cancel Upload
            </GlassButton>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

