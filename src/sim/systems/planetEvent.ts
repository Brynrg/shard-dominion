// ── Planet events: Riftmaws + capturable derricks (FG-5) ───────────────────────
// Fills the reserved 'planetEvent' SYSTEM_ORDER slot. The planet is the third
// force of the lore (CAMPAIGN_DESIGN.md §1): mine deep enough and it answers.
//
// RIFTMAWS — neutral crystalline burrowers. Every RIFTMAW_MINING_STEP credits of
// Shard mined ACROSS THE MAP wakes one (cap RIFTMAW_CAP alive) at the most-bitten
// rich-field tile. They aggro the nearest non-neutral unit in range — BOTH sides;
// combatTargeting already fights different-team entities, so everyone's guns work
// on them. WC3 creeps + the m6 sequel hook, one mechanic.
//
// DERRICKS — neutral extraction rigs (mission `neutrals`). A team alone beside one
// for CAPTURE_TICKS flips it; the owner's bank drips DERRICK_INCOME/s. Contested or
// abandoned progress resets. The RA2-derrick idea, landed.
//
// Deterministic throughout: thresholds, sorted-key tile picks, fixed scan order.
import type { SimState } from '../state.js';
import type { UnitDef } from '../../loaders/units.js';
import { tileToWorldCenter, TILE_SUBUNITS } from '../coords.js';
import { nearestWalkable } from '../pathfind.js';
import { SIM_TICK_RATE } from '../loop.js';
import type { EntityId } from '../ids.js';

const RIFTMAW_MINING_STEP = 3000;  // credits mined per awakening
const RIFTMAW_CAP = 2;             // alive at once
const RIFTMAW_AGGRO_TILES = 6;
const CAPTURE_RADIUS_TILES = 1.8;
const CAPTURE_TICKS = 100;         // 5s alone beside the derrick
const DERRICK_INCOME_PER_TICK = 5 / SIM_TICK_RATE; // 5 cr/s

export function makePlanetEventSystem(units: readonly UnitDef[]): { name: 'planetEvent'; run(state: SimState): void; debugRiftmaws: () => number } {
  const riftmawDef = units.find(u => u.id === 'riftmaw');
  let prevTotalDensity: number | null = null;
  let totalMined = 0;
  let awakenings = 0;
  const captureProgress = new Map<EntityId, { team: string; ticks: number }>();

  function totalDensity(state: SimState): number {
    let t = 0;
    for (const v of state.shardDensity.values()) t += v;
    return t;
  }

  return {
    name: 'planetEvent' as const,
    debugRiftmaws: () => awakenings,
    run(state: SimState): void {
      // ── 1) Mining ledger → Riftmaw awakenings ────────────────────────────────
      const total = totalDensity(state);
      if (prevTotalDensity !== null && total < prevTotalDensity) totalMined += prevTotalDensity - total;
      prevTotalDensity = total;

      if (riftmawDef && totalMined >= (awakenings + 1) * RIFTMAW_MINING_STEP) {
        const alive = [...state.store.all()].filter(e =>
          e.components.faction?.faction === 'riftmaw' && (e.components.health?.hp ?? 0) > 0).length;
        if (alive < RIFTMAW_CAP) {
          // The most-bitten rich tile: lowest remaining density among tiles that
          // still have some (ties broken by sorted key — deterministic).
          let best: { key: string; d: number } | null = null;
          for (const key of [...state.shardDensity.keys()].sort()) {
            const d = state.shardDensity.get(key)!;
            if (d <= 0 || d > 500) continue; // "bitten" = partially mined
            if (best === null || d < best.d) best = { key, d };
          }
          if (best) {
            const [txs, tys] = best.key.split(',');
            const spot = nearestWalkable(state.grid, { tx: Number(txs), ty: Number(tys) }, undefined, 3);
            if (spot) {
              awakenings += 1;
              state.store.create({
                position: tileToWorldCenter(spot),
                health: { hp: riftmawDef.hp, maxHp: riftmawDef.hp },
                armor: { armorClass: riftmawDef.armorClass },
                movement: { target: null, path: [], speed: riftmawDef.speed },
                combat: { weaponId: riftmawDef.weaponId, cooldownRemaining: 0, targetId: null },
                faction: { team: 'neutral', faction: 'riftmaw' },
              });
            }
          }
        } else {
          awakenings += 1; // ledger advances even at cap (no spawn burst later)
        }
      }

      // ── 2) Riftmaw aggro (every 10 ticks): chase the nearest intruder ────────
      if (state.tick % 10 === 0) {
        const aggro = RIFTMAW_AGGRO_TILES * TILE_SUBUNITS;
        for (const maw of state.store.all()) {
          if (maw.components.faction?.faction !== 'riftmaw') continue;
          const mp = maw.components.position; const mm = maw.components.movement;
          if (!mp || !mm || (maw.components.health?.hp ?? 0) <= 0) continue;
          let bestD = aggro; let target: { wx: number; wy: number } | null = null;
          for (const e of state.store.all()) {
            const f = e.components.faction; const p = e.components.position;
            if (!f || f.team === 'neutral' || !p || e.components.building) continue;
            if ((e.components.health?.hp ?? 0) <= 0) continue;
            const d = Math.hypot(p.wx - mp.wx, p.wy - mp.wy);
            if (d < bestD) { bestD = d; target = { wx: p.wx, wy: p.wy }; }
          }
          if (target) { mm.target = target; mm.attackMove = true; }
          else if (mm.attackMove) { mm.target = null; mm.attackMove = false; }
        }
      }

      // ── 3) Derricks: lone-team capture + owner income ────────────────────────
      for (const derrick of state.store.all()) {
        if (derrick.components.faction?.faction !== 'derrick') continue;
        const dp = derrick.components.position;
        if (!dp) continue;
        const owner = derrick.components.faction.team;

        // Income drips to the owner's first bank.
        if (owner !== 'neutral') {
          const bank = state.store.all().find(e => e.components.faction?.team === owner && e.components.economy)?.components.economy;
          if (bank) bank.credits = Math.min(bank.maxStorage, bank.credits + DERRICK_INCOME_PER_TICK);
        }

        // Capture: exactly ONE team's combat units in radius, sustained.
        const radius = CAPTURE_RADIUS_TILES * TILE_SUBUNITS;
        let player = false, enemy = false;
        for (const e of state.store.all()) {
          const f = e.components.faction; const p = e.components.position;
          if (!f || !p || !e.components.combat || e.components.building) continue;
          if ((e.components.health?.hp ?? 0) <= 0) continue;
          if (Math.hypot(p.wx - dp.wx, p.wy - dp.wy) > radius) continue;
          if (f.team === 'player') player = true;
          else if (f.team === 'enemy') enemy = true;
        }
        const claimant = player && !enemy ? 'player' : enemy && !player ? 'enemy' : null;
        if (claimant && claimant !== owner) {
          const cur = captureProgress.get(derrick.id);
          const ticks = cur && cur.team === claimant ? cur.ticks + 1 : 1;
          if (ticks >= CAPTURE_TICKS) {
            derrick.components.faction = { team: claimant, faction: 'derrick' };
            captureProgress.delete(derrick.id);
          } else {
            captureProgress.set(derrick.id, { team: claimant, ticks });
          }
        } else if (!claimant) {
          captureProgress.delete(derrick.id);
        }
      }
    },
  };
}
