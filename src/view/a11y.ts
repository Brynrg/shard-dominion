// ── Accessibility (view-level, never touches the sim) ──────────────────────────
// Two pieces:
//  1. Announcer — an offscreen aria-live region so screen readers hear the match:
//     mission start, unit ready, base under attack, power shortage, victory/defeat.
//  2. Settings — persisted toggles; today: team SHAPE markers (colorblind assist —
//     own units carry a ○, hostile units a ▲, so side-telling never rests on hue).

export interface Announcer {
  /** Queue a polite announcement. Identical messages within `dedupeMs` are dropped. */
  announce(msg: string, dedupeMs?: number): void;
  /** The last announced message (for tests/debug). */
  last(): string;
}

export function makeAnnouncer(doc: Document = document): Announcer {
  const el = doc.createElement('div');
  el.id = 'sd-announcer';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  // Visually hidden but present for assistive tech (the classic SR-only recipe).
  el.style.cssText =
    'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;';
  doc.body.appendChild(el);
  const lastAt = new Map<string, number>();
  let lastMsg = '';
  return {
    announce(msg: string, dedupeMs = 8000): void {
      const now = Date.now();
      const prev = lastAt.get(msg) ?? -Infinity;
      if (now - prev < dedupeMs) return;
      lastAt.set(msg, now);
      lastMsg = msg;
      // Clear-then-set so repeating text still re-fires on screen readers.
      el.textContent = '';
      el.textContent = msg;
    },
    last: () => lastMsg,
  };
}

/** Persisted accessibility settings (localStorage; safe when storage is blocked). */
export interface A11ySettings {
  getTeamShapes(): boolean;
  setTeamShapes(on: boolean): void;
}

const SHAPES_KEY = 'shardDominion.a11y.teamShapes';

export function makeA11ySettings(): A11ySettings {
  let teamShapes = false;
  try { teamShapes = localStorage.getItem(SHAPES_KEY) === '1'; } catch { /* storage unavailable */ }
  return {
    getTeamShapes: () => teamShapes,
    setTeamShapes(on: boolean): void {
      teamShapes = on;
      try { localStorage.setItem(SHAPES_KEY, on ? '1' : '0'); } catch { /* storage unavailable */ }
    },
  };
}
