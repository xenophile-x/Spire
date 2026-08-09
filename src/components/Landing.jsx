import React, { useState, useEffect } from "react";

const DEFAULT_BG_IMAGE =
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=2070&auto=format&fit=crop";

const apps = [
  // Row 1
  { name: "Instagram", iconPath: "/instagram.png" },
  { name: "LinkedIn", iconPath: "/linkedin.png" },
  { name: "Snapchat", iconPath: "/snapchat.png" },
  { name: "Pinterest", iconPath: "/pinterest.png" },
  // Row 2
  { name: "Earth", iconPath: "/earth.png" },
  { name: "Discord", iconPath: "/discord.png" },
  { name: "WhatsApp", iconPath: "/whatsapp.png" },
  // Row 3
  { name: "Facebook", iconPath: "/facebook.png" },
  { name: "Reddit", iconPath: "/reddit.png" },
  { name: "Spire", iconPath: "/spire.png", isMain: true },
];

// Row layout: 4 - 3 - 3
const rows = [
  apps.slice(0, 4),
  apps.slice(4, 7),
  apps.slice(7, 10),
];

export default function Landing({ onLaunchSpire }) {
  const [activeApp, setActiveApp] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleAppClick = (appName) => {
    setActiveApp(appName);

    if (appName === "Spire") {
      setTimeout(() => {
        setActiveApp(null);
        if (onLaunchSpire) onLaunchSpire();
      }, 600);
    } else {
      setTimeout(() => setActiveApp(null), 800);
    }
  };

  let globalIndex = 0;

  return (
    <>
      <style>{`
        @keyframes iconAppear {
          0% {
            opacity: 0;
            transform: scale(0.3) translateY(30px);
          }
          60% {
            opacity: 1;
            transform: scale(1.08) translateY(-4px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes dotPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        /* Outer button controls the scale of the entire item (icon + text) */
        .app-btn {
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .app-btn:hover {
          transform: scale(1.12);
        }
        .app-btn:active, .app-btn.pressed {
          transform: scale(0.88);
        }

        /* Inner circle exclusively handles the shadow */
        .app-icon-circle {
          transition: box-shadow 0.3s ease;
        }
        .app-btn:hover .app-icon-circle {
          box-shadow: 0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.4) !important;
        }
        .app-btn.pressed .app-icon-circle {
          box-shadow: 0 2px 10px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2) !important;
        }
      `}</style>

      <div
        className="relative flex h-screen w-screen flex-col items-center justify-center overflow-hidden"
        style={{ backgroundImage: `url("${DEFAULT_BG_IMAGE}")`, backgroundSize: "cover", backgroundPosition: "center" }}
      >
        {/* Subtle dark overlay without blur */}
        <div className="absolute inset-0 z-0 bg-black/40" />

        {/* App icon grid */}
        <div className="relative z-10 flex flex-col items-center gap-8">
          {rows.map((row, rowIdx) => (
            <div key={rowIdx} className="flex items-start justify-center gap-10">
              {row.map((app) => {
                const idx = globalIndex++;
                return (
                  <button
                    key={app.name}
                    onClick={() => handleAppClick(app.name)}
                    disabled={activeApp === app.name}
                    className={`app-btn flex flex-col items-center gap-2 bg-transparent border-none outline-none cursor-pointer group ${
                      activeApp === app.name ? "pressed" : ""
                    }`}
                    style={{
                      opacity: mounted ? 1 : 0,
                      animation: mounted ? `iconAppear 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) ${idx * 0.07}s both` : "none",
                    }}
                  >
                    {/* Icon circle (Shadow applied only here) */}
                    <div
                      className="app-icon-circle flex items-center justify-center rounded-full overflow-hidden"
                      style={{
                        width: "80px",
                        height: "80px",
                        background: "transparent",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)",
                      }}
                    >
                      {app.iconPath && (
                        <img
                          src={app.iconPath}
                          alt={`${app.name} Logo`}
                          className="w-full h-full object-cover rounded-full"
                        />
                      )}
                    </div>
                    {/* Label */}
                    <span
                      className="text-xs font-medium tracking-wide"
                      style={{
                        color: "rgba(255,255,255,0.85)",
                        textShadow: "0 1px 4px rgba(0,0,0,0.6)",
                        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
                      }}
                    >
                      {app.name}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Page dots indicator (Google Material Icon style SVGs) */}
        <div className="relative z-10 mt-14 flex items-center gap-2">
          {/* Active Dot */}
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-2.5 h-2.5 text-white/90"
            style={{ animation: "dotPulse 2s ease-in-out infinite" }}
          >
            <circle cx="12" cy="12" r="12" />
          </svg>
          
          {/* Inactive Dot 1 */}
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-2.5 h-2.5 text-white/35"
          >
            <circle cx="12" cy="12" r="12" />
          </svg>
          
          {/* Inactive Dot 2 */}
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-2.5 h-2.5 text-white/35"
          >
            <circle cx="12" cy="12" r="12" />
          </svg>
        </div>
      </div>
    </>
  );
}