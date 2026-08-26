import React, { useEffect } from "react";
import "material-symbols/rounded.css";
import { GlassCard } from "@/components/ui/glasscn/glass-card";
import { GlassProgress } from "@/components/ui/glasscn/glass-progress";
import { GlassButton } from "@/components/ui/glasscn/glass-button";
import { LiquidGlass } from "@/components/ui/glasscn/liquid-glass";

const STEP_LABELS = {
  1: "Matching metadata…",
  2: "Finding lyrics…",
  3: "Uploading to Drive…",
  4: "Saving to library…",
};

export default function UploadModal({
  isOpen,
  onClose,
  queue = [],
  currentIndex = 0,
  currentStep = 1,
  uploadProgress: _uploadProgress = 0,
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

  const total = queue.length;
  const doneCount = queue.filter((f) => f.status === "done").length;
  const errorCount = queue.filter((f) => f.status === "error").length;
  const isComplete = total > 0 && doneCount + errorCount === total;
  const aggregatePercent = total
    ? Math.round(queue.reduce((sum, f) => sum + f.percent, 0) / total)
    : 0;
  const clampedProgress = Math.min(100, Math.max(0, aggregatePercent));

  const statusMeta = (entry) => {
    switch (entry.status) {
      case "done":
        return { icon: "", color: "", label: "Done" };
      case "error":
        return { icon: "error", color: "text-red-300", label: entry.error || "Failed" };
      case "processing":
        return {
          icon: "sync",
          color: "text-white",
          label: `${Math.round(entry.percent)}% · ${STEP_LABELS[currentStep] || "Processing…"}`,
        };
      default:
        return { icon: "schedule", color: "text-white/40", label: "Queued" };
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
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
            <div>
              <h3 id="upload-modal-title" className="text-lg font-bold tracking-tight text-white">
                {isComplete
                  ? "Upload Complete"
                  : total > 1
                    ? "Uploading Tracks"
                    : "Uploading Track"}
              </h3>
              <p className="text-[10px] font-medium text-white/60">
                {isComplete
                  ? `${doneCount} uploaded${errorCount ? ` · ${errorCount} failed` : ""}`
                  : total > 1
                    ? `Song ${Math.min(currentIndex + 1, total)} of ${total}`
                    : "One song at a time"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="cursor-pointer rounded-full p-1.5 text-white/70 transition-all hover:text-white"
          >
            <span className="material-symbols-rounded block text-xl">close</span>
          </button>
        </div>

        <div className="space-y-4">
          {queue.length > 0 && (
            <div className="max-h-52 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
              {queue.map((entry, i) => {
                const meta = statusMeta(entry);
                const isActive = i === currentIndex && !isComplete;
                return (
                  <LiquidGlass
                    key={`${entry.name}-${i}`}
                    blur={6}
                    refraction={6}
                    saturation={1.2}
                    className={`rounded-xl p-3 [--liquid-glass-rim-width:0.5px] transition-all ${
                      isActive ? "ring-1 ring-white/30" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <LiquidGlass
                        blur={4}
                        refraction={4}
                        saturation={1.2}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg [--liquid-glass-rim-width:0.5px]"
                      >
                        <span className="material-symbols-rounded text-lg text-white">
                          audio_file
                        </span>
                      </LiquidGlass>
                      <div className="min-w-0 flex-1 space-y-0.5 overflow-hidden">
                        <p className="truncate text-xs font-semibold leading-snug text-white">
                          {entry.name}
                        </p>
                        <p className="text-[10px] font-medium text-white/60">
                          {(entry.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {meta.icon && (
                          <span
                            className={`material-symbols-rounded text-sm ${meta.color} ${
                              entry.status === "processing" ? "animate-spin" : ""
                            }`}
                          >
                            {meta.icon}
                          </span>
                        )}
                        <span
                          className={`max-w-28 truncate text-[10px] font-medium ${
                            entry.status === "error" ? "text-red-300" : "text-white/60"
                          }`}
                        >
                          {entry.status === "processing"
                            ? `${Math.round(entry.percent)}%`
                            : meta.label}
                        </span>
                      </div>
                    </div>
                  </LiquidGlass>
                );
              })}
            </div>
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
                {isComplete
                  ? "Processing finished"
                  : total > 1
                    ? `${doneCount + errorCount + (queue[currentIndex]?.status === "processing" ? 1 : 0)} of ${total} processed`
                    : "Uploading..."}
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
              className="w-full cursor-pointer rounded-xl border border-white/20 bg-white/10 py-2.5 text-xs font-semibold text-white transition-all hover:bg-white/20"
            >
              Done
            </button>
          ) : (
            <GlassButton
              onClick={onClose}
              glassVariant="liquid-refract"
              className="w-full rounded-xl py-2.5 text-xs font-semibold text-white"
              style={{ color: "#ffffff" }}
            >
              Cancel Upload
            </GlassButton>
          )}
        </div>
      </GlassCard>
    </div>
  );
}