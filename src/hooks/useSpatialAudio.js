import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getOrCreateElementGraph,
  ensureSpatialNodes,
  getElementGraph,
} from "@/utils/audioElementGraph";


export function useSpatialAudio(audioRef) {
  const [is8DActive, setIs8DActive] = useState(false);
  const [isReverbActive, setIsReverbActive] = useState(false);
  const [isNightcoreActive, setIsNightcoreActive] = useState(false);
  const animationRef = useRef(null);

  const sync = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;

    let g;
    try {
      g = getOrCreateElementGraph(el);
    } catch {
      return;
    }


    if (g.ctx.state === "suspended") {
      g.ctx.resume().catch(() => {});
    }

    const anyEffect = is8DActive || isReverbActive || isNightcoreActive;

    if (!anyEffect) {


      g.masterGain.gain.setTargetAtTime(1, g.ctx.currentTime, 0.1);
      if (g.spatialConnected && g.spatial) {
        try {
          g.spatial.panner.disconnect(g.ctx.destination);
        } catch {}
        g.spatialConnected = false;
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }


      if (el) {
        el.playbackRate = 1;
        el.preservesPitch = true;
        el.webkitPreservesPitch = true;
      }
      return;
    }

    try {
      const spatial = ensureSpatialNodes(g);

      g.masterGain.gain.setTargetAtTime(0, g.ctx.currentTime, 0.1);
      if (!g.spatialConnected) {
        spatial.panner.connect(g.ctx.destination);
        g.spatialConnected = true;
      }


      if (isReverbActive) {
        spatial.dry.gain.setTargetAtTime(0.6, g.ctx.currentTime, 0.1);
        spatial.wet.gain.setTargetAtTime(1.4, g.ctx.currentTime, 0.1);
      } else {
        spatial.dry.gain.setTargetAtTime(1.0, g.ctx.currentTime, 0.1);
        spatial.wet.gain.setTargetAtTime(0.0, g.ctx.currentTime, 0.1);
      }


      if (isNightcoreActive) {
        spatial.filter.type = "highpass";
        spatial.filter.frequency.setTargetAtTime(600, g.ctx.currentTime, 0.2);
        if (el) {
          el.playbackRate = 1.25;
          el.preservesPitch = false;
          el.webkitPreservesPitch = false;
        }
      } else {
        spatial.filter.type = "lowpass";
        spatial.filter.frequency.setTargetAtTime(24000, g.ctx.currentTime, 0.2);
        if (el) {
          el.playbackRate = 1;
          el.preservesPitch = true;
          el.webkitPreservesPitch = true;
        }
      }


      if (is8DActive) {
        if (!animationRef.current) {
          const start = performance.now();
          const orbit = (now) => {
            if (!audioRef.current || audioRef.current.paused) {
              animationRef.current = null;
              return;
            }
            const t = (now - start) / 1000;
            const speed = 0.8;
            const radius = 4;
            spatial.panner.positionX.setValueAtTime(
              Math.sin(t * speed) * radius,
              g.ctx.currentTime
            );
            spatial.panner.positionZ.setValueAtTime(
              Math.cos(t * speed) * radius,
              g.ctx.currentTime
            );
            spatial.panner.positionY.setValueAtTime(
              1.2 + Math.sin(t * speed * 2) * 0.4,
              g.ctx.currentTime
            );
            animationRef.current = requestAnimationFrame(orbit);
          };
          animationRef.current = requestAnimationFrame(orbit);
        }
      } else {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }


        spatial.panner.positionX.setTargetAtTime(0, g.ctx.currentTime, 0.1);
        spatial.panner.positionZ.setTargetAtTime(5, g.ctx.currentTime, 0.1);
        spatial.panner.positionY.setTargetAtTime(1.2, g.ctx.currentTime, 0.1);
      }
    } catch (err) {


      console.error("[SpatialAudio] Effect setup failed, restoring direct audio:", err);
      g.masterGain.gain.setTargetAtTime(1, g.ctx.currentTime, 0.05);
      if (g.spatialConnected && g.spatial) {
        try {
          g.spatial.panner.disconnect(g.ctx.destination);
        } catch {}
        g.spatialConnected = false;
      }
      if (el) {
        el.playbackRate = 1;
        el.preservesPitch = true;
        el.webkitPreservesPitch = true;
      }
    }
  }, [audioRef, is8DActive, isReverbActive, isNightcoreActive]);

  const syncRef = useRef(sync);
  syncRef.current = sync;

  useEffect(() => {
    sync();
  }, [sync]);

  const el = audioRef.current;
  useEffect(() => {
    if (is8DActive && el && !el.paused && !animationRef.current) {
      syncRef.current();
    }
  }, [is8DActive, el]);


  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onPlay = () => {
      const g = getElementGraph(el);
      if (g && g.ctx.state === "suspended") {
        g.ctx.resume().catch(() => {});
      }
      syncRef.current();
    };
    el.addEventListener("play", onPlay);
    return () => el.removeEventListener("play", onPlay);
  }, [audioRef]);


  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      const el = audioRef.current;
      if (!el) return;
      const g = getElementGraph(el);
      if (g && g.ctx.state === "suspended") {
        g.ctx.resume().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [audioRef]);

  useEffect(() => {
    const el = audioRef.current;
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);

      if (el) {
        el.playbackRate = 1;
        el.preservesPitch = true;
        el.webkitPreservesPitch = true;
      }
    };
  }, [audioRef]);

  const toggle8D = useCallback(() => setIs8DActive((v) => !v), []);
  const toggleReverb = useCallback(() => setIsReverbActive((v) => !v), []);
  const toggleNightcore = useCallback(() => setIsNightcoreActive((v) => !v), []);

  return useMemo(
    () => ({
      is8DActive,
      toggle8D,
      isReverbActive,
      toggleReverb,
      isNightcoreActive,
      toggleNightcore,
    }),
    [is8DActive, isReverbActive, isNightcoreActive, toggle8D, toggleReverb, toggleNightcore]
  );
}