import React, { useState, useEffect, useRef } from "react";
import { PageDot } from "@/assets/icons";

const DEFAULT_BG_IMAGE =
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=2070&auto=format&fit=crop";

const apps = [

  { name: "Instagram", iconPath: "/instagram.png" },
  { name: "LinkedIn", iconPath: "/linkedin.png" },
  { name: "Snapchat", iconPath: "/snapchat.png" },
  { name: "Pinterest", iconPath: "/pinterest.png" },

  { name: "Earth", iconPath: "/earth.png" },
  { name: "Discord", iconPath: "/discord.png" },
  { name: "WhatsApp", iconPath: "/whatsapp.png" },

  { name: "Facebook", iconPath: "/facebook.png" },
  { name: "Reddit", iconPath: "/reddit.png" },
  { name: "Spire", iconPath: "/spire.png", isMain: true },
];


const rows = [
  apps.slice(0, 4),
  apps.slice(4, 7),
  apps.slice(7, 10),
];

export default function Landing({ onLaunchSpire, onSignIn }) {
  const [activeApp, setActiveApp] = useState(null);
  const [mounted, setMounted] = useState(false);
  const timersRef = useRef([]);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => {
      clearTimeout(timer);
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  const handleAppClick = (appName) => {
    setActiveApp(appName);

    if (appName === "Spire") {
      timersRef.current.push(
        setTimeout(() => {
          setActiveApp(null);
          if (onLaunchSpire) onLaunchSpire();
        }, 600)
      );
    } else {
      timersRef.current.push(setTimeout(() => setActiveApp(null), 800));
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

        
        .app-btn {
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .app-btn:hover {
          transform: scale(1.12);
        }
        .app-btn:active, .app-btn.pressed {
          transform: scale(0.88);
        }

        
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

        <div className="absolute inset-0 z-0 bg-black/40" />


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
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover rounded-full"
                        />
                      )}
                    </div>

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


        <div className="relative z-10 mt-14 flex items-center gap-2">
          <PageDot active pulse />
          <PageDot />
          <PageDot />
        </div>

        {onSignIn && (
          <button
            onClick={onSignIn}
            className="fixed bottom-8 z-20 flex items-center justify-center gap-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 px-6 py-3 text-sm font-medium text-white hover:bg-white/20 hover:scale-105 transition-all active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v4.84h9.43c-.4 2.19-1.54 4.07-3.23 5.47l5.59 4.32c3.27-3.02 5.17-7.42 5.17-12.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.33-.99-.53-2.05-.53-3.09s.2-2.1.53-3.09l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.98-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-6.85-6.85c-1.89 1.22-4.3 1.94-7.04 1.94-5.26 0-9.57-3.22-11.17-7.53l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            Continue with Google
          </button>
        )}
      </div>
    </>
  );
}