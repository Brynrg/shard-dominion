// ── Context-sensitive right-click ('order') + buildable Barracks ────────────────
import { describe, it, expect, beforeEach } from 'vitest';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { makeCommandSystem } from '../../src/sim/systems/command.js';
import { orderSystems, runTick, type SimSystem } from '../../src/sim/loop.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import { makeCommandQueue, type CommandIntent } from '../../src/view/input.js';
import { loadStructures } from '../../src/loaders/structures.js';
import structuresData from '../../data/structures.json' with { type: 'json' };

const structures = loadStructures(structuresData);

describe('order + build commands', () => {
  let state: SimState;
  let systems: readonly SimSystem[];
  let queue: { drain(): CommandIntent[]; push(i: CommandIntent): void };

  beforeEach(() => {
    state = makeSimState({ seed: 42, mapWidth: 32, mapHeight: 32 });
    queue = makeCommandQueue();
    systems = orderSystems([makeCommandSystem(queue, structures)]);
  });

  function addSoldier(tx: number, ty: number) {
    return state.store.create({
      position: tileToWorldCenter({ tx, ty }),
      health: { hp: 20, maxHp: 20 }, armor: { armorClass: 'LIGHT' },
      movement: { target: null, path: [], speed: 12 },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
      selection: { selected: true },
      faction: { team: 'player', faction: 'infantry' },
    });
  }

  it('right-click an enemy → attack (target set + drive toward it)', () => {
    const me = addSoldier(5, 5);
    const enemyPos = tileToWorldCenter({ tx: 9, ty: 5 });
    const enemy = state.store.create({
      position: enemyPos, health: { hp: 20, maxHp: 20 },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
      faction: { team: 'enemy', faction: 'infantry' },
    });
    queue.push({ type: 'order', target: enemyPos, tile: { tx: 9, ty: 5 } });
    runTick(state, systems);
    const e = state.store.get(me);
    expect(e?.components.combat?.targetId).toBe(enemy);
    expect(e?.components.movement?.target).toEqual(enemyPos);
  });

  it('right-click a Shard tile → harvester is sent to mine it', () => {
    const h = state.store.create({
      position: tileToWorldCenter({ tx: 5, ty: 5 }),
      movement: { target: null, path: [], speed: 10 },
      harvest: { state: 'IDLE', targetTile: null, targetRefinery: null, cargo: 0 },
      selection: { selected: true },
      faction: { team: 'player', faction: 'harvester' },
    });
    state.shardDensity.set('8,5', 300);
    queue.push({ type: 'order', target: tileToWorldCenter({ tx: 8, ty: 5 }), tile: { tx: 8, ty: 5 } });
    runTick(state, systems);
    const hv = state.store.get(h)?.components.harvest;
    expect(hv?.state).toBe('SEEK');
    expect(hv?.targetTile).toEqual({ tx: 8, ty: 5 });
  });

  it('right-click open ground → plain move', () => {
    const me = addSoldier(5, 5);
    const dest = tileToWorldCenter({ tx: 12, ty: 12 });
    queue.push({ type: 'order', target: dest, tile: { tx: 12, ty: 12 } });
    runTick(state, systems);
    const e = state.store.get(me);
    expect(e?.components.movement?.target).toEqual(dest);
    expect(e?.components.combat?.targetId).toBeNull(); // no enemy → not an attack
  });

  it('a selected BUILDING never moves on a right-click order', () => {
    const b = state.store.create({
      position: tileToWorldCenter({ tx: 6, ty: 6 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'refinery' },
      selection: { selected: true },
      health: { hp: 1500, maxHp: 1500 }, armor: { armorClass: 'BUILDING' },
    });
    queue.push({ type: 'order', target: tileToWorldCenter({ tx: 15, ty: 15 }), tile: { tx: 15, ty: 15 } });
    runTick(state, systems);
    expect(state.store.get(b)?.components.movement).toBeUndefined(); // no movement component grafted on
  });

  it('build a Barracks: charges 300 credits, spawns a producer building', () => {
    // A ConYard for build radius + an economy to pay from.
    state.store.create({
      position: tileToWorldCenter({ tx: 6, ty: 6 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'construction_yard' },
      health: { hp: 2000, maxHp: 2000 }, armor: { armorClass: 'BUILDING' },
    });
    const bankId = state.store.create({
      position: tileToWorldCenter({ tx: 6, ty: 6 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'refinery' },
      economy: { credits: 700, refineryStorage: 700, maxStorage: 2000 },
      health: { hp: 1500, maxHp: 1500 }, armor: { armorClass: 'BUILDING' },
    });
    queue.push({ type: 'place-structure', structureId: 'barracks', tile: { tx: 8, ty: 6 } });
    runTick(state, systems);
    const barracks = state.store.all().find(e =>
      e.components.faction?.team === 'player' && e.components.faction?.faction === 'barracks');
    expect(barracks).toBeDefined();
    expect(barracks?.components.production).toBeDefined();          // can train
    expect(state.store.get(bankId)?.components.economy?.credits).toBe(400); // 700 - 300
  });

  it('build is rejected when the bank cannot afford it', () => {
    state.store.create({
      position: tileToWorldCenter({ tx: 6, ty: 6 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'construction_yard' },
      health: { hp: 2000, maxHp: 2000 }, armor: { armorClass: 'BUILDING' },
    });
    state.store.create({
      position: tileToWorldCenter({ tx: 6, ty: 6 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'refinery' },
      economy: { credits: 100, refineryStorage: 100, maxStorage: 2000 }, // < 300
      health: { hp: 1500, maxHp: 1500 }, armor: { armorClass: 'BUILDING' },
    });
    queue.push({ type: 'place-structure', structureId: 'barracks', tile: { tx: 8, ty: 6 } });
    runTick(state, systems);
    const barracks = state.store.all().find(e => e.components.faction?.faction === 'barracks');
    expect(barracks).toBeUndefined();
  });
});
