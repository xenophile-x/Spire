


const elementGraphs = new WeakMap();


function createReverbBuffer(ctx, duration = 3.5, decay = 3.0) {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const impulse = ctx.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);
  let peak = 0;
  for (let i = 0; i < length; i++) {
    const n = decay ** -(i / sampleRate);
    left[i] = (Math.random() * 2 - 1) * n;
    right[i] = (Math.random() * 2 - 1) * n;
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }


  if (peak > 0) {
    const gain = 0.85 / peak;
    for (let i = 0; i < length; i++) {
      left[i] *= gain;
      right[i] *= gain;
    }
  }
  return impulse;
}

export function getOrCreateElementGraph(audioElement) {
  let g = elementGraphs.get(audioElement);

  // Reuse the existing graph unless its AudioContext is dead.
  // Unconditionally rebuilding (old behaviour) closed the live context while
  // music was playing, causing an audible glitch and wiping user volume state.
  if (g && g.ctx.state !== "closed") {
    if (g.ctx.state === "suspended") {
      g.ctx.resume().catch(() => {});
    }
    return g;
  }

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx({ latencyHint: "interactive" });
  const musicSource = ctx.createMediaElementSource(audioElement);

  const masterGain = ctx.createGain();
  // Preserve prior volume if we're rebuilding after a closed context
  masterGain.gain.value = g?.masterGain?.gain.value ?? 1;
  musicSource.connect(masterGain);
  masterGain.connect(ctx.destination);

  g = {
    ctx,
    musicSource,
    masterGain,
    spatial: null,
    spatialConnected: false,
  };
  elementGraphs.set(audioElement, g);
  return g;
}


export function ensureSpatialNodes(g) {
  if (g.spatial) return g.spatial;
  const { ctx, musicSource } = g;

  const panner = ctx.createPanner();
  panner.panningModel = "HRTF";
  panner.distanceModel = "linear";
  panner.refDistance = 1;
  panner.maxDistance = 100;
  panner.positionX.value = 0;
  panner.positionY.value = 1.2;
  panner.positionZ.value = 5;


  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 24000;


  const convolver = ctx.createConvolver();
  convolver.buffer = createReverbBuffer(ctx);
  const dry = ctx.createGain();
  dry.gain.value = 1;
  const wet = ctx.createGain();
  wet.gain.value = 0;


  musicSource.connect(filter);
  filter.connect(dry);
  filter.connect(convolver);
  convolver.connect(wet);
  dry.connect(panner);
  wet.connect(panner);

  g.spatial = { panner, filter, convolver, dry, wet };
  return g.spatial;
}

export function getElementGraph(audioElement) {
  return elementGraphs.get(audioElement) || null;
}

export function cleanupElementGraph(audioElement) {
  const g = elementGraphs.get(audioElement);
  if (g) {
    g.ctx.close().catch(() => {});
    elementGraphs.delete(audioElement);
  }
}

export function resetElementGraph(audioElement) {
  const g = elementGraphs.get(audioElement);
  if (g) {
    g.ctx.close().catch(() => {});
  }
  elementGraphs.delete(audioElement);
}