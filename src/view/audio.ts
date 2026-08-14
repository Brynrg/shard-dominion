// ── Audio engine: procedural WebAudio SFX + generative music (view-only) ───────
// FG-1: the game's first sound. Everything is SYNTHESIZED (oscillators + filtered
// noise) — no asset files, IP-clean, retro-fitting the late-90s aesthetic; painted/
// recorded SFX can replace individual voices later without touching call sites.
//
// PURITY: this is a VIEW module. The sim never touches it; events are emitted from
// the renderer's existing sim-transition diff (the same pass that spawns FX) and
// from input. Math.random is fine here (view-side, like particles).
//
// Browsers gate audio behind a user gesture → resume() is called from the briefing
// dismiss click. Every voice self-throttles so 20 units firing ≠ 20 overlapping
// buffers. Volume/mute persist to localStorage.

export interface AudioEngine {
  /** Unlock/resume the AudioContext (call from a user-gesture handler). */
  resume(): void;
  setVolume(v: number): void;
  getVolume(): number;
  setMuted(m: boolean): void;
  isMuted(): boolean;
  /** Start the generative music bed (idempotent). */
  startMusic(): void;
  // ── SFX events (each self-throttles) ──
  click(): void;          // UI button
  denied(): void;         // v0.52: build click refused (insufficient funds/tier/prereq)
  select(): void;         // unit selected
  ack(): void;            // move/attack order acknowledged
  shot(rocket: boolean): void;
  explosion(big: boolean): void;
  place(): void;          // structure placed
  trainReady(): void;     // unit finished training
  dock(): void;           // harvester deposit complete
  baseUnderAttack(): void;
  harvesterUnderAttack(): void;
  matchEnd(won: boolean): void;
  /** For gates/telemetry: context state, voices played, mute state, combat music intensity. */
  debug(): { state: string; played: number; muted: boolean; combatIntensity: number };
}

const STORE_KEY = 'shardDominion.audio';

export function makeAudioEngine(): AudioEngine {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let noiseBuf: AudioBuffer | null = null;
  let musicOn = false;
  let played = 0;
  let volume = 0.7;
  let muted = false;
  const lastAt = new Map<string, number>(); // throttle: voice key → last play (ctx time)

  // ── Adaptive-music state (audio-design: vertical layering + ducking) ──────
  // Combat intensity is a leaky integrator fed by the shot/explosion voices
  // that already fire during battle — no sim wiring needed. The combat music
  // layer's gain follows it; EVA alerts duck the whole music bus briefly.
  let musicBus: GainNode | null = null;   // everything musical routes here
  let combatLayerGain: GainNode | null = null;
  let combatIntensity = 0;                // 0..1, decays over ~8s
  let lastIntensityAt = 0;                // ctx time of last bump/decay eval
  const MUSIC_BUS_LEVEL = 0.16;

  function bumpIntensity(amount: number): void {
    if (!ctx) return;
    decayIntensity();
    combatIntensity = Math.min(1, combatIntensity + amount);
    applyCombatLayer();
  }
  function decayIntensity(): void {
    if (!ctx) return;
    const now = ctx.currentTime;
    const dt = Math.max(0, now - lastIntensityAt);
    lastIntensityAt = now;
    combatIntensity = Math.max(0, combatIntensity - dt / 8); // full decay ≈ 8s of quiet
  }
  function applyCombatLayer(): void {
    if (!ctx || !combatLayerGain) return;
    // Smooth follow — no zipper noise, no hard cuts (audio-design: fade stems).
    combatLayerGain.gain.setTargetAtTime(0.5 * combatIntensity, ctx.currentTime, 0.6);
  }
  /** Sidechain-style duck: the music bus dips, then recovers (~1.5s). */
  function duckMusic(depth = 0.35): void {
    if (!ctx || !musicBus) return;
    const t = ctx.currentTime;
    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setTargetAtTime(MUSIC_BUS_LEVEL * depth, t, 0.05);
    musicBus.gain.setTargetAtTime(MUSIC_BUS_LEVEL, t + 0.8, 0.45);
  }

  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) { const s = JSON.parse(raw) as { v?: number; m?: boolean }; volume = s.v ?? 0.7; muted = s.m ?? false; }
  } catch { /* storage unavailable — defaults */ }

  function persist(): void {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ v: volume, m: muted })); } catch { /* ignore */ }
  }

  function ensure(): AudioContext | null {
    if (ctx) return ctx;
    try {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : volume;
      master.connect(ctx.destination);
      // Shared 1s white-noise buffer for percussive voices.
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch { ctx = null; }
    return ctx;
  }

  function applyGain(): void { if (master) master.gain.value = muted ? 0 : volume; }

  /** Throttle gate: at most one play of `key` per `ms`. */
  function gate(key: string, ms: number): boolean {
    const c = ensure(); if (!c || c.state !== 'running') return false;
    const now = c.currentTime;
    const last = lastAt.get(key) ?? -Infinity;
    if ((now - last) * 1000 < ms) return false;
    lastAt.set(key, now);
    played++;
    return true;
  }

  // ── Synth building blocks ──────────────────────────────────────────────────
  function tone(freq: number, dur: number, type: OscillatorType, gain: number, sweepTo?: number): void {
    if (!ctx || !master) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (sweepTo != null) o.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur: number, gain: number, filterFreq: number, filterType: BiquadFilterType, sweepTo?: number): void {
    if (!ctx || !master || !noiseBuf) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    src.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = ctx.createBiquadFilter(); f.type = filterType;
    f.frequency.setValueAtTime(filterFreq, t);
    if (sweepTo != null) f.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t); src.stop(t + dur + 0.02);
  }
  function motif(notes: number[], step: number, dur: number, type: OscillatorType, gain: number): void {
    if (!ctx || !master) return;
    const t0 = ctx.currentTime;
    notes.forEach((f, i) => {
      const t = t0 + i * step;
      const o = ctx!.createOscillator(); const g = ctx!.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(master!);
      o.start(t); o.stop(t + dur + 0.02);
    });
  }

  // ── Generative music: ambient bed + adaptive combat layer ──────────────────
  // The bed (pad + plucks) plays always; the combat layer is a step-sequenced
  // bass/percussion pulse whose gain follows combatIntensity (vertical layering
  // per audio-design; sequencer scheduling per the game-audio skill — notes are
  // scheduled ahead on ctx time for sample-accurate looping, no drift).
  function startMusicInternal(): void {
    if (!ctx || !master || musicOn) return;
    musicOn = true;
    const music = ctx.createGain(); music.gain.value = MUSIC_BUS_LEVEL; music.connect(master);
    musicBus = music;
    // Pad: two detuned saws through a slowly-breathing lowpass.
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.7;
    const padGain = ctx.createGain(); padGain.gain.value = 0.28;
    lp.connect(padGain).connect(music);
    for (const det of [-5, 4]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = 73.42; // D2
      o.detune.value = det;
      o.connect(lp); o.start();
    }
    const lfo = ctx.createOscillator(); const lfoG = ctx.createGain();
    lfo.frequency.value = 0.05; lfoG.gain.value = 220;
    lfo.connect(lfoG).connect(lp.frequency); lfo.start();
    // Sparse plucks: D-minor pentatonic, one soft note every ~2.4–4.8s.
    const scale = [146.83, 174.61, 196.0, 220.0, 261.63, 293.66]; // D3 F3 G3 A3 C4 D4
    const pluck = (): void => {
      if (!ctx || !musicOn) return;
      if (Math.random() < 0.75) {
        const f = scale[Math.floor(Math.random() * scale.length)]! * (Math.random() < 0.25 ? 2 : 1);
        const t = ctx.currentTime;
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0.14, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
        o.connect(g).connect(music);
        o.start(t); o.stop(t + 1.7);
      }
      window.setTimeout(pluck, 2400 + Math.random() * 2400);
    };
    window.setTimeout(pluck, 1200);

    // Combat layer: 8-step D-minor bass pulse + noise-hat ticks at 112 BPM,
    // silent until combatIntensity raises it. Scheduled ahead of the playback
    // cursor in a look-ahead loop (game-audio sequencer pattern).
    combatLayerGain = ctx.createGain();
    combatLayerGain.gain.value = 0;
    combatLayerGain.connect(music);
    const layerDest = combatLayerGain;
    const BPM = 112;
    const stepDur = 60 / BPM / 2; // eighth notes
    // D2 pulse with fifths/octaves — dark, driving, stays under the pad's key.
    const bassSteps = [73.42, 0, 73.42, 0, 110.0, 0, 73.42, 146.83];
    let nextStep = ctx.currentTime + 0.1;
    let stepIx = 0;
    const scheduleCombat = (): void => {
      if (!ctx || !musicOn) return;
      decayIntensity();
      applyCombatLayer();
      while (nextStep < ctx.currentTime + 0.15) {
        const f = bassSteps[stepIx % bassSteps.length]!;
        if (f > 0) {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.type = 'square'; o.frequency.setValueAtTime(f, nextStep);
          g.gain.setValueAtTime(0.16, nextStep);
          g.gain.exponentialRampToValueAtTime(0.001, nextStep + stepDur * 0.85);
          const lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 900;
          o.connect(lpf).connect(g).connect(layerDest);
          o.start(nextStep); o.stop(nextStep + stepDur);
        }
        // Hat tick on the off-beats (filtered noise, very quiet).
        if (stepIx % 2 === 1 && noiseBuf) {
          const src = ctx.createBufferSource(); src.buffer = noiseBuf;
          const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.05, nextStep);
          g.gain.exponentialRampToValueAtTime(0.001, nextStep + 0.05);
          src.connect(hp).connect(g).connect(layerDest);
          src.start(nextStep); src.stop(nextStep + 0.06);
        }
        nextStep += stepDur;
        stepIx++;
      }
      window.setTimeout(scheduleCombat, 60);
    };
    scheduleCombat();
  }

  return {
    resume() {
      const c = ensure();
      if (c && c.state !== 'running') void c.resume();
    },
    setVolume(v: number) { volume = Math.max(0, Math.min(1, v)); applyGain(); persist(); },
    getVolume: () => volume,
    setMuted(m: boolean) { muted = m; applyGain(); persist(); },
    isMuted: () => muted,
    startMusic() { if (ensure()) startMusicInternal(); },

    click() { if (gate('click', 60)) tone(880, 0.05, 'square', 0.12); },
    denied() { if (gate('denied', 250)) motif([220, 165], 0.09, 0.10, 'square', 0.14); }, // v0.52: refused build click (low descending buzz)
    select() { if (gate('select', 90)) tone(520, 0.06, 'square', 0.10, 700); },
    ack() { if (gate('ack', 120)) motif([620, 830], 0.055, 0.07, 'square', 0.10); },
    shot(rocket: boolean) {
      bumpIntensity(0.05); // combat music layer feeds off the fighting itself
      if (rocket) { if (gate('shotR', 140)) noise(0.22, 0.16, 1800, 'bandpass', 300); }
      else if (gate('shot', 75)) { noise(0.06, 0.14, 2600, 'highpass'); tone(190, 0.04, 'square', 0.06, 120); }
    },
    explosion(big: boolean) {
      bumpIntensity(big ? 0.25 : 0.12);
      const key = big ? 'boomB' : 'boom';
      if (!gate(key, big ? 350 : 180)) return;
      if (big) duckMusic(0.45); // big blasts punch through the music
      noise(big ? 0.65 : 0.32, big ? 0.30 : 0.20, big ? 900 : 1400, 'lowpass', 90);
      tone(big ? 110 : 150, big ? 0.5 : 0.25, 'sine', big ? 0.28 : 0.18, 40);
    },
    place() { if (gate('place', 200)) { tone(120, 0.16, 'sine', 0.22, 45); noise(0.1, 0.08, 500, 'lowpass'); } },
    trainReady() { if (gate('train', 900)) motif([523, 659], 0.09, 0.12, 'triangle', 0.14); },
    dock() { if (gate('dock', 1800)) motif([784, 1047], 0.07, 0.10, 'sine', 0.09); },
    baseUnderAttack() { if (gate('alertB', 12000)) { duckMusic(0.3); motif([440, 330, 440, 330, 440, 330], 0.16, 0.15, 'sawtooth', 0.13); } },
    harvesterUnderAttack() { if (gate('alertH', 12000)) { duckMusic(0.35); motif([660, 495, 660, 495], 0.14, 0.12, 'sawtooth', 0.10); } },
    matchEnd(won: boolean) {
      if (!gate('end', 3000)) return;
      duckMusic(0.25);
      if (won) motif([392, 523, 659, 784], 0.14, 0.5, 'triangle', 0.16);
      else motif([330, 262, 196], 0.2, 0.6, 'triangle', 0.14);
    },
    debug: () => ({ state: ctx?.state ?? 'none', played, muted, combatIntensity }),
  };
}
