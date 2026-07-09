// ── AI: goal-driven FSM (v0.24) ──────────────────────────────────────────────
// Runs after production per SYSTEM_ORDER. Reads state + issues orders; constructs
// nothing. Sim-pure & deterministic: no DOM, no Date, no Math.random. Time comes from
// state.tick; any variety is derived from tick/entity-id, never a wall clock or RNG.
//
// Each evaluation the AI reads the board, picks ONE plan, and acts:
//   Stabilize  — no harvester → rebuild one; base under attack → recall the army to defend.
//   Recover    — army just got gutted vs a bigger enemy → stop feeding units, hold at base.
//   Raid       — player harvester is exposed → peel off fast units to kill its economy.
//   Assault    — army value ≥ an escalating threshold → commit the whole force at the base.
//   Pressure   — army value ≥ a smaller threshold → send a partial force, keep a reserve.
//   Develop    — default → keep production busy with a composition that counters the player.
//   Expand     — a fat bank + a rich unexploited field → found a new refinery beside it (FG-2).
//
// The AI's economy is REAL: production is paid from its harvested credits (the production
// system charges the bank). The AI never receives hidden/recurring income here.
import type { SimState } from '../state.js';
import { teamTier } from '../tech.js';
import type { UnitDef } from '../../loaders/units.js';
import { tileToWorldCenter, worldToTile, TILE_SUBUNITS, type TilePos } from '../coords.js';
import { SIM_TICK_RATE } from '../loop.js';
import type { EntityId } from '../ids.js';
import type { WorldPos } from '../coords.js';

export type AiState = 'Stabilize' | 'Recover' | 'Raid' | 'Assault' | 'Pressure' | 'Develop' | 'Expand';

export interface AiConfig {
  team: 'player' | 'enemy'; // 'player' used by the AI-vs-AI balance harness
  attackTile: TilePos;                 // the player base the AI assaults
  evalInterval?: number;               // ticks between plan re-evaluations (default 10 = 0.5s)
  assaultValue?: number;               // army value that triggers an all-in assault (default 500)
  assaultEscalationPerMin?: number;    // assault threshold decay per elapsed minute (default 60)
  pressureValue?: number;              // army value that starts harassment (default 250)
  raidUnitCap?: number;                // units peeled for a harvester raid (default 2)
  graceTicks?: number;                 // no Assault/Raid/Pressure before this tick (difficulty grace)
  defendRadiusTiles?: number;          // player unit within this of the AI base → defend (default 8)
}

const dist = (a: WorldPos, b: WorldPos): number => Math.hypot(a.wx - b.wx, a.wy - b.wy);

export function makeAiSystem(units: readonly UnitDef[], cfg: AiConfig): { name: 'ai'; run(state: SimState): void; debugState: () => AiState } {
  const team = cfg.team;
  const evalInterval = cfg.evalInterval ?? 10;
  const assaultValue = cfg.assaultValue ?? 500;
  const escalationPerMin = cfg.assaultEscalationPerMin ?? 60;
  const pressureValue = cfg.pressureValue ?? 250;
  const raidUnitCap = cfg.raidUnitCap ?? 2;
  const graceTicks = cfg.graceTicks ?? 0;
  const defendRadius = (cfg.defendRadiusTiles ?? 8) * TILE_SUBUNITS;

  const infantry = units.find(u => u.id === 'infantry');
  const costOf = (id: string): number => units.find(u => u.id === id)?.cost ?? 0;

  const committed = new Set<EntityId>(); // units already holding a standing order (assault/raid)
  let lastArmyCount = 0;                  // for Recover detection (sharp army drop)
  let plan: AiState = 'Develop';

  return {
    name: 'ai' as const,
    debugState: () => plan,
    run(state: SimState): void {
      if (!infantry) return;

      // Evaluate the plan on a deterministic cadence; between evals, units keep their orders.
      if (state.tick % evalInterval !== 0) return;

      // ── Read the board ──────────────────────────────────────────────────────
      const all = state.store.all();
      const bank = all.find(e => e.components.faction?.team === team && e.components.economy)?.components.economy ?? null;
      const barracks = all.find(e => e.components.faction?.team === team && e.components.faction?.faction === 'barracks' && e.components.production) ?? null;
      const factory = all.find(e => e.components.faction?.team === team && e.components.faction?.faction === 'war_factory' && e.components.production) ?? null;
      const refinery = all.find(e => e.components.faction?.team === team && e.components.faction?.faction === 'refinery' && e.components.production) ?? null;

      const ownHarvesters = all.filter(e => e.components.faction?.team === team && e.components.faction?.faction === 'harvester' && (e.components.health?.hp ?? 0) > 0);
      const army = all.filter(e => e.components.faction?.team === team && e.components.combat && (e.components.health?.hp ?? 0) > 0 && e.components.movement);

      // Own base rally point: the AI refinery (fallback: any own building; then the attack tile).
      const basePos: WorldPos =
        refinery?.components.position ??
        all.find(e => e.components.faction?.team === team && e.components.building)?.components.position ??
        tileToWorldCenter(cfg.attackTile);

      // Player army composition (reactive production) + exposed harvester (raids) + base threat.
      let pRifle = 0, pRocket = 0, pVehicle = 0;
      let playerHarvester: WorldPos | null = null;
      let enemyNearBase = false;
      const playerCombat: WorldPos[] = [];
      for (const e of all) {
        const f = e.components.faction; const h = e.components.health; const p = e.components.position;
        if (!f || f.team === team) continue;
        if (p && f.faction === 'harvester' && (h?.hp ?? 0) > 0) playerHarvester = p;
        if (e.components.combat && (h?.hp ?? 0) > 0 && p) {
          playerCombat.push(p);
          if (f.faction === 'rocket_trooper') pRocket++;
          else if (f.faction === 'vehicle') pVehicle++;
          else pRifle++;
          if (dist(p, basePos) <= defendRadius) enemyNearBase = true;
        }
      }

      // Prune dead/absent ids from the committed set.
      for (const id of committed) if (!army.some(u => u.id === id)) committed.delete(id);

      const armyValue = army.reduce((sum, u) => sum + costOf(u.components.faction?.faction ?? ''), 0);

      // ── Choose the plan (priority order) ────────────────────────────────────
      const minutes = state.tick / (60 * SIM_TICK_RATE);
      const assaultThreshold = Math.max(200, assaultValue - escalationPerMin * minutes);
      const gutted = army.length <= Math.max(1, Math.floor(lastArmyCount * 0.4)) && playerCombat.length > army.length;

      // Priority: survive first, then a strong army commits to winning; only a not-yet-strong
      // army harasses (raid an exposed harvester > generic pressure).
      const harvesterExposed = playerHarvester != null && !nearAny(playerHarvester, playerCombat, defendRadius);
      if (ownHarvesters.length === 0 || enemyNearBase) plan = 'Stabilize';
      else if (gutted && army.length < 3) plan = 'Recover';
      else if (armyValue >= assaultThreshold) plan = 'Assault';
      else if (harvesterExposed && army.length > 2) plan = 'Raid';
      else if (armyValue >= pressureValue) plan = 'Pressure';
      else if (bank && bank.credits >= EXPAND_COST + EXPAND_RESERVE && findExpansionTile(state, team) !== null) plan = 'Expand';
      else plan = 'Develop';

      // Difficulty grace (QA BUG-5): before graceTicks the AI builds but does not
      // attack — aggressive plans downgrade to economy. Defence (Stabilize/Recover)
      // stays available so it can still protect itself if rushed.
      if (state.tick < graceTicks && (plan === 'Assault' || plan === 'Raid' || plan === 'Pressure')) {
        plan = (bank && bank.credits >= EXPAND_COST + EXPAND_RESERVE && findExpansionTile(state, team) !== null) ? 'Expand' : 'Develop';
      }

      // ── Economy: keep the harvester alive, keep production busy ──────────────
      // (1) Rebuild a lost harvester at the refinery (its economy, not the barracks).
      if (refinery && ownHarvesters.length === 0 && refinery.components.production && refinery.components.production.queue.length === 0) {
        refinery.components.production = { ...refinery.components.production, queue: ['harvester'] };
      }
      // (2) Keep the barracks producing a composition that COUNTERS the player. Bands, not a
      //     fixed ratio: counter the dominant player class, salt in a rocket periodically.
      if (barracks && bank && barracks.components.production && barracks.components.production.queue.length === 0) {
        const pick = chooseUnit(state.tick, evalInterval, pRifle, pRocket, pVehicle);
        // Queue only when the bank can start it soon; production pauses if momentarily short.
        if (bank.credits >= Math.min(costOf('infantry'), costOf(pick))) {
          barracks.components.production = { ...barracks.components.production, queue: [pick] };
        }
      }

      // (3) Combined arms (FG-3): once rich, found ONE War Factory near the base,
      // then keep it producing vehicles (tanks salted in; scouts vs massed rifles).
      // ECONOMY FIRST: while an expansion field is still available, the factory
      // waits for a much fatter bank so Expand keeps priority over military tech.
      // The AI pays the same 1000 the player pays; siting is deterministic.
      const factoryThreshold = findExpansionTile(state, team) !== null ? 2500 : 1300;
      // Tech first (XP-1): the factory is T2 — upgrade the HQ before founding it.
      const tier = teamTier(state, team);
      if (!factory && tier < 2 && bank && bank.credits >= factoryThreshold) {
        const yard = state.store.all().find(e =>
          e.components.faction?.team === team && e.components.tech && e.components.tech.upgradingTo == null);
        if (yard?.components.tech && yard.components.tech.tier < 2) {
          bank.credits -= 1000;
          yard.components.tech = { tier: yard.components.tech.tier, upgradingTo: 2, ticksLeft: 600 };
        }
      }
      // Balance-sweep finding (2026-07-09): the AI could never BUILD a barracks —
      // fine while every mission pre-seeds one, fatal the moment it's destroyed
      // (or absent, as the AI-vs-AI harness proved). Found one whenever none stands.
      const barracksAlive = state.store.all().some(e =>
        e.components.faction?.team === team && e.components.faction?.faction === 'barracks' &&
        (e.components.health?.hp ?? 0) > 0);
      if (!barracksAlive && bank && bank.credits >= 500 && refinery?.components.position) {
        const rt = worldToTile(refinery.components.position);
        for (const [dx, dy] of [[0, 2], [2, 2], [-2, 0], [2, -2], [0, -2]] as const) {
          const spot = { tx: rt.tx + dx, ty: rt.ty + dy };
          if (!state.grid.isWalkable(spot)) continue;
          if ((state.shardDensity.get(`${spot.tx},${spot.ty}`) ?? 0) > 0) continue;
          bank.credits -= 300;
          state.store.create({
            position: tileToWorldCenter(spot),
            building: { onSlab: false, buildProgress: 100, powered: true },
            faction: { team, faction: 'barracks' },
            production: { queue: [], progress: 0 },
            health: { hp: 800, maxHp: 800 },
            armor: { armorClass: 'BUILDING' },
          });
          break;
        }
      }

      // XP-2: with the WAR FACTORY standing and a fat bank, found ONE Processing
      // Plant (military first; Cells fund the
      // elite systems arriving in later phases; same 800 the player pays).
      const plant = state.store.all().find(e =>
        e.components.faction?.team === team && e.components.faction?.faction === 'processing_plant');
      if (!plant && factory && tier >= 2 && bank && bank.credits >= 2000 && refinery?.components.position) {
        const rt = worldToTile(refinery.components.position);
        for (const [dx, dy] of [[2, 0], [0, 2], [-2, 2], [2, -2]] as const) {
          const spot = { tx: rt.tx + dx, ty: rt.ty + dy };
          if (!state.grid.isWalkable(spot)) continue;
          if ((state.shardDensity.get(`${spot.tx},${spot.ty}`) ?? 0) > 0) continue;
          bank.credits -= 800;
          state.store.create({
            position: tileToWorldCenter(spot),
            building: { onSlab: false, buildProgress: 100, powered: true },
            faction: { team, faction: 'processing_plant' },
            power: { powerSupply: 0, powerDemand: 25, powered: true },
            health: { hp: 900, maxHp: 900 },
            armor: { armorClass: 'BUILDING' },
          });
          break;
        }
      }
      // XP-5: reactive AA — the moment the player fields air, raise ONE AA turret.
      const playerHasAir = state.store.all().some(e =>
        e.components.faction?.team !== team && e.components.faction?.team !== 'neutral' && e.components.movement?.flying);
      const hasAA = state.store.all().some(e =>
        e.components.faction?.team === team && e.components.faction?.faction === 'aa_turret');
      if (playerHasAir && !hasAA && bank && bank.credits >= 700 && refinery?.components.position) {
        const rt = worldToTile(refinery.components.position);
        for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
          const spot = { tx: rt.tx + dx, ty: rt.ty + dy };
          if (!state.grid.isWalkable(spot)) continue;
          bank.credits -= 500;
          state.store.create({
            position: tileToWorldCenter(spot),
            building: { onSlab: false, buildProgress: 100, powered: true },
            faction: { team, faction: 'aa_turret' },
            power: { powerSupply: 0, powerDemand: 10, powered: true },
            combat: { weaponId: 'aa_missile', cooldownRemaining: 0, targetId: null },
            health: { hp: 450, maxHp: 450 },
            armor: { armorClass: 'BUILDING' },
          });
          break;
        }
      }
      if (!factory && tier >= 2 && bank && bank.credits >= factoryThreshold && refinery?.components.position) {
        const rt = worldToTile(refinery.components.position);
        for (const [dx, dy] of [[-2, 0], [0, -2], [2, 2], [-2, -2]] as const) {
          const spot = { tx: rt.tx + dx, ty: rt.ty + dy };
          if (!state.grid.isWalkable(spot)) continue;
          if ((state.shardDensity.get(`${spot.tx},${spot.ty}`) ?? 0) > 0) continue;
          bank.credits -= 1000;
          state.store.create({
            position: tileToWorldCenter(spot),
            building: { onSlab: false, buildProgress: 100, powered: true },
            faction: { team, faction: 'war_factory' },
            power: { powerSupply: 0, powerDemand: 30, powered: true },
            production: { queue: [], progress: 0 },
            health: { hp: 1300, maxHp: 1300 },
            armor: { armorClass: 'BUILDING' },
          });
          break;
        }
      }
      if (factory && bank && factory.components.production && factory.components.production.queue.length === 0) {
        const evalIndex = Math.floor(state.tick / evalInterval);
        // XP-4: salt a Longbow into the vehicle mix every 4th pick (siege pressure).
        const pick = evalIndex % 4 === 3 ? 'longbow' : evalIndex % 3 === 2 ? 'assault_tank' : 'scout_vehicle';
        if (bank.credits >= costOf(pick) + 200) {
          factory.components.production = { ...factory.components.production, queue: [pick] };
        }
      }

      // ── Act on the plan ─────────────────────────────────────────────────────
      const idleFresh = army.filter(u => !committed.has(u.id) && u.components.movement?.target == null && (u.components.combat?.targetId ?? null) === null);

      switch (plan) {
        case 'Stabilize':
        case 'Recover': {
          // Pull un-engaged units home to defend / preserve; drop their standing
          // orders. Attack-movers are COMMITTED (e.g. trigger-spawned assault
          // waves, FG-4) — never recalled.
          for (const u of army) {
            if (u.components.movement?.attackMove) continue;
            if ((u.components.combat?.targetId ?? null) === null && u.components.movement) {
              u.components.movement.target = basePos;
              committed.delete(u.id);
            }
          }
          break;
        }
        case 'Raid': {
          // Peel off up to raidUnitCap units to hit the exposed harvester.
          const target = playerHarvester!;
          for (const u of idleFresh.slice(0, raidUnitCap)) {
            if (u.components.movement) { u.components.movement.target = target; committed.add(u.id); }
          }
          break;
        }
        case 'Assault': {
          const target = tileToWorldCenter(cfg.attackTile);
          for (const u of idleFresh) {
            if (u.components.movement) { u.components.movement.target = target; committed.add(u.id); }
          }
          break;
        }
        case 'Pressure': {
          // Commit ~half the idle force; keep the rest as a home reserve.
          const target = tileToWorldCenter(cfg.attackTile);
          const send = idleFresh.slice(0, Math.max(1, Math.floor(idleFresh.length / 2)));
          for (const u of send) {
            if (u.components.movement) { u.components.movement.target = target; committed.add(u.id); }
          }
          break;
        }
        case 'Expand': {
          // Found a refinery beside the richest unexploited field. The AI pays the
          // SAME price as the player (deducted from its harvested bank); creation is
          // immediate on payment — the same rule as player placement.
          const spot = findExpansionTile(state, team);
          if (spot && bank && bank.credits >= EXPAND_COST) {
            bank.credits -= EXPAND_COST;
            state.store.create({
              position: tileToWorldCenter(spot),
              building: { onSlab: false, buildProgress: 100, powered: true },
              faction: { team, faction: 'refinery' },
              power: { powerSupply: 0, powerDemand: 20, powered: true },
              economy: { credits: 0, refineryStorage: 0, maxStorage: 1500 },
              production: { queue: [], progress: 0, current: null },
              health: { hp: 1500, maxHp: 1500 },
              armor: { armorClass: 'BUILDING' },
            });
          }
          break;
        }
        // Develop: accumulate; the production block above does the work.
      }

      lastArmyCount = army.length;
    },
  };
}

const EXPAND_COST = 1200;     // same refinery price the player pays
const EXPAND_RESERVE = 300;   // keep a production float after expanding

/** The richest field tile ≥6 tiles from every refinery the team already owns, with a
 *  walkable adjacent build spot. Deterministic: sorted key iteration, ties by key. */
function findExpansionTile(state: SimState, team: string): TilePos | null {
  const refineries: WorldPos[] = [];
  for (const e of state.store.all()) {
    if (e.components.faction?.team === team && e.components.faction?.faction === 'refinery' && e.components.position) {
      refineries.push(e.components.position);
    }
  }
  const keys = [...state.shardDensity.keys()].sort();
  let best: { t: TilePos; density: number } | null = null;
  for (const k of keys) {
    const density = state.shardDensity.get(k) ?? 0;
    if (density < 500) continue; // only rich fields justify a 1200cr outpost
    const [txs, tys] = k.split(',');
    const t = { tx: Number(txs), ty: Number(tys) };
    const w = tileToWorldCenter(t);
    if (refineries.some(r => Math.hypot(r.wx - w.wx, r.wy - w.wy) < 6 * TILE_SUBUNITS)) continue; // already exploited
    if (best === null || density > best.density) {
      // Build spot: the first walkable, unoccupied neighbour (fixed order → deterministic).
      for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]] as const) {
        const spot = { tx: t.tx + dx, ty: t.ty + dy };
        if (!state.grid.isWalkable(spot)) continue;
        if ((state.shardDensity.get(`${spot.tx},${spot.ty}`) ?? 0) > 0) continue; // don't build ON shard
        best = { t: spot, density };
        break;
      }
    }
  }
  return best?.t ?? null;
}

/** True if `p` is within `radius` (world units) of any point in `pts`. */
function nearAny(p: WorldPos, pts: WorldPos[], radius: number): boolean {
  for (const q of pts) if (dist(p, q) <= radius) return true;
  return false;
}

/** Reactive composition: counter the player's dominant class; periodically force a rocket
 *  (anti-armour / anti-building insurance). Deterministic in (tick). */
function chooseUnit(tick: number, evalInterval: number, rifle: number, rocket: number, vehicle: number): string {
  const evalIndex = Math.floor(tick / evalInterval);
  if (evalIndex % 4 === 3) return 'rocket_trooper';
  if (vehicle >= rifle && vehicle >= rocket && vehicle > 0) return 'rocket_trooper'; // rockets shred vehicles
  if (rifle >= rocket && rifle > 0) return 'vehicle';                                 // scout guns beat massed rifles
  if (rocket > 0) return 'infantry';                                                  // cheap bodies vs slow rockets
  return 'infantry';                                                                  // default opener
}
