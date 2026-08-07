import React, { useEffect, useRef } from "react";
import { GlassCard } from "@/components/ui/glasscn/glass-card";
import { GlassButton } from "@/components/ui/glasscn/glass-button";
import "material-symbols/rounded.css";

export default function PrivacyPolicyModal({ isOpen, onClose }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === overlayRef.current) {
      onClose?.();
    }
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[99] flex items-center justify-center overflow-y-auto overscroll-contain px-4 py-8 backdrop-blur-sm"
    >
      <GlassCard
        glassVariant="liquid-refract"
        liquidProps={{
          blur: 16,
          refraction: 14,
          className:
            "rounded-3xl [--liquid-glass-rim-light:rgba(255,255,255,0.35)]",
        }}
        className="relative w-full max-w-md text-white"
      >
        <div className="mb-4 flex shrink-0 items-center justify-between border-b border-white/10 px-6 pb-3 pt-6">
          <div className="flex items-center gap-2">
            <span className="material-symbols-rounded text-xl text-cyan-300">
              privacy_tip
            </span>
            <h3 className="text-sm font-bold tracking-wide">
              Privacy Policy &amp; Terms
            </h3>
          </div>
          <GlassButton
            onClick={onClose}
            glassVariant="liquid-refract"
            className="rounded-full px-3 py-1 text-xs font-semibold text-white"
          >
            Close
          </GlassButton>
        </div>

        <div className="max-h-[500px] space-y-5 overflow-y-auto px-6 py-4 text-xs text-white/70">
          <div>
            <h4 className="mb-2 text-[10px] font-bold tracking-widest uppercase text-white/40">
              Privacy Policy
            </h4>
            <p className="leading-relaxed">
              Spire collects only the information needed to provide and improve
              our service. We store uploaded audio file metadata and playback
              activity locally to power your library and recommendations. We do
              not sell your personal data and never share it with third parties
              for advertising. Google Drive integration is used solely to fetch
              the audio files you select.
            </p>

            <h4 className="mb-2 mt-4 text-[10px] font-bold tracking-widest uppercase text-white/40">
              Data We Collect
            </h4>
            <ul className="list-disc space-y-1 leading-relaxed pl-4 marker:text-white/30">
              <li>Local library metadata for tracks you upload.</li>
              <li>Playback state (current time, queue) kept in memory only.</li>
              <li>Optional analytics preferences you choose to enable.</li>
            </ul>
          </div>

          <div>
            <h4 className="mb-2 text-[10px] font-bold tracking-widest uppercase text-white/40">
              Cookies & Storage
            </h4>
            <p className="leading-relaxed">
              We may use local storage to remember your preferences (theme,
              volume, last visited view). No tracking cookies are used.
            </p>
          </div>

          <div>
            <h4 className="mb-2 text-[10px] font-bold tracking-widest uppercase text-white/40">
              Terms of Service
            </h4>
            <p className="leading-relaxed">
              By using Spire you agree to use the service in accordance with the
              law and not to re-upload content you do not own. We provide the
              service "as is" without warranties. Your access to third-party
              services (such as Google Drive) is governed by those providers'
              own terms.
            </p>

            <h4 className="mb-2 mt-4 text-[10px] font-bold tracking-widest uppercase text-white/40">
              Disclaimer
            </h4>
            <p className="leading-relaxed">
              These policies are subject to change. Continued use of the
              application after any changes constitutes acceptance of the revised
              terms.
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
