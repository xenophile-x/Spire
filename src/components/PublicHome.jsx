import React, { useEffect, useRef } from "react";

const features = [
  { name: "Cloud Streaming", icon: "graphic_eq" },
  { name: "Smart Library", icon: "library_music" },
  { name: "Playlists", icon: "queue_music" },
  { name: "Radio Stations", icon: "radio" },
  { name: "Spatial Audio", icon: "surround_sound" },
  { name: "Synced Lyrics", icon: "lyrics" },
  { name: "Karaoke", icon: "mic" },
  { name: "Library Sharing", icon: "folder_shared" },
  { name: "Backgrounds", icon: "wallpaper" },
  { name: "Edit", icon: "dashboard_customize" },
  { name: "Listen Together", icon: "group" },
  { name: "Discord Bot", icon: "sports_esports" },
  { name: "Recommendation", icon: "auto_awesome" },
  { name: "Crossfade", icon: "swap_horiz" },
  { name: "Equalizer", icon: "equalizer" },
  { name: "Auto Sync", icon: "cloud_download" },
  { name: "History", icon: "history" },
  { name: "Smart Search", icon: "search" },
  { name: "Multi Support", icon: "devices" },
  { name: "Cloud Backup", icon: "backup" },
];

export default function PublicHome({ onEnterExperience }) {
  const curlRef = useRef(null);

  useEffect(() => {
    const prevHtmlBg = document.documentElement.style.backgroundColor;
    const prevBodyBg = document.body.style.backgroundColor;
    document.documentElement.style.backgroundColor = '#000';
    document.body.style.backgroundColor = '#000';
    document.body.classList.add('bg-black');
    return () => {
      document.documentElement.style.backgroundColor = prevHtmlBg;
      document.body.style.backgroundColor = prevBodyBg;
      document.body.classList.remove('bg-black');
    };
  }, []);

  useEffect(() => {
    const onScroll = () => {
      if (!curlRef.current) return;
      const y = window.scrollY;
      const scale = 1 + Math.min(y * 0.00012, 0.08);
      const translate = Math.min(y * 0.04, 24);
      curlRef.current.style.transform = `scale(${scale}) translateY(${-translate}px)`;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="w-full bg-black text-white selection:bg-white/20 overflow-x-hidden font-sans select-none" onDragStart={(e) => e.preventDefault()}>
      {/* Top Logo */}
      <section className="relative flex min-h-screen flex-col items-center px-6 pt-20 md:pt-28 pb-0 z-20">
        <div className="flex flex-col items-center">
          <img 
            src="/logo.svg" 
            alt="Spire" 
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            className="h-[63px] w-auto md:h-[72px] object-contain opacity-70 hover:opacity-100 transition-opacity cursor-pointer invert select-none pointer-events-none"
          />
        </div>

        {/* Hero Text — dash removed as requested */}
        <div className="max-w-[820px] text-center mt-16 md:mt-20">
          <p className="text-[24px] md:text-[30px] lg:text-[38px] leading-[1.32] font-medium tracking-tight">
            <span className="text-[#8a8a93]">Spire is a personal cloud music player. It keeps your entire music library in your own Google Drive  upload your songs once and stream them anywhere. </span>
            <button
              onClick={onEnterExperience}
              className="text-white underline decoration-[#8a8a93]/40 underline-offset-[6px] hover:decoration-white transition-all cursor-pointer"
            >
              Get Started
            </button>
            <span className="text-[#8a8a93]">.</span>
          </p>
        </div>

        {/* Giant 3D Curl */}
        <div className="relative w-screen max-w-none mt-12 md:mt-16 flex justify-center pointer-events-none select-none overflow-hidden">
          <img
            ref={curlRef}
            src="/cur.png"
            alt="3D Visual"
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            className="w-[160vw] md:w-[130vw] lg:w-[115vw] max-w-[1800px] min-w-[900px] object-cover mix-blend-screen will-change-transform select-none pointer-events-none"
            style={{ transform: 'scale(1) translateY(0)' }}
          />
        </div>
      </section>

      {/* Spacing gap */}
      <div className="h-24 md:h-32 lg:h-48" aria-hidden />

      {/* Features Grid - gapless, horizontal gap decreased */}
      <section className="relative z-20 w-full max-w-[880px] mx-auto px-2 md:px-4 pb-16 md:pb-24">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-0  overflow-hidden ">
          {features.map((f) => (
            <div
              key={f.name}
              className="flex flex-col items-center justify-center gap-4 py-10 md:py-14 px-2 bg-black text-white transition-colors duration-300 group cursor-default"
            >
              <span 
                className="material-symbols-rounded leading-none group-hover:scale-[1.12] transition-transform duration-300 select-none"
                style={{ fontSize: '52px', lineHeight: 1, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 48" }}
              >
                {f.icon}
              </span>
              <span className="text-[13px] md:text-[14px] font-medium tracking-wide text-center text-white">
                {f.name}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Slight fading line */}
      <div className="w-full max-w-[700px] mx-auto h-[1px] bg-gradient-to-r from-transparent via-white/[0.12] to-transparent mt-12 md:mt-16" />

      {/* Footer */}
      <footer className="flex flex-col items-center justify-center pb-24 pt-16 text-center">
        <p className="text-[15px] text-white">Start your journey with Spire</p>
        <p className="text-[15px] text-[#8a8a93] mt-1 mb-8">Decentralize Yourself</p>
        
        <div className="flex items-center gap-5 text-[13px] font-medium text-[#8a8a93]">
          <a href="/privacypolicy" className="hover:text-white transition-colors">Privacy Policy</a>
          <span>·</span>
          <a href="/termsofservice" className="hover:text-white transition-colors">Terms of Service</a>
        </div>
      </footer>
      
    </div>
  );
}
