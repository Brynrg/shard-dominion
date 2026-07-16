// ── EVA: the Westwood-style battle computer announcer (view-level) ─────────────
// Research-driven (v0.52): the RA/Dune 2000 manuals define the feel — terse,
// event-triggered announcements ("Construction complete", "Insufficient funds",
// "Unit ready", "Low power", "Silos needed") delivered as voice + on-screen text.
// Here: a top-centre text flash on a DOM overlay + browser speechSynthesis for
// the voice (the synthetic timbre IS the EVA aesthetic). Voice is toggleable and
// persisted; muting game audio mutes EVA too.
export interface Eva {
  /** Flash the text banner and (if enabled) speak the line. Deduped per message. */
  announce(text: string, opts?: { dedupeMs?: number }): void;
  getVoiceEnabled(): boolean;
  setVoiceEnabled(on: boolean): void;
  /** Last announced line (gates/debug). */
  last(): string;
}

const VOICE_KEY = 'shardDominion.eva.voice';

export function makeEva(canvas: HTMLCanvasElement, isMuted: () => boolean): Eva {
  let voiceEnabled = true;
  try { voiceEnabled = localStorage.getItem(VOICE_KEY) !== '0'; } catch { /* storage unavailable */ }

  // Banner: DOM overlay pinned to the top-centre of the canvas (the objectives
  // banner is canvas-drawn and mission-owned; EVA gets its own layer so lines
  // never fight the mission UI for space).
  const el = document.createElement('div');
  el.id = 'sd-eva';
  el.style.cssText =
    'position:absolute;left:50%;top:12%;transform:translateX(-50%);pointer-events:none;' +
    'font-family:monospace;font-size:15px;font-weight:bold;letter-spacing:2px;color:#7fd4ff;' +
    'text-shadow:0 0 6px rgba(0,180,255,0.8),0 1px 2px #000;opacity:0;transition:opacity 0.15s;z-index:30;';
  (canvas.parentElement ?? document.body).appendChild(el);
  let hideTimer: number | undefined;

  const lastAt = new Map<string, number>();
  let lastMsg = '';

  function speak(text: string): void {
    if (!voiceEnabled || isMuted()) return;
    try {
      const u = new SpeechSynthesisUtterance(text.toLowerCase());
      u.rate = 1.05; u.pitch = 0.85; u.volume = 0.85;
      window.speechSynthesis.cancel(); // EVA never queues — newest line wins
      window.speechSynthesis.speak(u);
    } catch { /* no TTS on this platform — the banner still shows */ }
  }

  return {
    announce(text: string, opts?: { dedupeMs?: number }): void {
      const now = Date.now();
      const dedupe = opts?.dedupeMs ?? 6000;
      if (now - (lastAt.get(text) ?? -Infinity) < dedupe) return;
      lastAt.set(text, now);
      lastMsg = text;
      el.textContent = text.toUpperCase();
      el.style.opacity = '1';
      if (hideTimer !== undefined) window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => { el.style.opacity = '0'; }, 2600);
      speak(text);
    },
    getVoiceEnabled: () => voiceEnabled,
    setVoiceEnabled(on: boolean): void {
      voiceEnabled = on;
      try { localStorage.setItem(VOICE_KEY, on ? '1' : '0'); } catch { /* storage unavailable */ }
    },
    last: () => lastMsg,
  };
}
