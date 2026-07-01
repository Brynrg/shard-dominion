// ── Fog system unit tests ───────────────────────────────────────────────────────
import { describe, it, expect, beforeEach } from 'vitest';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { makeFogSystem } from '../../src/sim/systems/fog.js';
import { makeMovementSystem } from '../../src/sim/systems/movement.js';
import { orderSystems, runTick, type SimSystem } from '../../src/sim/loop.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';

describe('fog system', () => {
  let state: SimState;
  let systems: readonly SimSystem[];
  let fogSystem: ReturnType<typeof makeFogSystem>;

  beforeEach(() => {
    state = makeSimState({ seed: 42, mapWidth: 32, mapHeight: 32 });
    fogSystem = makeFogSystem();
    systems = orderSystems([fogSystem, makeMovementSystem()]);
  });

  it('tile on a player unit is visible', () => {
    // Create a player unit at tile (5, 5)
    const pos = tileToWorldCenter({ tx: 5, ty: 5 });
    state.store.create({
      position: pos,
      faction: { team: 'player', faction: 'rifle_trooper' },
    });

    // Run tick to compute visibility
    runTick(state, systems);

    // The tile where the unit is should be visible
    expect(fogSystem.visible.has('5,5')).toBe(true);
    expect(fogSystem.explored.has('5,5')).toBe(true);
  });

  it('tile far away (> 6 tiles circular, but within bounding box) is NOT visible', () => {
    // Create a player unit at tile (10, 10)
    const pos = tileToWorldCenter({ tx: 10, ty: 10 });
    state.store.create({
      position: pos,
      faction: { team: 'player', faction: 'rifle_trooper' },
    });

    // Run tick to compute visibility
    runTick(state, systems);

    // Tile (10, 16) is exactly 6 tiles away (on the axis) - at the edge of visibility
    expect(fogSystem.visible.has('10,16')).toBe(true);
    expect(fogSystem.explored.has('10,16')).toBe(true);

    // Tile (14, 15) is sqrt(16+25) = ~6.4 tiles away - outside circular radius
    // but within the 6-tile bounding box (dx=4, dy=5, both <= 6)
    expect(fogSystem.visible.has('14,15')).toBe(false);
    // But it should still be explored since we computed it (within bounding box)
    expect(fogSystem.explored.has('14,15')).toBe(true);
  });

  it('explored persists after the unit moves away', () => {
    // Create a player unit at tile (5, 5)
    const pos = tileToWorldCenter({ tx: 5, ty: 5 });
    const id = state.store.create({
      position: pos,
      faction: { team: 'player', faction: 'rifle_trooper' },
    });

    // Run tick to compute visibility
    runTick(state, systems);

    // Verify initial visibility
    expect(fogSystem.visible.has('5,5')).toBe(true);
    expect(fogSystem.explored.has('5,5')).toBe(true);

    // Move the unit to a different location (tile 15, 15)
    const newEntity = state.store.get(id);
    if (newEntity?.components.position) {
      newEntity.components.position = tileToWorldCenter({ tx: 15, ty: 15 });
    }

    // Run another tick
    runTick(state, systems);

    // Old tile (5,5) is no longer visible (unit moved away)
    expect(fogSystem.visible.has('5,5')).toBe(false);
    // But it IS still in explored (persistence)
    expect(fogSystem.explored.has('5,5')).toBe(true);

    // New tile (15,15) is now visible
    expect(fogSystem.visible.has('15,15')).toBe(true);
    expect(fogSystem.explored.has('15,15')).toBe(true);
  });

  it('tile near an enemy-only unit is NOT visible', () => {
    // Create an enemy unit at tile (5, 5)
    const pos = tileToWorldCenter({ tx: 5, ty: 5 });
    state.store.create({
      position: pos,
      faction: { team: 'enemy', faction: 'rifle_trooper' },
    });

    // Run tick to compute visibility
    runTick(state, systems);

    // Tile near the enemy should NOT be visible (no player units nearby)
    expect(fogSystem.visible.has('5,5')).toBe(false);
    expect(fogSystem.visible.has('4,5')).toBe(false);
    expect(fogSystem.visible.has('6,5')).toBe(false);

    // And explored should also be empty since no player units exist
    expect(fogSystem.explored.has('5,5')).toBe(false);
    expect(fogSystem.explored.has('4,5')).toBe(false);
    expect(fogSystem.explored.has('6,5')).toBe(false);
  });

  it('circular vision radius is respected', () => {
    // Create a player unit at tile (10, 10)
    const pos = tileToWorldCenter({ tx: 10, ty: 10 });
    state.store.create({
      position: pos,
      faction: { team: 'player', faction: 'rifle_trooper' },
    });

    // Run tick to compute visibility
    runTick(state, systems);

    // Tile (10, 16) is exactly 6 tiles away (on the axis) - should be visible
    expect(fogSystem.visible.has('10,16')).toBe(true);

    // Tile (14, 14) is sqrt(16+16) = ~5.66 tiles away - should be visible
    expect(fogSystem.visible.has('14,14')).toBe(true);

    // Tile (14, 15) is sqrt(16+25) = ~6.4 tiles away - should NOT be visible
    expect(fogSystem.visible.has('14,15')).toBe(false);
  });

  it('vision is clamped to grid bounds', () => {
    // Create a player unit at tile (0, 0) (corner)
    const pos = tileToWorldCenter({ tx: 0, ty: 0 });
    state.store.create({
      position: pos,
      faction: { team: 'player', faction: 'rifle_trooper' },
    });

    // Run tick to compute visibility
    runTick(state, systems);

    // Tile (0,0) should be visible
    expect(fogSystem.visible.has('0,0')).toBe(true);

    // Tiles with negative coordinates should not exist in visible set
    expect(fogSystem.visible.has('-1,0')).toBe(false);
    expect(fogSystem.visible.has('0,-1')).toBe(false);
    expect(fogSystem.visible.has('-1,-1')).toBe(false);
  });
});
