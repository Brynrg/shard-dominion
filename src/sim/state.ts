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
  };
}

/**
 * Order-sensitive hash of the DYNAMIC sim state — the substrate of the blocking
 * determinism smoke (`sameSeed + sameCommandLog → identical hash`). Entities are
 * walked in ascending-id order, so any iteration-order nondeterminism changes it.
 */
export function stateHash(state: SimState): number {
  const ints: number[] = [state.tick, state.rng.state(), state.store.count()];
  for (const e of state.store.all()) {
    ints.push(e.id);
    const p = e.components.position;
    if (p) ints.push(p.wx, p.wy);
    const h = e.components.health;
    if (h) ints.push(h.hp, h.maxHp);
  }
  // Shard density is gameplay-critical state (harvesting depletes it; regrowth/blooms
  // will write it) → fold it in, walked in sorted-key order so Map iteration order can't
  // leak nondeterminism into the hash.
  const shardKeys = [...state.shardDensity.keys()].sort();
  for (const k of shardKeys) ints.push(state.shardDensity.get(k)!);
  return hashInts(ints);
}
