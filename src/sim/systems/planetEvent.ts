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
import { grantCells } from '../ledger.js';
import { refinementValue, type Refinement } from '../../loaders/refinements.js';
import type { EntityId } from '../ids.js';

const RIFTMAW_MINING_STEP = 3000;  // credits mined per awakening
const RIFTMAW_CAP = 2;             // alive at once
const RIFTMAW_AGGRO_TILES = 6;
const CAPTURE_RADIUS_TILES = 1.8;
const CAPTURE_TICKS = 100;         // 5s alone beside the derrick
const DERRICK_INCOME_PER_TICK = 5 / SIM_TICK_RATE; // 5 cr/s
const RELAY_CELL_TICKS = 20 * SIM_TICK_RATE;        // XP-2: +1 Cell per 20s held
// XP-5 Shardstorms: a deterministic weather clock — pure function of the tick.
// Every 4 minutes, a 30-second storm: flyers take damage, harvesters mine 2×,
// Riftmaws grow bolder. One sentence: "when the storm rises, ground your air
// and gorge your harvesters."
const STORM_PERIOD = 4800;
const STORM_LEN = 600;
export function isStormActive(tick: number): boolean {
  return tick % STORM_PERIOD >= STORM_PERIOD - STORM_LEN;
}
const CELL_CAP = 12;

export function makePlanetEventSystem(units: readonly UnitDef[], refinements: readonly Refinement[] = []): { name: 'planetEvent'; run(state: SimState): void; debugRiftmaws: () => number } {
  const riftmawDef = units.find(u => u.id === 'riftmaw');
  let prevTotalDensity: number | null = null;
  let totalMined = 0;
  let awakenings = 0;
  const captureProgress = new Map<EntityId, { team: string; ticks: number }>();
  const relayTicks = new Map<EntityId, number>(); // XP-2: per-relay cell clock

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
          // RESONANCE (XP-2): the planet hunts the HEAVIEST extractor. Anchor on
          // the top-mining side's bank; wake at the bitten tile NEAREST it (ties
          // by sorted key — deterministic).
          let anchor: { wx: number; wy: number } | null = null;
          let heaviest = -1;
          for (const team of ['player', 'enemy'] as const) {
            let mined = 0; let bankPos: { wx: number; wy: number } | null = null;
            for (const e of state.store.all()) {
              if (e.components.faction?.team !== team || !e.components.economy) continue;
              mined += e.components.economy.minedTotal ?? 0;
              if (!bankPos && e.components.position) bankPos = e.components.position;
            }
            // Refinement (economy depth): Resonance Dampers make the planet read this
            // team's extraction as lighter — it hunts them less.
            mined *= 1 - refinementValue(state.refinements.get(team)?.done, refinements, 'resonance');
            if (mined > heaviest && bankPos) { heaviest = mined; anchor = bankPos; }
          }
          let best: { key: string; d: number } | null = null;
          for (const key of [...state.shardDensity.keys()].sort()) {
            const d = state.shardDensity.get(key)!;
            if (d <= 0 || d > 500) continue; // "bitten" = partially mined
            if (anchor) {
              const [txs, tys] = key.split(',');
              const c = tileToWorldCenter({ tx: Number(txs), ty: Number(tys) });
              const dist = Math.hypot(c.wx - anchor.wx, c.wy - anchor.wy);
              if (best === null || dist < best.d) best = { key, d: dist };
            } else if (best === null || d < best.d) best = { key, d };
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

      // ── Shardstorm damage (XP-5): exposed flyers bleed 2 hp/s during storms.
      if (isStormActive(state.tick)) {
        for (const e of state.store.all()) {
          if (!e.components.movement?.flying) continue;
          const h = e.components.health;
          if (h && h.hp > 0) h.hp -= 2 / SIM_TICK_RATE;
        }
      }

      // ── 2) Riftmaw aggro (every 10 ticks): chase the nearest intruder ────────
      if (state.tick % 10 === 0) {
        const aggro = (RIFTMAW_AGGRO_TILES + (isStormActive(state.tick) ? 2 : 0)) * TILE_SUBUNITS;
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
        const factionC = derrick.components.faction;
        const kindHere = factionC?.faction;
        if (!factionC || (kindHere !== 'derrick' && kindHere !== 'relay')) continue;
        const dp = derrick.components.position;
        if (!dp) continue;
        const owner = factionC.team;

        // Income drips to the owner's first bank: derricks pay CREDITS,
        // relays pay CELLS (XP-2: +1 per 20s held, capped).
        if (owner !== 'neutral') {
          const bank = state.store.all().find(e => e.components.faction?.team === owner && e.components.economy)?.components.economy;
          if (bank) {
            if (kindHere === 'derrick') {
              bank.credits = Math.min(bank.maxStorage, bank.credits + DERRICK_INCOME_PER_TICK);
            } else {
              const t = (relayTicks.get(derrick.id) ?? 0) + 1;
              if (t >= RELAY_CELL_TICKS) {
                grantCells(state, owner as 'player' | 'enemy', 1, CELL_CAP); // TP-2 ledger
                relayTicks.set(derrick.id, 0);
              } else relayTicks.set(derrick.id, t);
            }
          }
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
            derrick.components.faction = { team: claimant, faction: kindHere }; // TP-2: a relay STAYS a relay
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
