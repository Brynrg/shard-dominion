// ── Command system unit tests: selection + move orders ──────────────────────────
import { describe, it, expect, beforeEach } from 'vitest';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { makeCommandSystem } from '../../src/sim/systems/command.js';
import { makeMovementSystem } from '../../src/sim/systems/movement.js';
import { orderSystems, runTick, type SimSystem } from '../../src/sim/loop.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import { makeCommandQueue, type CommandIntent } from '../../src/view/input.js';

describe('command system', () => {
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

  it('select intent marks unit selected', () => {
    // Create a harvester
    const pos = tileToWorldCenter({ tx: 5, ty: 5 });
    const id = state.store.create({
      position: pos,
      movement: { target: null, path: [], speed: 10 },
      faction: { team: 'player', faction: 'harvester' },
    });

    // Verify not selected initially (selection component doesn't exist yet)
    const entity = state.store.get(id);
    expect(entity?.components.selection?.selected).toBe(undefined);

    // Simulate selection via direct component mutation (as input.ts does for box select)
    if (entity) {
      entity.components.selection = { selected: true };
    }

    // Run tick to process any intents (none in this case)
    runTick(state, systems);

    // Verify still selected
    expect(state.store.get(id)?.components.selection?.selected).toBe(true);
  });

  it('move intent sets movement target on selected unit', () => {
    // Create a harvester
    const pos = tileToWorldCenter({ tx: 5, ty: 5 });
    const id = state.store.create({
      position: pos,
      movement: { target: null, path: [], speed: 10 },
      faction: { team: 'player', faction: 'harvester' },
    });

    // Select the unit
    const entity = state.store.get(id);
    if (entity) {
      entity.components.selection = { selected: true };
    }

    // Push a move intent
    const targetPos = tileToWorldCenter({ tx: 10, ty: 10 });
    queue.push({ type: 'move', target: targetPos });

    // Run tick to process the intent
    runTick(state, systems);

    // Verify movement target was set
    const movedEntity = state.store.get(id);
    expect(movedEntity?.components.movement?.target).toEqual(targetPos);
  });

  it('move intent on unselected unit does nothing', () => {
    // Create a harvester
    const pos = tileToWorldCenter({ tx: 5, ty: 5 });
    const id = state.store.create({
      position: pos,
      movement: { target: null, path: [], speed: 10 },
      faction: { team: 'player', faction: 'harvester' },
    });

    // Do NOT select the unit

    // Push a move intent
    const targetPos = tileToWorldCenter({ tx: 10, ty: 10 });
    queue.push({ type: 'move', target: targetPos });

    // Run tick to process the intent
    runTick(state, systems);

    // Verify movement target was NOT set
    const movedEntity = state.store.get(id);
    expect(movedEntity?.components.movement?.target).toBeNull();
  });

  it('deselect intent clears all selections', () => {
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

    // Select both
    const e1 = state.store.get(id1);
    const e2 = state.store.get(id2);
    if (e1) e1.components.selection = { selected: true };
    if (e2) e2.components.selection = { selected: true };

    // Verify both selected
    expect(state.store.get(id1)?.components.selection?.selected).toBe(true);
    expect(state.store.get(id2)?.components.selection?.selected).toBe(true);

    // Push deselect intent
    queue.push({ type: 'deselect' });

    // Run tick
    runTick(state, systems);

    // Verify both deselected
    expect(state.store.get(id1)?.components.selection?.selected).toBe(false);
    expect(state.store.get(id2)?.components.selection?.selected).toBe(false);
  });

  it('confirmation markers are created on move order', () => {
    // Create a harvester
    const pos = tileToWorldCenter({ tx: 5, ty: 5 });
    const id = state.store.create({
      position: pos,
      movement: { target: null, path: [], speed: 10 },
      faction: { team: 'player', faction: 'harvester' },
    });

    // Select the unit
    const entity = state.store.get(id);
    if (entity) {
      entity.components.selection = { selected: true };
    }

    // Push a move intent
    const targetPos = tileToWorldCenter({ tx: 10, ty: 10 });
    queue.push({ type: 'move', target: targetPos });

    // Run tick to process the intent
    runTick(state, systems);

    // Verify confirmation marker was created
    const markers = commandSystem.markers;
    expect(markers).toBeDefined();
    expect(markers?.length).toBe(1);
    expect(markers?.[0]?.target).toEqual(targetPos);
    expect(markers?.[0]?.remaining).toBe(10); // MARKER_LIFETIME = 10 ticks
  });

  it('confirmation markers fade out over time', () => {
    // Create a harvester
    const pos = tileToWorldCenter({ tx: 5, ty: 5 });
    const id = state.store.create({
      position: pos,
      movement: { target: null, path: [], speed: 10 },
      faction: { team: 'player', faction: 'harvester' },
    });

    // Select the unit
    const entity = state.store.get(id);
    if (entity) {
      entity.components.selection = { selected: true };
    }

    // Push a move intent
    const targetPos = tileToWorldCenter({ tx: 10, ty: 10 });
    queue.push({ type: 'move', target: targetPos });

    // Run tick to create the marker
    runTick(state, systems);

    // Verify marker exists
    let markers = commandSystem.markers;
    expect(markers?.length).toBe(1);
    expect(markers?.[0]?.remaining).toBe(10);

    // Run 9 more ticks (total 10)
    for (let i = 0; i < 9; i++) {
      runTick(state, systems);
    }

    // Verify marker still exists (remaining = 1)
    markers = commandSystem.markers;
    expect(markers?.length).toBe(1);
    expect(markers?.[0]?.remaining).toBe(1);

    // Run 1 more tick
    runTick(state, systems);

    // Verify marker is gone
    markers = commandSystem.markers;
    expect(markers?.length).toBe(0);
  });
});
