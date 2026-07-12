// ── CONTRACT: the fixed-timestep loop + the canonical system order ───────────
// 20 Hz fixed step, bounded catch-up, draw every frame with interpolation. The
// renderer (src/view) drives wall-clock + rAF and calls accumulate()/runTick();
// the sim itself never reads wall-clock. The SYSTEM_ORDER is pinned: a tick runs
// systems in exactly this order every time (determinism).
import { asTick } from './ids.js';
import type { SimState } from './state.js';

export const SIM_TICK_RATE = 20 as const;
export const STEP_MS = 1000 / SIM_TICK_RATE; // 50ms
export const MAX_CATCHUP_TICKS = 5 as const;

/** The canonical, immutable order systems run within one tick (plan §3.3). */
export const SYSTEM_ORDER = [
  'command',
  'mission',
  'ai',
  'order',
  'movement',
  'harvest',
  'construction',
  'production',
  'research',
  'power',
  'combatTargeting',
  'projectile',
  'damage',
  'agitation',
  'planetEvent',
  'fog',
  'victory',
  'audio',
] as const;
export type SystemName = (typeof SYSTEM_ORDER)[number];

export interface SimSystem {
  readonly name: SystemName;
  run(state: SimState): void;
}

const ORDER_INDEX: Readonly<Record<SystemName, number>> = Object.freeze(
  Object.fromEntries(SYSTEM_ORDER.map((n, i) => [n, i])) as Record<SystemName, number>,
);

/** Sort registered systems into the canonical fixed order. */
export function orderSystems(systems: readonly SimSystem[]): SimSystem[] {
  return [...systems].sort((a, b) => ORDER_INDEX[a.name] - ORDER_INDEX[b.name]);
}

export interface Accumulated {
  readonly steps: number;
  readonly remainderMs: number;
}

/**
 * Fixed-timestep accumulator. Returns how many whole ticks to run and the
 * sub-step remainder (which the renderer uses as interpolation alpha). Catch-up
 * is bounded to MAX_CATCHUP_TICKS; surplus backlog beyond the cap is dropped so
 * a stalled tab can't enter a spiral of death.
 */
export function accumulate(accMs: number, frameDtMs: number): Accumulated {
  let acc = accMs + frameDtMs;
  let steps = 0;
  while (acc >= STEP_MS && steps < MAX_CATCHUP_TICKS) {
    acc -= STEP_MS;
    steps += 1;
  }
  if (acc >= STEP_MS) acc = acc % STEP_MS; // hit the cap: drop whole-step backlog
  return { steps, remainderMs: acc };
}

/**
 * Advance the sim one tick: snapshot prev positions (for interpolation) BEFORE
 * mutation, run systems in order, then bump the tick. `systems` must already be
 * in canonical order (use orderSystems()).
 */
export function runTick(state: SimState, systems: readonly SimSystem[]): void {
  state.prevPositions.clear();
  for (const e of state.store.all()) {
    if (e.components.position) state.prevPositions.set(e.id, e.components.position);
  }
  for (const sys of systems) sys.run(state);
  state.tick = asTick(state.tick + 1);
}
