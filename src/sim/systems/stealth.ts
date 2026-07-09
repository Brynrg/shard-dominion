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
      // XP-5: skypad positions per team (air rearm points).
      const pads: { team: string; wx: number; wy: number }[] = [];
      for (const e of state.store.all()) {
        if (e.components.faction?.faction !== 'skypad') continue;
        if ((e.components.health?.hp ?? 0) <= 0 || e.components.power?.powered === false) continue;
        const p = e.components.position;
        if (p) pads.push({ team: e.components.faction.team, wx: p.wx, wy: p.wy });
      }
      for (const e of state.store.all()) {
        // XP-4 counter-battery decay (shared slot: unit-state upkeep).
        const cb = e.components.combat;
        if (cb?.revealedTicks) cb.revealedTicks = Math.max(0, cb.revealedTicks - 1);
        // XP-5 shield regen: 0.5/s after 5s without absorbing.
        const sh = e.components.shield;
        if (sh) {
          if (sh.regenDelay > 0) sh.regenDelay -= 1;
          else if (sh.hp < sh.max) sh.hp = Math.min(sh.max, sh.hp + 0.5 / 20);
        }
        // XP-5 air rearm: an EMPTY flyer beside an own Skypad refills — one full
        // sortie per Cell (waits if the bank has none).
        if (cb && cb.ammoMax != null && (cb.ammo ?? 0) <= 0) {
          const f = e.components.faction; const p = e.components.position;
          if (f && p) {
            const near = pads.some(pad => pad.team === f.team && Math.hypot(pad.wx - p.wx, pad.wy - p.wy) <= 2 * TILE_SUBUNITS);
            if (near) {
              const bank = state.store.all().find(b => b.components.faction?.team === f.team && b.components.economy)?.components.economy;
              if (bank && (bank.cells ?? 0) >= 1) {
                bank.cells = (bank.cells ?? 0) - 1;
                cb.ammo = cb.ammoMax;
              }
            }
          }
        }
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
