// ── Victory system unit tests ───────────────────────────────────────────────────
import { describe, it, expect, beforeEach } from 'vitest';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { makeVictorySystem } from '../../src/sim/systems/victory.js';
import { orderSystems, runTick, type SimSystem } from '../../src/sim/loop.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';

describe('victory system', () => {
  let state: SimState;
  let systems: readonly SimSystem[];
  let victorySystem: ReturnType<typeof makeVictorySystem>;

  beforeEach(() => {
    state = makeSimState({ seed: 42, mapWidth: 32, mapHeight: 32 });
    victorySystem = makeVictorySystem();
    systems = orderSystems([victorySystem]);
  });

  it('unit with health.hp = 0 is removed from the store after a tick', () => {
    const pos = tileToWorldCenter({ tx: 5, ty: 5 });
    const id = state.store.create({
      position: pos,
      health: { hp: 0, maxHp: 100 },
      faction: { team: 'player', faction: 'test_unit' },
    });

    // Verify unit exists before tick
    expect(state.store.get(id)).toBeDefined();

    // Run tick
    runTick(state, systems);

    // Verify unit is removed
    expect(state.store.get(id)).toBeUndefined();
  });

  it('enemy wiped -> winner player', () => {
    // Seed player combat unit
    const playerPos = tileToWorldCenter({ tx: 5, ty: 5 });
    const playerId = state.store.create({
      position: playerPos,
      health: { hp: 100, maxHp: 100 },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
      faction: { team: 'player', faction: 'rifle_unit' },
    });

    // Seed enemy combat unit
    const enemyPos = tileToWorldCenter({ tx: 7, ty: 5 });
    const enemyId = state.store.create({
      position: enemyPos,
      health: { hp: 100, maxHp: 100 },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
      faction: { team: 'enemy', faction: 'rifle_unit' },
    });

    // Verify both units exist
    expect(state.store.get(playerId)).toBeDefined();
    expect(state.store.get(enemyId)).toBeDefined();

    // Tick once with both alive so the match registers as started (both sides seen).
    runTick(state, systems);

    // Kill the enemy
    const enemy = state.store.get(enemyId);
    if (enemy?.components.health) {
      enemy.components.health.hp = 0;
    }

    // Run tick
    runTick(state, systems);

    // Enemy should be removed and victory declared
    expect(state.store.get(enemyId)).toBeUndefined();
    expect(victorySystem.result.over).toBe(true);
    expect(victorySystem.result.winner).toBe('player');
  });

  it('player wiped -> winner enemy', () => {
    // Seed player combat unit
    const playerPos = tileToWorldCenter({ tx: 5, ty: 5 });
    const playerId = state.store.create({
      position: playerPos,
      health: { hp: 100, maxHp: 100 },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
      faction: { team: 'player', faction: 'rifle_unit' },
    });

    // Seed enemy combat unit
    const enemyPos = tileToWorldCenter({ tx: 7, ty: 5 });
    state.store.create({
      position: enemyPos,
      health: { hp: 100, maxHp: 100 },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
      faction: { team: 'enemy', faction: 'rifle_unit' },
    });

    // Tick once with both alive so the match registers as started (both sides seen).
    runTick(state, systems);

    // Kill the player
    const player = state.store.get(playerId);
    if (player?.components.health) {
      player.components.health.hp = 0;
    }

    // Run tick
    runTick(state, systems);

    // Player should be removed and victory declared
    expect(state.store.get(playerId)).toBeUndefined();
    expect(victorySystem.result.over).toBe(true);
    expect(victorySystem.result.winner).toBe('enemy');
  });

  it('both sides have living combat units -> result.over stays false', () => {
    // Seed player combat unit
    const playerPos = tileToWorldCenter({ tx: 5, ty: 5 });
    state.store.create({
      position: playerPos,
      health: { hp: 100, maxHp: 100 },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
      faction: { team: 'player', faction: 'rifle_unit' },
    });

    // Seed enemy combat unit
    const enemyPos = tileToWorldCenter({ tx: 7, ty: 5 });
    state.store.create({
      position: enemyPos,
      health: { hp: 100, maxHp: 100 },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
      faction: { team: 'enemy', faction: 'rifle_unit' },
    });

    // Run tick
    runTick(state, systems);

    // Neither side should be wiped, victory should not be over
    expect(victorySystem.result.over).toBe(false);
    expect(victorySystem.result.winner).toBeNull();
  });

  it('lone side never seeded -> no false win', () => {
    // Seed only a player combat unit (no enemy ever seeded)
    const playerPos = tileToWorldCenter({ tx: 5, ty: 5 });
    state.store.create({
      position: playerPos,
      health: { hp: 100, maxHp: 100 },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
      faction: { team: 'player', faction: 'rifle_unit' },
    });

    // Run multiple ticks
    for (let i = 0; i < 5; i++) {
      runTick(state, systems);
    }

    // Victory should not be over since enemy was never seeded
    expect(victorySystem.result.over).toBe(false);
    expect(victorySystem.result.winner).toBeNull();
  });
});
