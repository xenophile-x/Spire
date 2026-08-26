import React, { useState, useEffect, useRef, useCallback } from 'react';

const SpeedLinesCanvas = ({ progress, lineCount = 72 }) => {
  const canvasRef = useRef(null);
  const pencilBarsRef = useRef([]);

  useEffect(() => {
    const openglColors = [
      "#333333", "#00b2ff", "#13e6a3", "#00e650",
      "#ffe600", "#ff5500", "#FF0000", "#8e00fe", "#ff007f"
    ];

    const bars = [];
    const ringCount = 10;
    const barsPerRing = Math.floor(Math.max(lineCount * 1.6, 112) / ringCount);

    let globalIndex = 0;

    for (let r = 0; r < ringCount; r++) {
      const zOffset = r * 110;
      for (let i = 0; i < barsPerRing; i++) {
        const angle = (i / barsPerRing) * Math.PI * 2 + r * 0.15 + (Math.random() - 0.5) * 0.08;
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
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.clientWidth || canvas.width;
      const height = canvas.clientHeight || canvas.height;
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cx = width / 2;
      const cy = height / 2;
      const focalLength = Math.min(width, height) * 0.85;

      ctx.clearRect(0, 0, width, height);

      const diveZ = Math.pow(progress, 2.5) * 5500;

      const visible = [];
      for (const bar of pencilBarsRef.current) {
        const relZ = 2000 + bar.zOffset - diveZ;
        if (relZ > 5 && relZ < 5000) {
          visible.push({ bar, relZ });
        }
      }
      visible.sort((a, b) => b.relZ - a.relZ);

      const buildBarPath = (bar, relZ) => {
        const zNear = Math.max(1, relZ);
        const zFar = relZ + bar.length;
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

        ctx.moveTo(xNearCenter + nx * (thickNear / 2), yNearCenter + ny * (thickNear / 2));
        ctx.lineTo(xFarCenter + nx * (thickFar / 2), yFarCenter + ny * (thickFar / 2));
        ctx.arc(xFarCenter, yFarCenter, Math.max(1, thickFar / 2), bar.angle + Math.PI / 2, bar.angle - Math.PI / 2);
        ctx.lineTo(xNearCenter - nx * (thickNear / 2), yNearCenter - ny * (thickNear / 2));
        ctx.arc(xNearCenter, yNearCenter, Math.max(1, thickNear / 2), bar.angle - Math.PI / 2, bar.angle + Math.PI / 2);
        ctx.closePath();
      };

      const byColor = new Map();
      for (const { bar } of visible) {
        if (!byColor.has(bar.color)) byColor.set(bar.color, []);
        byColor.get(bar.color).push(bar);
      }

      ctx.filter = 'blur(9px)';
      ctx.globalAlpha = 0.55;
      for (const [color, barsOfColor] of byColor) {
        ctx.beginPath();
        for (const { bar, relZ } of barsOfColor) buildBarPath(bar, relZ);
        ctx.fillStyle = color;
        ctx.fill();
      }
      ctx.filter = 'none';
      ctx.globalAlpha = 0.95;
      for (const { bar, relZ } of visible) {
        ctx.beginPath();
        buildBarPath(bar, relZ);
        ctx.fillStyle = bar.color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    let rafId = requestAnimationFrame(render);
    window.addEventListener('resize', render);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', render);
    };
  }, [progress]);

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};

export default function Opening({ onComplete }) {
  const [hasStarted, setHasStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const maxTime = 4.0;
  const audioRef = useRef(null);
  const timeRef = useRef(0);
  const hasStartedRef = useRef(false);
  const isPlayingRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  hasStartedRef.current = hasStarted;
  isPlayingRef.current = isPlaying;

  useEffect(() => {
    const audio = new Audio('/boot.mp3');
    audio.volume = 0.6;
    audio.addEventListener('error', () => console.log("Boot audio unavailable"));
    audioRef.current = audio;

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  const finish = useCallback(() => {
    if (onCompleteRef.current) onCompleteRef.current();
  }, []);

  const startSequence = useCallback(() => {
    if (hasStartedRef.current) return;
    setHasStarted(true);
    setIsPlaying(true);
    if (audioRef.current) {
      audioRef.current.play().catch((err) => console.log("Audio play failed:", err));
    }
  }, []);

  const handleBackgroundClick = useCallback(() => {
    if (!hasStartedRef.current) return;

    if (timeRef.current >= maxTime) {
      finish();
    } else {
      const next = !isPlayingRef.current;
      setIsPlaying(next);
      if (audioRef.current) {
        if (next) {
          audioRef.current.play().catch(() => {});
        } else {
          audioRef.current.pause();
        }
      }
    }
  }, [finish]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Enter") {
        if (!hasStartedRef.current) {
          startSequence();
        } else if (timeRef.current >= maxTime) {
          finish();
        } else {
          timeRef.current = maxTime;
          setCurrentTime(maxTime);
          setIsPlaying(false);
          if (audioRef.current) audioRef.current.pause();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [startSequence, finish]);

  useEffect(() => {
    if (!isPlaying) return;

    let animationFrameId;
    let lastStamp = null;
    let lastUiUpdate = 0;

    const tick = (stamp) => {
      if (!lastStamp) lastStamp = stamp;
      const delta = (stamp - lastStamp) / 1000;
      lastStamp = stamp;

      const next = timeRef.current + delta;
      timeRef.current = next;

      if (next >= maxTime) {
        timeRef.current = maxTime;
        setCurrentTime(maxTime);
        setIsPlaying(false);
        return;
      }

      if (stamp - lastUiUpdate > 33) {
        lastUiUpdate = stamp;
        setCurrentTime(next);
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying]);

  useEffect(() => {
    if (hasStarted && currentTime >= maxTime) {
      const timer = setTimeout(finish, 1200);
      return () => clearTimeout(timer);
    }
  }, [currentTime, hasStarted, finish]);

  const burstProgress = Math.min(1, Math.max(0, currentTime / maxTime));

  return (
    <div
      className="relative h-screen w-screen bg-[#ffffff] font-sans overflow-hidden select-none cursor-pointer flex items-center justify-center"
      onClick={handleBackgroundClick}
    >
      <SpeedLinesCanvas progress={burstProgress} lineCount={72} />

      <div
        className={`absolute inset-0 z-50 flex items-center justify-center bg-white transition-opacity duration-500 ${
          hasStarted ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            startSequence();
          }}
          className="px-8 py-3 bg-white text-gray-500 font-medium tracking-wide rounded-full border border-gray-200 shadow-sm transition-all duration-300 ease-out hover:scale-105 hover:shadow-md hover:text-gray-800 focus:outline-none"
        >
          Press Enter to continue
        </button>
      </div>
    </div>
  );
}
