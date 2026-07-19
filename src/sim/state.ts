// ── CONTRACT: SimState — the root of the deterministic world ─────────────────
// The ONLY place the grid / store / rng / map are constructed. Systems receive
// this object; they never build their own (enforced by the systems lint rule).
import { makeEntityStore, type EntityStore } from './store.js';
import { makeGridManager, type GridManager } from './grid.js';
import { generateMap } from './map.js';
import { makeRng, type Rng } from './rng.js';
import { asTick, type Tick } from './ids.js';
import type { WorldPos } from './coords.js';
import { hashInts } from './hash.js';

export interface SimConfig {
  readonly seed: number;
  readonly mapWidth: number;
  readonly mapHeight: number;
}

/** A team's researched-refinement ledger (economy depth): completed upgrade ids +
 *  the single in-progress research and its remaining ticks. Deterministic. */
export interface RefinementLedger { done: string[]; researching: string | null; ticksLeft: number }

/** RA-style sidebar structure production (v0.55): ONE structure per team builds
 *  in the sidebar; at ticksLeft 0 it is READY and waits to be placed. Paid
 *  upfront; cancel refunds in full. */
export interface StructureJob { structureId: string; ticksLeft: number; totalTicks: number }

export interface SimState {
  /** Current tick (mutable; advanced by runTick). */
  tick: Tick;
  readonly seed: number;
  readonly store: EntityStore;
  readonly grid: GridManager;
  readonly rng: Rng;
  /** Previous-tick positions, for render interpolation (read by the renderer only). */
  readonly prevPositions: Map<number, WorldPos>;
  /** Shard tile density map (mutable; tracks remaining resources per tile). */
  readonly shardDensity: Map<string, number>;
  /** Per-team researched refinements (economy depth). Keyed by team. */
  readonly refinements: Map<string, RefinementLedger>;
  /** RA build flow (v0.55): the per-team sidebar structure job. Keyed by team. */
  readonly structureBuild: Map<string, StructureJob>;
}

export function makeSimState(cfg: SimConfig): SimState {
  const terrain = generateMap({ seed: cfg.seed, width: cfg.mapWidth, height: cfg.mapHeight });
  return {
    tick: asTick(0),
    seed: cfg.seed,
    store: makeEntityStore(),
    grid: makeGridManager(terrain),
    rng: makeRng(cfg.seed),
    prevPositions: new Map<number, WorldPos>(),
    shardDensity: new Map<string, number>(),
    refinements: new Map<string, RefinementLedger>(),
    structureBuild: new Map<string, StructureJob>(),
  };
}

/** Stable small integer for a string (deterministic; for hashing ids). */
function strCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/**
 * Order-sensitive hash of the DYNAMIC sim state — the substrate of the blocking
 * determinism smoke (`sameSeed + sameCommandLog → identical hash`). Entities are
 * walked in ascending-id order, so any iteration-order nondeterminism changes it.
 */
export function stateHash(state: SimState): number {
  // TP-4 (v0.42): FULL authoritative coverage. The audit found economy, orders,
  // combat state, tech, power, stealth, shields, containers, veterancy, and
  // projectiles all missing — two clients could diverge strategically while
  // reporting identical hashes. Every field folds in with fixed ordering; floats
  // are scaled+rounded so fractional drips hash deterministically.
  const q = (n: number | undefined | null): number => Math.round(((n ?? -1) as number) * 1000);
  const ints: number[] = [state.tick, state.rng.state(), state.store.count()];
  for (const e of state.store.all()) {
    ints.push(e.id);
    const p = e.components.position;
    if (p) ints.push(p.wx, p.wy);
    const h = e.components.health;
    if (h) ints.push(q(h.hp), h.maxHp);
    const eco = e.components.economy;
    if (eco) ints.push(q(eco.credits), eco.cells ?? 0, q(eco.minedTotal), eco.maxStorage);
    const m = e.components.movement;
    if (m) {
      ints.push(q(m.target?.wx), q(m.target?.wy), m.path.length, m.speed,
        m.flying ? 1 : 0, m.attackMove ? 1 : 0, m.boardTargetId ?? -1,
        m.orderQueue?.length ?? 0);
      for (const w of m.orderQueue ?? []) ints.push(q(w.wx), q(w.wy), w.attackMove ? 1 : 0);
    }
    const c = e.components.combat;
    if (c) ints.push(c.targetId ?? -1, c.cooldownRemaining, c.ammo ?? -1,
      c.stance === 'hold' ? 2 : c.stance === 'defensive' ? 1 : 0, c.revealedTicks ?? 0);
    const b = e.components.building;
    if (b) ints.push(q(b.buildProgress), b.powered ? 1 : 0, b.repairing ? 1 : 0);
    const t = e.components.tech;
    if (t) ints.push(t.tier, t.upgradingTo ?? -1, t.ticksLeft);
    const st = e.components.stealth;
    if (st) ints.push(st.cloaked ? 1 : 0, st.decloakTicks);
    const sh = e.components.shield;
    if (sh) ints.push(q(sh.hp), sh.regenDelay);
    const box = e.components.container;
    if (box) { ints.push(box.stored.length); for (const u of box.stored) ints.push(q(u.hp)); }
    const xp = e.components.experience;
    if (xp) ints.push(xp.kills);
    const prod = e.components.production;
    if (prod) { ints.push(prod.queue.length, q(prod.progress)); for (const k of prod.queue) ints.push(k.length); }
    const hv = e.components.harvest;
    if (hv) ints.push(q(hv.cargo), hv.state === 'SEEK' ? 0 : hv.state === 'HARVEST' ? 1 : hv.state === 'RETURN' ? 2 : hv.state === 'DOCK' ? 3 : 4, hv.targetRefinery ?? -1);
    const pj = e.components.projectile;
    if (pj) ints.push(pj.target.wx, pj.target.wy, pj.speed);
    const pw = e.components.power;
    if (pw) ints.push(pw.powerSupply, pw.powerDemand);
  }
  // RA build flow (v0.55): the sidebar structure jobs are authoritative state.
  for (const team of ['player', 'enemy']) {
    const job = state.structureBuild.get(team);
    ints.push(job ? strCode(job.structureId) : 0, job?.ticksLeft ?? -1, job?.totalTicks ?? -1);
  }
  // Shard density is gameplay-critical state (harvesting depletes it; regrowth/blooms
  // will write it) → fold it in, walked in sorted-key order so Map iteration order can't
  // leak nondeterminism into the hash.
  const shardKeys = [...state.shardDensity.keys()].sort();
  for (const k of shardKeys) ints.push(state.shardDensity.get(k)!);
  // Refinements (economy depth): walked in sorted team order; done ids sorted so
  // set-iteration order can't leak into the hash.
  const refTeams = [...state.refinements.keys()].sort();
  for (const team of refTeams) {
    const led = state.refinements.get(team)!;
    ints.push(strCode(team), led.ticksLeft, led.researching ? strCode(led.researching) : -1, led.done.length);
    for (const id of [...led.done].sort()) ints.push(strCode(id));
  }
  return hashInts(ints);
}
