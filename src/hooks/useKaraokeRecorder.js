import { useCallback, useEffect, useRef, useState } from "react";
import {
  getOrCreateElementGraph,
  getElementGraph,
} from "@/utils/audioElementGraph";


const PREFERRED_MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

function pickMimeType() {
  if (typeof window.MediaRecorder === "undefined") return undefined;
  return PREFERRED_MIME_TYPES.find((t) => window.MediaRecorder.isTypeSupported(t));
}

export function useKaraokeRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState(null);
  const [recordingBlob, setRecordingBlob] = useState(null);
  const [recordingError, setRecordingError] = useState(null);
  const [recordingWarning, setRecordingWarning] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [monitorEnabled, setMonitorEnabled] = useState(false);

  const sessionRef = useRef({
    recorder: null,
    ctx: null,
    capture: null,
    compressor: null,
    musicGain: null,
    micSource: null,
    micGain: null,
    monitorGain: null,
    micStream: null,
    timer: null,
    startedAt: 0,
    previewUrl: null,
    starting: false,
    audioElement: null,
    musicVolume: 0.7,
    micVolume: 3.0,
    monitorEnabled: false,
    musicProbeTimer: null,
    voiceFilter: null,
    voicePresence: null,
    voiceCompressor: null,
    voiceMakeup: null,
    // Sidechain ducking
    duckGain: null,
    duckAnalyser: null,
    duckInterval: null,
  });


  const setRecordingLevels = useCallback((music, mic) => {
    const session = sessionRef.current;
    session.musicVolume = music;
    session.micVolume = mic;
    if (session.ctx && session.musicGain) {
      session.musicGain.gain.setTargetAtTime(music, session.ctx.currentTime, 0.01);
    }
    if (session.ctx && session.micGain) {
      session.micGain.gain.setTargetAtTime(mic, session.ctx.currentTime, 0.01);
    }
  }, []);


  const setMonitor = useCallback((enabled) => {
    const session = sessionRef.current;
    session.monitorEnabled = enabled;
    setMonitorEnabled(enabled);
    if (session.ctx && session.monitorGain) {
      session.monitorGain.gain.setTargetAtTime(enabled ? 0.3 : 0, session.ctx.currentTime, 0.01);
    }
  }, []);


  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      const session = sessionRef.current;
      if (!session.audioElement) return;
      const g = getElementGraph(session.audioElement);
      if (g && g.ctx && g.ctx.state === "suspended") {
        g.ctx.resume().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {


    const session = sessionRef.current;
    return () => {
      if (session.timer) clearInterval(session.timer);
      if (session.musicProbeTimer) clearTimeout(session.musicProbeTimer);
      if (session.duckInterval) {
        clearInterval(session.duckInterval);
        session.duckInterval = null;
      }
      try { session.duckGain?.disconnect(); } catch {}
      try { session.duckAnalyser?.disconnect(); } catch {}
      if (session.recorder && session.recorder.state !== "inactive") {
        try {
          session.recorder.stop();
        } catch {}
      }
      if (session.micStream) {
        session.micStream.getTracks().forEach((track) => track.stop());
      }
      if (session.musicSource && session.musicGain) {
        try {
          session.musicSource.disconnect(session.musicGain);
        } catch {}
      }
      try { session.musicGain?.disconnect(); } catch {}
      try { session.micSource?.disconnect(); } catch {}
      try { session.micGain?.disconnect(); } catch {}
      try { session.monitorGain?.disconnect(); } catch {}
      try { session.compressor?.disconnect(); } catch {}
      try { session.voiceFilter?.disconnect(); } catch {}
      try { session.voicePresence?.disconnect(); } catch {}
      try { session.voiceCompressor?.disconnect(); } catch {}
      try { session.voiceMakeup?.disconnect(); } catch {}

      if (session.isFallbackCtx && session.ctx) {
        session.ctx.close().catch(() => {});
      }
    };
  }, []);

  const stopTimer = useCallback(() => {
    const session = sessionRef.current;
    if (session.timer) {
      clearInterval(session.timer);
      session.timer = null;
    }
  }, []);

  const startRecording = useCallback(
    async (audioElement) => {
      const session = sessionRef.current;

      if (session.recorder && session.recorder.state === "recording") return;
      if (session.starting) return;
      if (!audioElement || !audioElement.src) {
        setRecordingError("Start playing a song first, then hit Record.");
        return;
      }
      if (typeof window.MediaRecorder === "undefined") {
        setRecordingError("Recording is not supported in this browser. Try Chrome or Safari.");
        return;
      }


      session.starting = true;
      try {
        let ctx;
        let musicSource = null;
        let isFallbackCtx = false;
        try {
          const g = getOrCreateElementGraph(audioElement);
          ctx = g.ctx;
          musicSource = g.musicSource;
          session.audioElement = audioElement;
          session.musicSource = musicSource;
          if (ctx.state === "suspended") {
            await ctx.resume();
          }
        } catch (err) {
          console.warn(
            "[KaraokeRecorder] Music routing unavailable — recording voice only:",
            err
          );
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          ctx = new AudioCtx({ latencyHint: "interactive" });
          isFallbackCtx = true;
          if (ctx.state === "suspended") {
            await ctx.resume();
          }
          setRecordingWarning(
            "Music could not be mixed into this recording — voice only."
          );
        }

        session.ctx = ctx;
        session.isFallbackCtx = isFallbackCtx;

        if (session.musicSource && session.musicGain) {
          try {
            session.musicSource.disconnect(session.musicGain);
          } catch {}
        }
        if (session.musicGain) {
          try { session.musicGain.disconnect(); } catch {}
          session.musicGain = null;
        }
        if (session.micSource) {
          try { session.micSource.disconnect(); } catch {}
          session.micSource = null;
        }
        if (session.micGain) {
          try { session.micGain.disconnect(); } catch {}
          session.micGain = null;
        }
        if (session.monitorGain) {
          try { session.monitorGain.disconnect(); } catch {}
          session.monitorGain = null;
        }
        if (session.voiceFilter) {
          try { session.voiceFilter.disconnect(); } catch {}
          session.voiceFilter = null;
        }
        if (session.voicePresence) {
          try { session.voicePresence.disconnect(); } catch {}
          session.voicePresence = null;
        }
        if (session.voiceCompressor) {
          try { session.voiceCompressor.disconnect(); } catch {}
          session.voiceCompressor = null;
        }
        if (session.voiceMakeup) {
          try { session.voiceMakeup.disconnect(); } catch {}
          session.voiceMakeup = null;
        }
        if (session.duckInterval) {
          clearInterval(session.duckInterval);
          session.duckInterval = null;
        }
        try { session.duckGain?.disconnect(); } catch {}
        try { session.duckAnalyser?.disconnect(); } catch {}
        session.duckGain = null;
        session.duckAnalyser = null;
        if (session.micStream) {
          session.micStream.getTracks().forEach((track) => track.stop());
          session.micStream = null;
        }

        if (!session.monitorEnabled) {
          setRecordingWarning("For clearest results, use headphones while recording.");
        }

        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: { ideal: false },
            noiseSuppression: { ideal: false },
            autoGainControl: { ideal: true },
            channelCount: { ideal: 1 },
          },
        });

        session.micStream = micStream;

        const audioTracks = micStream.getAudioTracks();
        if (!audioTracks.length || audioTracks[0].readyState !== "live") {
          micStream.getTracks().forEach((track) => track.stop());
          throw new Error("Mic stream has no live audio track.");
        }

        // Re-check and ensure context is running
        if (ctx.state === "suspended") {
          await ctx.resume();
        }

      const capture = ctx.createMediaStreamDestination();

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -12;
      compressor.knee.value = 30;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;
      compressor.connect(capture);

      const musicGain = ctx.createGain();
      musicGain.gain.value = session.musicVolume;

      // Sidechain ducking: music → duckGain → compressor
      const duckGain = ctx.createGain();
      duckGain.gain.value = 1;

      if (musicSource) {
        musicSource.connect(musicGain);
        musicGain.connect(duckGain);
        duckGain.connect(compressor);
      }

      // High-clarity vocal bus: rumble filter -> presence boost -> user mic gain -> vocal compressor -> makeup gain
      const micSource = ctx.createMediaStreamSource(micStream);

      const voiceFilter = ctx.createBiquadFilter();
      voiceFilter.type = "highpass";
      voiceFilter.frequency.value = 80;

      const voicePresence = ctx.createBiquadFilter();
      voicePresence.type = "peaking";
      voicePresence.frequency.value = 3200;
      voicePresence.gain.value = 3.5;
      voicePresence.Q.value = 1.0;

      const micGain = ctx.createGain();
      micGain.gain.value = session.micVolume;

      const voiceCompressor = ctx.createDynamicsCompressor();
      voiceCompressor.threshold.value = -24;
      voiceCompressor.knee.value = 20;
      voiceCompressor.ratio.value = 3.5;
      voiceCompressor.attack.value = 0.003;
      voiceCompressor.release.value = 0.18;

      const voiceMakeup = ctx.createGain();
      voiceMakeup.gain.value = 2.6;

      micSource.connect(voiceFilter);
      voiceFilter.connect(voicePresence);
      voicePresence.connect(micGain);
      micGain.connect(voiceCompressor);
      voiceCompressor.connect(voiceMakeup);
      voiceMakeup.connect(capture);

      // Active real-time vocal ducking: slightly dips background music during active singing
      const duckAnalyser = ctx.createAnalyser();
      duckAnalyser.fftSize = 256;
      micSource.connect(duckAnalyser);
      const duckBuffer = new Float32Array(duckAnalyser.fftSize);

      session.duckInterval = setInterval(() => {
        try {
          if (!session.recorder || session.recorder.state !== "recording") return;
          duckAnalyser.getFloatTimeDomainData(duckBuffer);
          let sum = 0;
          for (let i = 0; i < duckBuffer.length; i++) {
            sum += duckBuffer[i] * duckBuffer[i];
          }
          const rms = Math.sqrt(sum / duckBuffer.length);
          if (rms > 0.012) {
            duckGain.gain.setTargetAtTime(0.72, ctx.currentTime, 0.04);
          } else {
            duckGain.gain.setTargetAtTime(1.0, ctx.currentTime, 0.35);
          }
        } catch {}
      }, 50);

      const monitorGain = ctx.createGain();
      monitorGain.gain.value = session.monitorEnabled ? 0.3 : 0;
      micSource.connect(monitorGain);
      monitorGain.connect(ctx.destination);


        const mimeType = pickMimeType();
        const recorder = mimeType
          ? new MediaRecorder(capture.stream, { mimeType })
          : new MediaRecorder(capture.stream);

        const chunks = [];


        let recorderErrored = false;
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };
        recorder.onstop = () => {

          if (session.musicSource && session.musicGain) {
            try {
              session.musicSource.disconnect(session.musicGain);
            } catch {}
          }
          try {
            musicGain.disconnect();
          } catch {}
          try {
            micSource.disconnect();
          } catch {}
          try {
            micGain.disconnect();
          } catch {}
          try {
            monitorGain.disconnect();
          } catch {}
          try {
            compressor.disconnect();
          } catch {}
          try {
            voiceFilter.disconnect();
          } catch {}
          try {
            voicePresence.disconnect();
          } catch {}
          try {
            voiceCompressor.disconnect();
          } catch {}
          try {
            voiceMakeup.disconnect();
          } catch {}
          // Sidechain ducking cleanup
          if (session.duckInterval) {
            clearInterval(session.duckInterval);
            session.duckInterval = null;
          }
          try { session.duckGain?.disconnect(); } catch {}
          try { session.duckAnalyser?.disconnect(); } catch {}
          session.duckGain = null;
          session.duckAnalyser = null;


          const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });

          session.recorder = null;
          session.capture = null;
          session.musicGain = null;
          session.musicSource = null;
          session.micSource = null;
          session.micGain = null;
          session.monitorGain = null;
          session.voiceFilter = null;
          session.voicePresence = null;
          session.voiceCompressor = null;
          session.voiceMakeup = null;
          if (session.micStream) {
            session.micStream.getTracks().forEach((track) => track.stop());
            session.micStream = null;
          }
          const durationSec = Math.max(1, (Date.now() - session.startedAt) / 1000);
          setRecordedDuration(durationSec);
          session.recordedDuration = durationSec;
          stopTimer();
          setElapsed(0);

          if (recorderErrored) {


            setIsRecording(false);
            return;
          }

          if (blob.size === 0) {
            if (session.previewUrl) {
              URL.revokeObjectURL(session.previewUrl);
              session.previewUrl = null;
            }
            setRecordingUrl(null);
            setRecordingBlob(null);
            setRecordingError(
              "Recording captured no audio — check your mic and try again."
            );
            setIsRecording(false);
            return;
          }

          if (session.previewUrl) URL.revokeObjectURL(session.previewUrl);
          const url = URL.createObjectURL(blob);
          session.previewUrl = url;
          setRecordingBlob(blob);
          setRecordingUrl(url);
          setRecordingError(null);
          setIsRecording(false);
        };
        recorder.onerror = (e) => {
          console.error("[KaraokeRecorder] Recording error:", e.error);
          recorderErrored = true;
          setRecordingError("Recording failed. Try again.");
          try {
            recorder.stop();
          } catch {}

          if (session.micStream) {
            session.micStream.getTracks().forEach((track) => track.stop());
            session.micStream = null;
          }

          if (session.musicSource && session.musicGain) {
            try {
              session.musicSource.disconnect(session.musicGain);
            } catch {}
          }
          session.musicSource = null;
          try { musicGain.disconnect(); } catch {}
          try { micSource.disconnect(); } catch {}
          try { micGain.disconnect(); } catch {}
          try { monitorGain.disconnect(); } catch {}
          try { compressor.disconnect(); } catch {}
          try { voiceFilter.disconnect(); } catch {}
          try { voicePresence.disconnect(); } catch {}
          try { voiceCompressor.disconnect(); } catch {}
          try { voiceMakeup.disconnect(); } catch {}
          // Sidechain ducking cleanup
          if (session.duckInterval) {
            clearInterval(session.duckInterval);
            session.duckInterval = null;
          }
          try { session.duckGain?.disconnect(); } catch {}
          try { session.duckAnalyser?.disconnect(); } catch {}
          session.duckGain = null;
          session.duckAnalyser = null;
          setIsRecording(false);
          stopTimer();
        };

        session.recorder = recorder;
        session.capture = capture;
        session.musicGain = musicGain;
        session.micSource = micSource;
        session.micGain = micGain;
        session.micStream = micStream;
        session.monitorGain = monitorGain;
        session.voiceFilter = voiceFilter;
        session.voiceCompressor = voiceCompressor;
        session.voiceMakeup = voiceMakeup;
        session.startedAt = Date.now();
        setElapsed(0);
        setRecordingError(null);
        setRecordingWarning(null);
        setRecordingBlob(null);
        setRecordingUrl(null);
        setIsRecording(true);
        recorder.start();


        if (musicSource && !audioElement.paused) {
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 512;
          musicSource.connect(analyser);

          if (session.musicProbeTimer) clearTimeout(session.musicProbeTimer);
          session.musicProbeTimer = setTimeout(() => {
            session.musicProbeTimer = null;
            try {
              if (audioElement.paused) return;
              const data = new Float32Array(analyser.fftSize);
              analyser.getFloatTimeDomainData(data);
              let sum = 0;
              for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
              const rms = Math.sqrt(sum / data.length);
              if (rms < 0.0005 && !audioElement.paused && audioElement.currentTime > 1) {
                setRecordingWarning(
                  "Music may not be audible in this recording — check your audio and try again."
                );
              }
            } catch (err) {
              console.warn("[KaraokeRecorder] Music probe failed:", err);
            } finally {
              try {
                analyser.disconnect();
              } catch {}
            }
          }, 1800);
        }

        stopTimer();
        session.timer = setInterval(() => {
          setElapsed(Math.floor((Date.now() - session.startedAt) / 1000));
        }, 100);
      } catch (err) {
        console.error("[KaraokeRecorder] Mic access error:", err);
        setRecordingError(
          err.name === "NotAllowedError"
            ? "Microphone access was denied. Allow the mic in your browser to record."
            : "Could not start the microphone."
        );


        if (session.micStream) {
          session.micStream.getTracks().forEach((track) => track.stop());
          session.micStream = null;
        }
        stopTimer();
        setIsRecording(false);
      } finally {
        session.starting = false;
      }
    },
    [stopTimer]
  );

  const stopRecording = useCallback(() => {
    const session = sessionRef.current;
    if (session.recorder && session.recorder.state === "recording") {
      session.recorder.stop();
    }
  }, []);

  const discardRecording = useCallback(() => {
    const session = sessionRef.current;
    if (session.previewUrl) {
      URL.revokeObjectURL(session.previewUrl);
      session.previewUrl = null;
    }
    setRecordingUrl(null);
    setRecordingBlob(null);
    setRecordingError(null);
    setRecordingWarning(null);
    setElapsed(0);
    setRecordedDuration(0);
  }, []);

  return {
    isRecording,
    recordingUrl,
    recordingBlob,
    recordingError,
    recordingWarning,
    elapsed,
    recordedDuration,
    monitorEnabled,
    startRecording,
    stopRecording,
    discardRecording,
    setRecordingLevels,
    setMonitor,
  };
}
