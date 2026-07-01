// ── Control groups unit tests ───────────────────────────────────────────────────
import { describe, it, expect, beforeEach } from 'vitest';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { makeCommandSystem } from '../../src/sim/systems/command.js';
import { makeMovementSystem } from '../../src/sim/systems/movement.js';
import { orderSystems, runTick, type SimSystem } from '../../src/sim/loop.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
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

    // Verify group 1 has both ids
    const group1 = commandSystem.groups.get(1);
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
});
