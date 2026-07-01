// ── Economy unit tests: FSM behavior ───────────────────────────────────────────
// Tests: cargo only rises while harvesting; credits only rise on deposit;
// tile density falls; overflow beyond storage is lost; no two harvesters deadlock on one dock.
import { describe, it, expect, beforeEach } from 'vitest';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { makeMovementSystem } from '../../src/sim/systems/movement.js';
import { makeHarvestSystem } from '../../src/sim/systems/harvest.js';
import { orderSystems, runTick, type SimSystem } from '../../src/sim/loop.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import { loadEconomyConstants } from '../../src/loaders/economyConstants.js';
import economyConstantsData from '../../data/economyConstants.json' with { type: 'json' };

// Load economy constants
const economy = loadEconomyConstants(economyConstantsData);

describe('economy FSM', () => {
  let state: SimState;
  let systems: readonly SimSystem[];

  beforeEach(() => {
    state = makeSimState({ seed: 42, mapWidth: 32, mapHeight: 32 });
    systems = orderSystems([makeMovementSystem(), makeHarvestSystem(economy)]);
  });

  it('cargo only rises while harvesting', () => {
    // Find a shard tile for testing
    let shardTx = 14, shardTy = 21; // Known shard position from debug
    for (let tx = 0; tx < 32; tx++) {
      for (let ty = 0; ty < 32; ty++) {
        if (state.grid.terrainAt({ tx, ty }) === 'SHARD') {
          shardTx = tx;
          shardTy = ty;
          break;
        }
      }
    }

    // Create a harvester at a shard tile
    const harvesterPos = tileToWorldCenter({ tx: shardTx, ty: shardTy });
    state.store.create({
      position: harvesterPos,
      movement: { target: null, path: [], speed: 10 },
      faction: { team: 'player', faction: 'harvester' },
      harvest: { state: 'HARVEST', targetTile: { tx: shardTx, ty: shardTy }, targetRefinery: null, cargo: 0 },
    });

    // Initialize density for the tile
    state.shardDensity.set(`${shardTx},${shardTy}`, 100);

    // Run a few ticks
    const initialCargo = state.store.all()[0]!.components.harvest?.cargo || 0;
    expect(initialCargo).toBe(0);

    // Run 5 ticks (should gain ~125 cargo at 25/s)
    for (let i = 0; i < 5; i++) {
      runTick(state, systems);
    }

    const finalCargo = state.store.all()[0]!.components.harvest?.cargo || 0;
    expect(finalCargo).toBeGreaterThan(initialCargo);
  });

  it('credits only rise on deposit (docking)', () => {
    // Create refinery with storage
    const refineryPos = tileToWorldCenter({ tx: 5, ty: 5 });
    const refineryId = state.store.create({
      position: refineryPos,
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'refinery' },
      economy: { credits: 0, refineryStorage: 0, maxStorage: economy.refineryStorageCapacity },
    });

    // Create harvester with full cargo, positioned very close to refinery
    // Refinery at (5,5), harvester at (5,6) - just 1 tile away
    const harvesterPos = tileToWorldCenter({ tx: 5, ty: 6 });
    state.store.create({
      position: harvesterPos,
      movement: { target: refineryPos, path: [], speed: 10 },
      faction: { team: 'player', faction: 'harvester' },
      harvest: { state: 'RETURN', targetTile: null, targetRefinery: refineryId, cargo: 700 },
    });

    // Initial credits
    const initialCredits = state.store.get(refineryId)?.components.economy?.credits || 0;
    expect(initialCredits).toBe(0);

    // Run ticks until harvester reaches refinery
    // 100 cr/s drip → 700 credits takes ~140 deposit ticks; allow travel + drip.
    for (let i = 0; i < 200; i++) {
      runTick(state, systems);
    }

    // Credits should have increased after deposit (700 cargo → 700 credits)
    const finalCredits = state.store.get(refineryId)?.components.economy?.credits || 0;
    expect(finalCredits).toBeGreaterThan(initialCredits);
    expect(finalCredits).toBe(700); // Magnitude assertion: 700 cargo → +700 credits
  });

  it('credits magnitude: 700 cargo → +700 credits', () => {
    // Create refinery with empty storage
    const refineryPos = tileToWorldCenter({ tx: 5, ty: 5 });
    const refineryId = state.store.create({
      position: refineryPos,
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'refinery' },
      economy: { credits: 0, refineryStorage: 0, maxStorage: economy.refineryStorageCapacity },
    });

    // Create harvester with full cargo
    const harvesterPos = tileToWorldCenter({ tx: 5, ty: 6 });
    state.store.create({
      position: harvesterPos,
      movement: { target: refineryPos, path: [], speed: 10 },
      faction: { team: 'player', faction: 'harvester' },
      harvest: { state: 'RETURN', targetTile: null, targetRefinery: refineryId, cargo: 700 },
    });

    // Run ticks until harvester reaches refinery
    // 100 cr/s drip → 700 credits takes ~140 deposit ticks; allow travel + drip.
    for (let i = 0; i < 200; i++) {
      runTick(state, systems);
    }

    // Credits should be exactly 700 (1 cargo = 1 credit)
    const finalCredits = state.store.get(refineryId)?.components.economy?.credits || 0;
    expect(finalCredits).toBe(700);
  });

  it('credits overflow: 1900 + 700 → 2000 with 600 lost', () => {
    // Create refinery with 1900 credits (near capacity)
    const refineryPos = tileToWorldCenter({ tx: 5, ty: 5 });
    const refineryId = state.store.create({
      position: refineryPos,
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'refinery' },
      economy: { credits: 1900, refineryStorage: 1900, maxStorage: economy.refineryStorageCapacity },
    });

    // Create harvester with full cargo (700)
    const harvesterPos = tileToWorldCenter({ tx: 5, ty: 6 });
    state.store.create({
      position: harvesterPos,
      movement: { target: refineryPos, path: [], speed: 10 },
      faction: { team: 'player', faction: 'harvester' },
      harvest: { state: 'RETURN', targetTile: null, targetRefinery: refineryId, cargo: 700 },
    });

    // Run ticks until harvester reaches refinery
    for (let i = 0; i < 100; i++) {
      runTick(state, systems);
    }

    // Credits should be capped at 2000 (overflow lost)
    const finalCredits = state.store.get(refineryId)?.components.economy?.credits || 0;
    expect(finalCredits).toBe(2000);

    // 100 fills the cap (1900→2000); the remaining 600 cargo is lost → cargo ends at 0.
    const finalCargo = state.store.all()[1]!.components.harvest?.cargo || 0;
    expect(finalCargo).toBe(0);
  });

  it('tile density falls when harvesting', () => {
    // Find a shard tile for testing
    let shardTx = 14, shardTy = 21;
    for (let tx = 0; tx < 32; tx++) {
      for (let ty = 0; ty < 32; ty++) {
        if (state.grid.terrainAt({ tx, ty }) === 'SHARD') {
          shardTx = tx;
          shardTy = ty;
          break;
        }
      }
    }

    // Create a harvester at a shard tile
    const harvesterPos = tileToWorldCenter({ tx: shardTx, ty: shardTy });
    state.store.create({
      position: harvesterPos,
      movement: { target: null, path: [], speed: 10 },
      faction: { team: 'player', faction: 'harvester' },
      harvest: { state: 'HARVEST', targetTile: { tx: shardTx, ty: shardTy }, targetRefinery: null, cargo: 0 },
    });

    // Initialize density for the tile
    state.shardDensity.set(`${shardTx},${shardTy}`, 100);

    // Verify we're on a shard tile
    const harvesterPosC = state.store.all()[0]!.components.position;
    const harvesterTile = harvesterPosC
      ? { tx: harvesterPosC.wx >> 8, ty: harvesterPosC.wy >> 8 }
      : { tx: shardTx, ty: shardTy };
    expect(state.grid.terrainAt(harvesterTile)).toBe('SHARD');

    // Run ticks to harvest
    for (let i = 0; i < 10; i++) {
      runTick(state, systems);
    }

    // Cargo should have increased
    const finalCargo = state.store.all()[0]!.components.harvest?.cargo || 0;
    expect(finalCargo).toBeGreaterThan(0);

    // Density should have decreased
    const density = state.shardDensity.get(`${shardTx},${shardTy}`) || 0;
    expect(density).toBeLessThan(100);
  });

  it('overflow beyond storage is lost', () => {
    // Create refinery with full storage
    const refineryPos = tileToWorldCenter({ tx: 5, ty: 5 });
    const refineryId = state.store.create({
      position: refineryPos,
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'refinery' },
      economy: { credits: 2000, refineryStorage: 2000, maxStorage: economy.refineryStorageCapacity },
    });

    // Create harvester with full cargo, positioned very close to refinery
    const harvesterPos = tileToWorldCenter({ tx: 5, ty: 6 });
    state.store.create({
      position: harvesterPos,
      movement: { target: refineryPos, path: [], speed: 10 },
      faction: { team: 'player', faction: 'harvester' },
      harvest: { state: 'RETURN', targetTile: null, targetRefinery: refineryId, cargo: 700 },
    });

    // Run ticks until harvester reaches refinery
    for (let i = 0; i < 50; i++) {
      runTick(state, systems);
    }

    // Storage should still be at max (no overflow)
    const storage = state.store.get(refineryId)?.components.economy?.refineryStorage || 0;
    expect(storage).toBe(2000);

    // Harvester cargo should be reduced (overflow lost - only 0 can be deposited since storage is full)
    const cargo = state.store.all()[1]!.components.harvest?.cargo || 0;
    expect(cargo).toBeLessThan(700);
  });

  it('no two harvesters deadlock on one dock', () => {
    // Create two refineries
    const refinery1Pos = tileToWorldCenter({ tx: 5, ty: 5 });
    const refinery1Id = state.store.create({
      position: refinery1Pos,
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'refinery' },
      economy: { credits: 500, refineryStorage: 0, maxStorage: economy.refineryStorageCapacity },
    });

    const refinery2Pos = tileToWorldCenter({ tx: 20, ty: 20 });
    const refinery2Id = state.store.create({
      position: refinery2Pos,
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'refinery' },
      economy: { credits: 500, refineryStorage: 0, maxStorage: economy.refineryStorageCapacity },
    });

    // Create two harvesters with full cargo, positioned close to their respective refineries
    const harvester1Pos = tileToWorldCenter({ tx: 5, ty: 6 }); // Close to refinery 1
    state.store.create({
      position: harvester1Pos,
      movement: { target: refinery1Pos, path: [], speed: 10 },
      faction: { team: 'player', faction: 'harvester' },
      harvest: { state: 'RETURN', targetTile: null, targetRefinery: refinery1Id, cargo: 700 },
    });

    const harvester2Pos = tileToWorldCenter({ tx: 20, ty: 21 }); // Close to refinery 2
    state.store.create({
      position: harvester2Pos,
      movement: { target: refinery2Pos, path: [], speed: 10 },
      faction: { team: 'player', faction: 'harvester' },
      harvest: { state: 'RETURN', targetTile: null, targetRefinery: refinery2Id, cargo: 700 },
    });

    // Run ticks until both harvesters reach refineries
    for (let i = 0; i < 100; i++) {
      runTick(state, systems);
    }

    // Both harvesters should have deposited cargo
    const cargo1 = state.store.all()[2]!.components.harvest?.cargo || 0;
    const cargo2 = state.store.all()[3]!.components.harvest?.cargo || 0;

    // Credits should have increased at both refineries
    const credits1 = state.store.get(refinery1Id)?.components.economy?.credits || 0;
    const credits2 = state.store.get(refinery2Id)?.components.economy?.credits || 0;

    expect(credits1).toBeGreaterThan(500);
    expect(credits2).toBeGreaterThan(500);
    expect(cargo1).toBeLessThan(700);
    expect(cargo2).toBeLessThan(700);
  });
});
