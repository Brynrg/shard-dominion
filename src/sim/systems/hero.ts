// ── Hero system: Ascendancy — the hero grows with veterancy (character build) ──
// Fit-to-identity (NOT a WC3 spellbook): the Warden/Vane is an aura-carrier that
// ASCENDS as it fights. Each rank grows its max HP (heals on rank-up) and — via the
// damage system — its command aura. At rank 3 the aura also mends nearby allies.
// Pure/deterministic: reads experience.kills, writes health (folded into stateHash).
import type { SimState } from '../state.js';
import type { UnitDef } from '../../loaders/units.js';
import { veterancyRank } from '../factory.js';
import { TILE_SUBUNITS } from '../coords.js';
import { SIM_TICK_RATE } from '../loop.js';

export const HERO_KINDS = new Set(['warden', 'vane']);
const HP_PER_RANK = 0.25;      // +25% max HP per rank
const R3_HEAL_PER_SEC = 6;     // rank-3 aura mends nearby allies

export interface HeroSystem { readonly name: 'hero'; run(state: SimState): void }

export function makeHeroSystem(units: readonly UnitDef[]): HeroSystem {
  const baseHp = new Map<string, number>();
  for (const u of units) if (HERO_KINDS.has(u.id)) baseHp.set(u.id, u.hp);
  const prevRank = new Map<number, number>(); // entityId → last rank (heal-on-rank-up latch)

  return {
    name: 'hero' as const,
    run(state: SimState): void {
      for (const e of state.store.all()) {
        const kind = e.components.faction?.faction;
        if (!kind || !HERO_KINDS.has(kind)) continue;
        const h = e.components.health;
        if (!h || h.hp <= 0) continue;
        const rank = veterancyRank(e.components.experience?.kills ?? 0);
        const base = baseHp.get(kind) ?? h.maxHp;
        const newMax = Math.round(base * (1 + HP_PER_RANK * rank));
        if (newMax !== h.maxHp) h.maxHp = newMax;
        const prev = prevRank.get(e.id);
        if (prev === undefined) prevRank.set(e.id, rank);
        else if (rank > prev) { h.hp = h.maxHp; prevRank.set(e.id, rank); } // heal on ascension

        // Rank-3 signature: a slow mending aura for nearby friendlies (once/sec).
        if (rank >= 3 && state.tick % SIM_TICK_RATE === 0) {
          const p = e.components.position; const team = e.components.faction?.team;
          if (!p) continue;
          const auraR = (4 + rank) * TILE_SUBUNITS;
          for (const a of state.store.all()) {
            if (a.id === e.id || a.components.faction?.team !== team || a.components.building) continue;
            const ap = a.components.position; const ah = a.components.health;
            if (!ap || !ah || ah.hp <= 0 || ah.hp >= ah.maxHp) continue;
            if (Math.hypot(ap.wx - p.wx, ap.wy - p.wy) <= auraR) ah.hp = Math.min(ah.maxHp, ah.hp + R3_HEAL_PER_SEC);
          }
        }
      }
    },
  };
}
