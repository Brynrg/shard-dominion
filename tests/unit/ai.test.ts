// ── AI system unit tests: build army then attack ────────────────────────────────
import { describe, it, expect, beforeEach } from 'vitest';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { makeAiSystem } from '../../src/sim/systems/ai.js';
import { makeProductionSystem } from '../../src/sim/systems/production.js';
import { orderSystems, runTick, type SimSystem } from '../../src/sim/loop.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import { loadUnits } from '../../src/loaders/units.js';
import unitsData from '../../data/units.json' with { type: 'json' };
import { asEntityId } from '../../src/sim/ids.js';

// Load units
const units = loadUnits(unitsData);

describe('ai system', () => {
  let state: SimState;
  let systems: readonly SimSystem[];

  const cfg = { team: 'enemy' as const, unitId: 'infantry', armySize: 3, attackTile: { tx: 5, ty: 5 } };

  beforeEach(() => {
    state = makeSimState({ seed: 42, mapWidth: 32, mapHeight: 32 });
    systems = orderSystems([makeAiSystem(units, cfg)]);
  });

  it('enemy producer with empty queue + rich bank queues infantry', () => {
    // Create enemy producer with empty queue
    const producerPos = tileToWorldCenter({ tx: 10, ty: 10 });
    const producerId = state.store.create({
      position: producerPos,
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'enemy', faction: 'construction_yard' },
      production: { queue: [], progress: 0 },
      economy: { credits: 500, refineryStorage: 0, maxStorage: 2000 },
    });

    // Run tick
    runTick(state, systems);

    // Verify queue now has infantry
    const producer = state.store.get(producerId);
    expect(producer?.components.production?.queue).toEqual(['infantry']);
  });

  it('enemy producer does NOT queue when bank cannot afford', () => {
    // Create enemy producer with empty queue and poor bank
    const producerPos = tileToWorldCenter({ tx: 10, ty: 10 });
    const producerId = state.store.create({
      position: producerPos,
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'enemy', faction: 'construction_yard' },
      production: { queue: [], progress: 0 },
      economy: { credits: 50, refineryStorage: 0, maxStorage: 2000 }, // 50 < 100 cost
    });

    // Run tick
    runTick(state, systems);

    // Verify queue stays empty
    const producer = state.store.get(producerId);
    expect(producer?.components.production?.queue).toEqual([]);
  });

  it('with only 2 enemy combat units, movement.target stays null', () => {
    // Create 2 enemy combat units
    const pos1 = tileToWorldCenter({ tx: 10, ty: 10 });
    state.store.create({
      position: pos1,
      health: { hp: 20, maxHp: 20 },
      movement: { target: null, path: [], speed: 12 },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
      faction: { team: 'enemy', faction: 'infantry' },
    });

    const pos2 = tileToWorldCenter({ tx: 11, ty: 10 });
    state.store.create({
      position: pos2,
      health: { hp: 20, maxHp: 20 },
      movement: { target: null, path: [], speed: 12 },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
      faction: { team: 'enemy', faction: 'infantry' },
    });

    // Run tick
    runTick(state, systems);

    // Verify movement.target is still null (armySize=3 not reached)
    const army1 = state.store.all().find(e => e.components.faction?.team === 'enemy' && e.components.combat && e.components.health && e.components.movement);
    const army2 = state.store.all().find((e, i) => e.components.faction?.team === 'enemy' && e.components.combat && e.components.health && e.components.movement && i > 0);
    expect(army1?.components.movement?.target).toBeNull();
    expect(army2?.components.movement?.target).toBeNull();
  });

  it('with 3 enemy combat units, idle ones march on attackTile', () => {
    // Create 3 enemy combat units
    const pos1 = tileToWorldCenter({ tx: 10, ty: 10 });
    const id1 = state.store.create({
      position: pos1,
      health: { hp: 20, maxHp: 20 },
      movement: { target: null, path: [], speed: 12 },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
      faction: { team: 'enemy', faction: 'infantry' },
    });

    const pos2 = tileToWorldCenter({ tx: 11, ty: 10 });
    const id2 = state.store.create({
      position: pos2,
      health: { hp: 20, maxHp: 20 },
      movement: { target: null, path: [], speed: 12 },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
      faction: { team: 'enemy', faction: 'infantry' },
    });

    const pos3 = tileToWorldCenter({ tx: 12, ty: 10 });
    const id3 = state.store.create({
      position: pos3,
      health: { hp: 20, maxHp: 20 },
      movement: { target: null, path: [], speed: 12 },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
      faction: { team: 'enemy', faction: 'infantry' },
    });

    // Run tick
    runTick(state, systems);

    // Verify all idle units have movement.target set to attackTile center
    const target = tileToWorldCenter({ tx: 5, ty: 5 });
    expect(state.store.get(id1)?.components.movement?.target).toEqual(target);
    expect(state.store.get(id2)?.components.movement?.target).toEqual(target);
    expect(state.store.get(id3)?.components.movement?.target).toEqual(target);
  });

  it('unit already fighting (combat.targetId set) is NOT retargeted', () => {
    // Create 3 enemy combat units, one already fighting
    const pos1 = tileToWorldCenter({ tx: 10, ty: 10 });
    const id1 = state.store.create({
      position: pos1,
      health: { hp: 20, maxHp: 20 },
      movement: { target: null, path: [], speed: 12 },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: asEntityId(999) }, // already fighting
      faction: { team: 'enemy', faction: 'infantry' },
    });

    const pos2 = tileToWorldCenter({ tx: 11, ty: 10 });
    const id2 = state.store.create({
      position: pos2,
      health: { hp: 20, maxHp: 20 },
      movement: { target: null, path: [], speed: 12 },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
      faction: { team: 'enemy', faction: 'infantry' },
    });

    const pos3 = tileToWorldCenter({ tx: 12, ty: 10 });
    const id3 = state.store.create({
      position: pos3,
      health: { hp: 20, maxHp: 20 },
      movement: { target: null, path: [], speed: 12 },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
      faction: { team: 'enemy', faction: 'infantry' },
    });

    // Run tick
    runTick(state, systems);

    // Fighting unit should NOT be retargeted
    expect(state.store.get(id1)?.components.movement?.target).toBeNull();
    // Idle units should be retargeted
    const target = tileToWorldCenter({ tx: 5, ty: 5 });
    expect(state.store.get(id2)?.components.movement?.target).toEqual(target);
    expect(state.store.get(id3)?.components.movement?.target).toEqual(target);
  });

  it('end-to-end: AI queues -> production builds -> enemy infantry exists', () => {
    // Setup: enemy producer + rich bank + ai system + production system
    const producerPos = tileToWorldCenter({ tx: 10, ty: 10 });
    state.store.create({
      position: producerPos,
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'enemy', faction: 'construction_yard' },
      production: { queue: [], progress: 0 },
      economy: { credits: 500, refineryStorage: 0, maxStorage: 2000 },
    });

    systems = orderSystems([
      makeAiSystem(units, cfg),
      makeProductionSystem(units),
    ]);

    // Run ~65 ticks to allow queue to be processed and unit built
    // infantry buildTimeSeconds=3 → 60 ticks at 20Hz
    for (let i = 0; i < 70; i++) {
      runTick(state, systems);
    }

    // Verify an enemy infantry unit exists
    const infantry = state.store.all().find(e =>
      e.components.faction?.team === 'enemy' &&
      e.components.faction?.faction === 'infantry' &&
      e.components.combat &&
      e.components.health &&
      e.components.movement
    );
    expect(infantry).toBeDefined();
    expect(infantry?.components.faction?.faction).toBe('infantry');
  });
});
