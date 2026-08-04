// src/components/UploadModal.jsx
import React, { useEffect } from "react";
import TemperedGlassCard from "@/components/ui/TemperedGlassCard";
import { Progress } from "@/components/ui/progress";

export default function UploadModal({
  isOpen,
  onClose,
  file,
  currentStep = 1,
  uploadProgress = 0,
  errorMessage,
}) {
  // Handle 'Escape' key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
    >
      <TemperedGlassCard className="max-w-md w-full p-6 space-y-5 relative border border-white/20 bg-white/10 backdrop-blur-xl shadow-2xl text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4  ">
          <div className="flex items-center gap-2.5">
            <span
              className="material-symbols-rounded text-2xl text-white"
              style={{
                fontVariationSettings:
                  "'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 24",
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
            className="p-1.5   text-white/70 hover:text-white transition-all cursor-pointer"
          >
            <span className="material-symbols-rounded text-xl block">close</span>
          </button>
        </div>

        {/* Body Container */}
        <div className="space-y-4">
          
          {/* File Card */}
          {file && (
            <div className="bg-white/10 border border-white/15 rounded-xl p-3.5 flex items-center gap-3.5 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                <span className="material-symbols-rounded text-white text-xl">
                  audio_file
                </span>
              </div>
              <div className="overflow-hidden min-w-0 flex-1 space-y-0.5">
                <p className="text-xs font-semibold text-white truncate leading-snug">
                  {file.name}
                </p>
                <p className="text-[10px] text-white/60 font-medium">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="bg-red-500/20 border border-red-400/30 text-red-100 rounded-xl p-3.5 text-xs flex items-center gap-2.5">
              <span className="material-symbols-rounded text-lg text-red-300 shrink-0">
                error
              </span>
              <span className="leading-tight">{errorMessage}</span>
            </div>
          )}

          {/* Progress Section */}
          <div className="space-y-2 pt-1">
            <div className="flex justify-between items-center text-xs text-white/80">
              <span className="font-medium">
                {isComplete ? "Processing finished" : "Uploading..."}
              </span>
              <span className="font-mono text-xs text-white/90 ">
                {Math.round(clampedProgress)}%
              </span>
            </div>

            {/* shadcn Progress Component */}
            <Progress
              value={clampedProgress}
              className="h-2 bg-white/10 [&>div]:bg-white [&>div]:transition-all [&>div]:duration-300"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-2 border-t border-white/10">
          <button
            onClick={onClose}
            className={`w-full py-2.5 font-semibold text-xs rounded-xl border transition-all cursor-pointer ${
              isComplete
                ? "bg-white text-black hover:bg-white/90 border-white shadow-lg"
                : "bg-white/15 hover:bg-white/25 text-white border-white/20"
            }`}
          >
            {isComplete ? "Done" : "Cancel Upload"}
          </button>
        </div>

      </TemperedGlassCard>
    </div>
  );
}