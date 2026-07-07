// ── S6B: continuous attack-wave behavior (rolling reinforcement) ────────────────
import { describe, it, expect, beforeEach } from 'vitest';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { makeAiSystem } from '../../src/sim/systems/ai.js';
import { orderSystems, runTick, type SimSystem } from '../../src/sim/loop.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import { loadUnits } from '../../src/loaders/units.js';
import unitsData from '../../data/units.json' with { type: 'json' };

const units = loadUnits(unitsData);
const cfg = { team: 'enemy' as const, unitId: 'infantry', armySize: 2, attackTile: { tx: 5, ty: 5 } };
const TARGET = tileToWorldCenter(cfg.attackTile);

function addSoldier(state: SimState, tx: number) {
  return state.store.create({
    position: tileToWorldCenter({ tx, ty: 10 }),
    health: { hp: 20, maxHp: 20 },
    movement: { target: null, path: [], speed: 12 },
    combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
    faction: { team: 'enemy', faction: 'infantry' },
  });
}

describe('ai attack waves (S6B)', () => {
  let state: SimState;
  let systems: readonly SimSystem[];

  beforeEach(() => {
    state = makeSimState({ seed: 42, mapWidth: 32, mapHeight: 32 });
    systems = orderSystems([makeAiSystem(units, cfg)]);
  });

  it('sends rolling waves: a second armySize batch marches while wave 1 keeps its orders', () => {
    const a = addSoldier(state, 10);
    const b = addSoldier(state, 11);
    runTick(state, systems); // wave 1 → a,b dispatched
    expect(state.store.get(a)?.components.movement?.target).toEqual(TARGET);
    expect(state.store.get(b)?.components.movement?.target).toEqual(TARGET);

    // Reinforcements arrive.
    const c = addSoldier(state, 12);
    const d = addSoldier(state, 13);
    runTick(state, systems); // wave 2 → c,d dispatched; a,b untouched
    expect(state.store.get(c)?.components.movement?.target).toEqual(TARGET);
    expect(state.store.get(d)?.components.movement?.target).toEqual(TARGET);
    // Wave-1 units still carry their orders (not re-issued/cleared).
    expect(state.store.get(a)?.components.movement?.target).toEqual(TARGET);
  });

  it('a committed unit that goes idle is NOT re-dispatched (stays in the dispatched set)', () => {
    const a = addSoldier(state, 10);
    addSoldier(state, 11);
    runTick(state, systems); // both dispatched

    // Simulate the unit arriving and going idle (target cleared by the movement system).
    const ua = state.store.get(a);
    if (ua?.components.movement) ua.components.movement.target = null;

    runTick(state, systems); // must NOT re-order it — it's already committed
    expect(state.store.get(a)?.components.movement?.target).toBeNull();
  });

  it('prunes a dead dispatched unit; fresh reinforcements still form the next wave', () => {
    const a = addSoldier(state, 10);
    const b = addSoldier(state, 11);
    runTick(state, systems); // a,b dispatched

    // a dies; one fresh unit arrives → only 1 fresh (< armySize) → no new wave yet.
    state.store.remove(a);
    const c = addSoldier(state, 12);
    runTick(state, systems);
    expect(state.store.get(c)?.components.movement?.target).toBeNull();

    // A second reinforcement makes 2 fresh (c,d) → they march as the next wave.
    const d = addSoldier(state, 13);
    runTick(state, systems);
    expect(state.store.get(c)?.components.movement?.target).toEqual(TARGET);
    expect(state.store.get(d)?.components.movement?.target).toEqual(TARGET);
    // b (still alive, already committed) keeps its original order.
    expect(state.store.get(b)?.components.movement?.target).toEqual(TARGET);
  });
});
