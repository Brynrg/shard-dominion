// ── Stealth system (XP-3) — fills the reserved 'agitation' SYSTEM_ORDER slot ────
// Cloak rule (one sentence): a stealth unit is hidden unless it recently fired or
// an enemy detector is close (radar 8 tiles, scouts 5, anything 1.5).
// Deterministic: fixed scan order, tick math only. The damage system sets
// decloakTicks when the unit fires; this system counts it down and applies
// detection. combatTargeting skips cloaked entities; the renderer hides them
// from the opposing viewer.
import type { SimState } from '../state.js';
import { TILE_SUBUNITS } from '../coords.js';

const RADAR_DETECT = 8 * TILE_SUBUNITS;
const SCOUT_DETECT = 5 * TILE_SUBUNITS;
const PROXIMITY_DETECT = 1.5 * TILE_SUBUNITS;

export function makeStealthSystem(): { name: 'agitation'; run(state: SimState): void } {
  return {
    name: 'agitation' as const,
    run(state: SimState): void {
      // Collect detectors per team once.
      const detectors: { team: string; wx: number; wy: number; r: number }[] = [];
      for (const e of state.store.all()) {
        const f = e.components.faction; const p = e.components.position;
        if (!f || !p || (e.components.health?.hp ?? 0) <= 0) continue;
        if (f.faction === 'radar' && e.components.power?.powered !== false) detectors.push({ team: f.team, wx: p.wx, wy: p.wy, r: RADAR_DETECT });
        else if (f.faction === 'scout_vehicle') detectors.push({ team: f.team, wx: p.wx, wy: p.wy, r: SCOUT_DETECT });
        else detectors.push({ team: f.team, wx: p.wx, wy: p.wy, r: PROXIMITY_DETECT });
      }
      for (const e of state.store.all()) {
        const st = e.components.stealth;
        if (!st) continue;
        const f = e.components.faction; const p = e.components.position;
        if (!f || !p) continue;
        const ticks = Math.max(0, st.decloakTicks - 1);
        let detected = false;
        for (const d of detectors) {
          if (d.team === f.team || d.team === 'neutral') continue;
          const dx = d.wx - p.wx, dy = d.wy - p.wy;
          if (dx * dx + dy * dy <= d.r * d.r) { detected = true; break; }
        }
        e.components.stealth = { cloaked: ticks === 0 && !detected, decloakTicks: ticks };
      }
    },
  };
}
