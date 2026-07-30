// ── AI dispatch/commit behaviour (v0.24 FSM Assault) ────────────────────────────
// Under Assault the AI commits every idle-fresh combat unit at the target, never
// re-orders a committed unit, and prunes dead ids from its committed set.
import { describe, it, expect, beforeEach } from 'vitest';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { makeAiSystem } from '../../src/sim/systems/ai.js';
import { orderSystems, runTick, type SimSystem } from '../../src/sim/loop.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import { loadUnits } from '../../src/loaders/units.js';
import { loadStructures } from '../../src/loaders/structures.js';
import { AI_PERSONALITIES } from '../../src/sim/aiPersonality.js';
import unitsData from '../../data/units.json' with { type: 'json' };
import structuresData from '../../data/structures.json' with { type: 'json' };

const units = loadUnits(unitsData);
const structures = loadStructures(structuresData);
// Low assault threshold so 2 infantry (value 200) trigger a commit; disable Pressure.
// This suite tests DISPATCH mechanics (commit / prune / never re-order a committed
// unit), not wave pacing — so no post-assault lull and no learning grace, otherwise
// the AI legitimately falls quiet after its first wave and the assertions sample a lull.
const cfg = {
  team: 'enemy' as const, attackTile: { tx: 5, ty: 5 }, evalInterval: 1,
  assaultValue: 200, pressureValue: 100000,
  personality: { ...AI_PERSONALITIES.normal, waveLullTicks: 0, graceTicks: 0, raidHarvesters: false },
};
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

describe('ai FSM — assault dispatch', () => {
  let state: SimState;
  let systems: readonly SimSystem[];

  beforeEach(() => {
    state = makeSimState({ seed: 42, mapWidth: 32, mapHeight: 32 });
    // A living harvester keeps the plan out of Stabilize.
    state.store.create({
      position: tileToWorldCenter({ tx: 20, ty: 20 }),
      movement: { target: null, path: [], speed: 10 },
      faction: { team: 'enemy', faction: 'harvester' },
      health: { hp: 200, maxHp: 200 },
      harvest: { state: 'SEEK', targetTile: null, targetRefinery: null, cargo: 0 },
    });
    systems = orderSystems([makeAiSystem(units, cfg, structures)]);
  });

  it('commits idle-fresh units; reinforcements dispatch next eval; prior orders kept', () => {
    const a = addSoldier(state, 10);
    const b = addSoldier(state, 11);
    runTick(state, systems); // army value 200 → Assault → a,b committed
    expect(state.store.get(a)?.components.movement?.target).toEqual(TARGET);
    expect(state.store.get(b)?.components.movement?.target).toEqual(TARGET);

    const c = addSoldier(state, 12);
    const d = addSoldier(state, 13);
    runTick(state, systems); // c,d committed; a,b untouched
    expect(state.store.get(c)?.components.movement?.target).toEqual(TARGET);
    expect(state.store.get(d)?.components.movement?.target).toEqual(TARGET);
    expect(state.store.get(a)?.components.movement?.target).toEqual(TARGET);
  });

  it('a committed unit that goes idle is NOT re-dispatched', () => {
    const a = addSoldier(state, 10);
    addSoldier(state, 11);
    runTick(state, systems);

    const ua = state.store.get(a);
    if (ua?.components.movement) ua.components.movement.target = null; // arrived / idle

    runTick(state, systems);
    expect(state.store.get(a)?.components.movement?.target).toBeNull();
  });

  it('prunes a dead committed unit; survivors keep orders; fresh reinforcements commit', () => {
    const a = addSoldier(state, 10);
    const b = addSoldier(state, 11);
    runTick(state, systems); // a,b committed

    state.store.remove(a);        // a dies (pruned from committed)
    const c = addSoldier(state, 12);
    runTick(state, systems);      // still Assault → c committed; b keeps its order; no crash
    expect(state.store.get(c)?.components.movement?.target).toEqual(TARGET);
    expect(state.store.get(b)?.components.movement?.target).toEqual(TARGET);
  });
});
