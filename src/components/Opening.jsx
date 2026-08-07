import React, { useState, useEffect, useRef } from 'react';

// Mock audio synth to replace the missing import
const audioSynth = {
  enabled: false,
  volume: 0,
  playBurstSound: () => console.log('Burst sound played!'),
};

const SpeedLinesCanvas = ({ progress, lineCount = 72 }) => {
  const canvasRef = useRef(null);
  const pencilBarsRef = useRef([]);

  // Initialize concentrated 3D pencil cylinder tunnel
  useEffect(() => {
    // Full rainbow palette (exact hex spectrum) plus pink
    const openglColors = [
  "#333333",
  "#00b2ff",
  "#13e6a3",
  "#00e650",
  "#ffe600",
  "#ff5500",
  "#FF0000",
  "#8e00fe",
  "#ff007f"
];

    const bars = [];
    const ringCount = 10;
    const barsPerRing = Math.floor(Math.max(lineCount * 1.6, 112) / ringCount);

    let globalIndex = 0;

    for (let r = 0; r < ringCount; r++) {
      const zOffset = r * 110;
      for (let i = 0; i < barsPerRing; i++) {
        const angle = (i / barsPerRing) * Math.PI * 2 + r * 0.15 + (Math.random() - 0.5) * 0.08;

        // Cycle through the full rainbow palette
        const color = openglColors[globalIndex % openglColors.length];
        globalIndex++;

        const radius = 110 + (Math.random() - 0.5) * 2;
        const length = 380 + Math.random() * 320;
        const thick = 20 + Math.random() * 26;

        bars.push({ angle, zOffset, length, radius, thick, color });
      }
    }

    pencilBarsRef.current = bars;
  }, [lineCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;
      const focalLength = Math.min(width, height) * 0.85;

      // Pure white background matching OpenGL's glClearColor(1, 1, 1, 0)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);

      // Slowly dive further into the tunnel as progress advances
      const diveZ = Math.pow(progress, 2.5) * 5500;

      const sortedBars = [...pencilBarsRef.current]
        .map((bar) => {
          const relZ = 2000 + bar.zOffset - diveZ;
          return { ...bar, relZ };
        })
        .filter((b) => b.relZ > 5 && b.relZ < 5000);

      sortedBars.sort((a, b) => b.relZ - a.relZ);

      sortedBars.forEach((bar) => {
        const zNear = Math.max(1, bar.relZ);
        const zFar = bar.relZ + bar.length;
        if (zFar <= 0) return;

        const scaleNear = focalLength / zNear;
        const scaleFar = focalLength / Math.max(1, zFar);

        const xNearCenter = cx + Math.cos(bar.angle) * (bar.radius * scaleNear);
        const yNearCenter = cy + Math.sin(bar.angle) * (bar.radius * scaleNear);
        const xFarCenter = cx + Math.cos(bar.angle) * (bar.radius * scaleFar);
        const yFarCenter = cy + Math.sin(bar.angle) * (bar.radius * scaleFar);

        const thickNear = bar.thick * scaleNear * 0.9;
        const thickFar = bar.thick * scaleFar * 0.9;

        const sin = Math.sin(bar.angle);
        const cos = Math.cos(bar.angle);
        const nx = -sin;
        const ny = cos;

        const p1x = xNearCenter + nx * (thickNear / 2);
        const p1y = yNearCenter + ny * (thickNear / 2);
        const p2x = xFarCenter + nx * (thickFar / 2);
        const p2y = yFarCenter + ny * (thickFar / 2);
        const p4x = xNearCenter - nx * (thickNear / 2);
        const p4y = yNearCenter - ny * (thickNear / 2);

        const buildPath = () => {
          ctx.beginPath();
          ctx.moveTo(p1x, p1y);
          ctx.lineTo(p2x, p2y);
          ctx.arc(
            xFarCenter,
            yFarCenter,
            Math.max(1, thickFar / 2),
            bar.angle + Math.PI / 2,
            bar.angle - Math.PI / 2
          );
          ctx.lineTo(p4x, p4y);
          ctx.arc(
            xNearCenter,
            yNearCenter,
            Math.max(1, thickNear / 2),
            bar.angle - Math.PI / 2,
            bar.angle + Math.PI / 2
          );
          ctx.closePath();
        };

        // Soft blurred glow pass — feathers the edges like a motion blur
        ctx.save();
        ctx.filter = 'blur(9px)';
        ctx.globalAlpha = 0.55;
        buildPath();
        ctx.fillStyle = bar.color;
        ctx.fill();
        ctx.restore();

        // Sharp core pass on top for definition
        ctx.save();
        ctx.globalAlpha = 0.95;
        buildPath();
        ctx.fillStyle = bar.color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 0.6;
        ctx.stroke();
        ctx.restore();
      });
    };

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
      render();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [progress]);

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};

export default function App() {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const maxTime = 4.0;
  const lastPlayedTrigger = useRef(-1);

  // Sound sync trigger based on currentTime
  useEffect(() => {
    audioSynth.enabled = true;
    audioSynth.volume = 0.3;

    if (currentTime >= 0.1 && currentTime < 0.5 && lastPlayedTrigger.current !== 0) {
      audioSynth.playBurstSound();
      lastPlayedTrigger.current = 0;
    } else if (currentTime < 0.1) {
      lastPlayedTrigger.current = -1;
    }
  }, [currentTime]);

  // Main animation ticker loop — loops continuously instead of stopping
  useEffect(() => {
    let animationFrameId;
    let lastStamp = null;

    const tick = (stamp) => {
      if (!lastStamp) lastStamp = stamp;
      const delta = (stamp - lastStamp) / 1000;
      lastStamp = stamp;

      if (isPlaying) {
        setCurrentTime((prev) => {
          const next = prev + delta;
          if (next >= maxTime) {
            setIsPlaying(false);
            return maxTime; // Stop once, don't repeat
          }
          return next;
        });
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying]);

  // Speed burst progress normalized from 0 to 1
  const burstProgress = Math.min(1, Math.max(0, currentTime / maxTime));

  return (
    <div
      className="relative h-screen w-screen bg-[#ffffff] font-sans overflow-hidden select-none cursor-pointer"
      onClick={() => setIsPlaying(!isPlaying)}
    >
      {/* 3D pencil cylinder tunnel canvas */}
      <SpeedLinesCanvas progress={burstProgress} lineCount={72} />

      {currentTime >= maxTime && (
  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
    <h1
      className="text-4xl md:text-6xl text-black/60 leading-tight mb-4"
      style={{ fontFamily: "'Courier New', monospace", letterSpacing: '0.07em', fontWeight: 700 }}
    >
      Welcome to Spire !
    </h1>
    <p className="text-sm text-black/30 font-mono hover:text-black/50">Press Enter to continue</p>
  </div>
)}
    </div>
  );
}