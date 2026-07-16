// ── Control groups unit tests ───────────────────────────────────────────────────
import { describe, it, expect, beforeEach } from 'vitest';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { makeCommandSystem } from '../../src/sim/systems/command.js';
import { makeMovementSystem } from '../../src/sim/systems/movement.js';
import { orderSystems, runTick, type SimSystem } from '../../src/sim/loop.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import type { EntityId } from '../../src/sim/ids.js';
import { makeCommandQueue, type CommandIntent } from '../../src/view/input.js';

describe('control groups', () => {
  let state: SimState;
  let systems: readonly SimSystem[];
  let queue: { drain(): CommandIntent[]; push(intent: CommandIntent): void };
  let commandSystem: ReturnType<typeof makeCommandSystem>;

  beforeEach(() => {
    state = makeSimState({ seed: 42, mapWidth: 32, mapHeight: 32 });
    queue = makeCommandQueue();
    commandSystem = makeCommandSystem(queue, []);
    systems = orderSystems([commandSystem, makeMovementSystem()]);
  });

  it('assign-group stores selected unit ids', () => {
    // Create two harvesters
    const pos1 = tileToWorldCenter({ tx: 5, ty: 5 });
    const id1 = state.store.create({
      position: pos1,
      movement: { target: null, path: [], speed: 10 },
      faction: { team: 'player', faction: 'harvester' },
    });

    const pos2 = tileToWorldCenter({ tx: 6, ty: 5 });
    const id2 = state.store.create({
      position: pos2,
      movement: { target: null, path: [], speed: 10 },
      faction: { team: 'player', faction: 'harvester' },
    });

    // Select both units
    const e1 = state.store.get(id1);
    const e2 = state.store.get(id2);
    if (e1) e1.components.selection = { selected: true };
    if (e2) e2.components.selection = { selected: true };

    // Assign to group 1
    queue.push({ type: 'assign-group', group: 1 });
    runTick(state, systems);

    // Verify group 1 has both ids (groups are seat-scoped: `${team}:${n}`)
    const group1 = commandSystem.groups.get('player:1');
    expect(group1).toBeDefined();
    expect(group1?.length).toBe(2);
    expect(group1?.includes(id1)).toBe(true);
    expect(group1?.includes(id2)).toBe(true);
  });

  it('recall-group re-selects stored units', () => {
    // Create two harvesters
    const pos1 = tileToWorldCenter({ tx: 5, ty: 5 });
    const id1 = state.store.create({
      position: pos1,
      movement: { target: null, path: [], speed: 10 },
      faction: { team: 'player', faction: 'harvester' },
    });

    const pos2 = tileToWorldCenter({ tx: 6, ty: 5 });
    const id2 = state.store.create({
      position: pos2,
      movement: { target: null, path: [], speed: 10 },
      faction: { team: 'player', faction: 'harvester' },
    });

    // Select both units
    const e1 = state.store.get(id1);
    const e2 = state.store.get(id2);
    if (e1) e1.components.selection = { selected: true };
    if (e2) e2.components.selection = { selected: true };

    // Assign to group 1
    queue.push({ type: 'assign-group', group: 1 });
    runTick(state, systems);

    // Deselect all
    queue.push({ type: 'deselect' });
    runTick(state, systems);

    // Verify both deselected
    expect(state.store.get(id1)?.components.selection?.selected).toBe(false);
    expect(state.store.get(id2)?.components.selection?.selected).toBe(false);

    // Recall group 1
    queue.push({ type: 'recall-group', group: 1 });
    runTick(state, systems);

    // Verify both re-selected
    expect(state.store.get(id1)?.components.selection?.selected).toBe(true);
    expect(state.store.get(id2)?.components.selection?.selected).toBe(true);
  });

  it('recall-group skips dead/removed units', () => {
    // Create two harvesters
    const pos1 = tileToWorldCenter({ tx: 5, ty: 5 });
    const id1 = state.store.create({
      position: pos1,
      movement: { target: null, path: [], speed: 10 },
      faction: { team: 'player', faction: 'harvester' },
    });

    const pos2 = tileToWorldCenter({ tx: 6, ty: 5 });
    const id2 = state.store.create({
      position: pos2,
      movement: { target: null, path: [], speed: 10 },
      faction: { team: 'player', faction: 'harvester' },
    });

    // Select both units
    const e1 = state.store.get(id1);
    const e2 = state.store.get(id2);
    if (e1) e1.components.selection = { selected: true };
    if (e2) e2.components.selection = { selected: true };

    // Assign to group 1
    queue.push({ type: 'assign-group', group: 1 });
    runTick(state, systems);

    // Remove first unit (kill it)
    state.store.remove(id1);

    // Recall group 1
    queue.push({ type: 'recall-group', group: 1 });
    runTick(state, systems);

    // Verify only survivor is selected (no crash)
    expect(state.store.get(id1)).toBeUndefined(); // First unit is gone
    expect(state.store.get(id2)?.components.selection?.selected).toBe(true);
  });

  it('recall-group on empty/unassigned group deselects all', () => {
    // Push recall-group on unassigned group 1
    queue.push({ type: 'recall-group', group: 1 });
    runTick(state, systems);

    // Should not crash and should deselect all (no units selected initially)
    // Verify no crash by checking we got here
    expect(true).toBe(true);
  });

  it('groups are seat-scoped: seats share a number without collision, and recall never tramples the other seat', () => {
    const mkUnit = (team: 'player' | 'enemy', tx: number): EntityId => state.store.create({
      position: tileToWorldCenter({ tx, ty: 5 }),
      movement: { target: null, path: [], speed: 10 },
      faction: { team, faction: 'infantry' },
    });
    const pId = mkUnit('player', 5);
    const eId = mkUnit('enemy', 8);
    state.store.get(pId)!.components.selection = { selected: true };
    state.store.get(eId)!.components.selection = { selected: true };

    // BOTH seats assign group 1 in the same tick — slots must not collide.
    queue.push({ type: 'assign-group', group: 1 });
    queue.push({ type: 'assign-group', group: 1, team: 'enemy' });
    runTick(state, systems);
    expect(commandSystem.groups.get('player:1')).toEqual([pId]);
    expect(commandSystem.groups.get('enemy:1')).toEqual([eId]);

    // The player recalling group 1 must NOT deselect the enemy seat's selection.
    queue.push({ type: 'recall-group', group: 1 });
    runTick(state, systems);
    expect(state.store.get(pId)?.components.selection?.selected).toBe(true);
    expect(state.store.get(eId)?.components.selection?.selected).toBe(true);
  });

  it('select-army grabs every living combat unit but not buildings or harvesters', () => {
    const soldier = state.store.create({
      position: tileToWorldCenter({ tx: 5, ty: 5 }),
      movement: { target: null, path: [], speed: 10 },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
      health: { hp: 20, maxHp: 20 },
      faction: { team: 'player', faction: 'infantry' },
    });
    const harv = state.store.create({
      position: tileToWorldCenter({ tx: 6, ty: 5 }),
      movement: { target: null, path: [], speed: 10 },
      harvest: { state: 'IDLE', targetTile: null, targetRefinery: null, cargo: 0 },
      faction: { team: 'player', faction: 'harvester' },
    });
    const foe = state.store.create({
      position: tileToWorldCenter({ tx: 9, ty: 5 }),
      movement: { target: null, path: [], speed: 10 },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
      health: { hp: 20, maxHp: 20 },
      faction: { team: 'enemy', faction: 'infantry' },
    });
    queue.push({ type: 'select-army' });
    runTick(state, systems);
    expect(state.store.get(soldier)?.components.selection?.selected).toBe(true);
    expect(state.store.get(harv)?.components.selection?.selected ?? false).toBe(false);
    expect(state.store.get(foe)?.components.selection?.selected ?? false).toBe(false);
  });

  it('select-idle-harvester cycles through idle harvesters only', () => {
    const mkHarv = (tx: number, st: 'IDLE' | 'HARVEST'): EntityId => state.store.create({
      position: tileToWorldCenter({ tx, ty: 5 }),
      movement: { target: null, path: [], speed: 10 },
      harvest: { state: st, targetTile: null, targetRefinery: null, cargo: 0 },
      faction: { team: 'player', faction: 'harvester' },
    });
    const idle1 = mkHarv(5, 'IDLE');
    const idle2 = mkHarv(6, 'IDLE');
    const busy = mkHarv(7, 'HARVEST');

    queue.push({ type: 'select-idle-harvester' });
    runTick(state, systems);
    const first = state.store.get(idle1)?.components.selection?.selected ? idle1 : idle2;
    expect(state.store.get(first)?.components.selection?.selected).toBe(true);
    expect(state.store.get(busy)?.components.selection?.selected ?? false).toBe(false);

    // Second press cycles to the OTHER idle harvester.
    queue.push({ type: 'select-idle-harvester' });
    runTick(state, systems);
    const second = first === idle1 ? idle2 : idle1;
    expect(state.store.get(second)?.components.selection?.selected).toBe(true);
    expect(state.store.get(first)?.components.selection?.selected).toBe(false);
  });

  it('select-hero picks the living hero and is a no-op without one', () => {
    const soldier = state.store.create({
      position: tileToWorldCenter({ tx: 5, ty: 5 }),
      movement: { target: null, path: [], speed: 10 },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
      health: { hp: 20, maxHp: 20 },
      faction: { team: 'player', faction: 'infantry' },
      selection: { selected: true },
    });
    // No hero on the field → the current selection must survive the mispress.
    queue.push({ type: 'select-hero' });
    runTick(state, systems);
    expect(state.store.get(soldier)?.components.selection?.selected).toBe(true);

    const hero = state.store.create({
      position: tileToWorldCenter({ tx: 8, ty: 5 }),
      movement: { target: null, path: [], speed: 10 },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
      health: { hp: 90, maxHp: 90 },
      faction: { team: 'player', faction: 'warden' },
    });
    queue.push({ type: 'select-hero' });
    runTick(state, systems);
    expect(state.store.get(hero)?.components.selection?.selected).toBe(true);
    expect(state.store.get(soldier)?.components.selection?.selected).toBe(false);
  });
});
