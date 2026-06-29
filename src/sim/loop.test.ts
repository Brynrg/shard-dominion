import { accumulate, runTick, orderSystems, SYSTEM_ORDER, STEP_MS, MAX_CATCHUP_TICKS, type SimSystem } from './loop.js';
import { makeSimState, stateHash, type SimState } from './state.js';
import { world } from './coords.js';

describe('fixed-timestep accumulator', () => {
  it('one step per STEP_MS, remainder carried', () => {
    expect(accumulate(0, STEP_MS)).toEqual({ steps: 1, remainderMs: 0 });
    expect(accumulate(0, STEP_MS * 2.5)).toEqual({ steps: 2, remainderMs: STEP_MS * 0.5 });
    expect(accumulate(STEP_MS * 0.5, STEP_MS * 0.5)).toEqual({ steps: 1, remainderMs: 0 });
  });
  it('catch-up is bounded (no spiral of death)', () => {
    const a = accumulate(0, STEP_MS * 100);
    expect(a.steps).toBe(MAX_CATCHUP_TICKS);
    expect(a.remainderMs).toBeLessThan(STEP_MS);
  });
});

describe('system order is canonical', () => {
  it('orderSystems sorts into SYSTEM_ORDER regardless of registration order', () => {
    const mk = (name: SimSystem['name']): SimSystem => ({ name, run: () => {} });
    const shuffled = [mk('damage'), mk('movement'), mk('command'), mk('ai')];
    expect(orderSystems(shuffled).map((s) => s.name)).toEqual(['command', 'ai', 'movement', 'damage']);
    expect(SYSTEM_ORDER[0]).toBe('command');
    expect(SYSTEM_ORDER[SYSTEM_ORDER.length - 1]).toBe('audio');
  });
});

// A trivial deterministic system: nudge every positioned entity by an rng step.
const mover: SimSystem = {
  name: 'movement',
  run(state: SimState): void {
    for (const e of state.store.all()) {
      const p = e.components.position;
      if (!p) continue;
      e.components.position = world(p.wx + (state.rng.nextInt(3) - 1), p.wy + (state.rng.nextInt(3) - 1));
    }
  },
};

function runMatch(seed: number): number {
  const state = makeSimState({ seed, mapWidth: 16, mapHeight: 16 });
  for (let i = 0; i < 10; i++) {
    state.store.create({ position: world(100 * i, 50 * i), health: { hp: 100, maxHp: 100 } });
  }
  const systems = orderSystems([mover]);
  for (let t = 0; t < 200; t++) runTick(state, systems);
  return stateHash(state);
}

describe('DETERMINISM SMOKE (blocking) — same seed + same systems → same hash', () => {
  it('reproduces exactly over 200 ticks', () => {
    expect(runMatch(42)).toBe(runMatch(42));
  });
  it('diverges on a different seed', () => {
    expect(runMatch(1)).not.toBe(runMatch(2));
  });
  it('advances the tick counter', () => {
    const state = makeSimState({ seed: 5, mapWidth: 8, mapHeight: 8 });
    runTick(state, []);
    runTick(state, []);
    expect(state.tick).toBe(2);
  });
});
