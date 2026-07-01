// ── Combat targeting system unit tests ────────────────────────────────────────
import { describe, it, expect, beforeEach } from 'vitest';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { makeCombatTargetingSystem } from '../../src/sim/systems/combatTargeting.js';
import { orderSystems, runTick, type SimSystem } from '../../src/sim/loop.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import weaponsRaw from '../../data/weapons.json';
import { loadWeapons } from '../../src/loaders/loader.js';

const weapons = loadWeapons(weaponsRaw);

describe('combat targeting system', () => {
  let state: SimState;
  let systems: readonly SimSystem[];

  beforeEach(() => {
    state = makeSimState({ seed: 42, mapWidth: 32, mapHeight: 32 });
    systems = orderSystems([makeCombatTargetingSystem(weapons)]);
  });

  it('targets nearest in-range enemy', () => {
    // Create attacker with rifle (range: 4.0 tiles = 1024 world units)
    const attackerPos = tileToWorldCenter({ tx: 5, ty: 5 });
    const attackerId = state.store.create({
      position: attackerPos,
      faction: { team: 'player', faction: 'rifle_unit' },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
    });

    // Create enemy at 2 tiles away (within range)
    const enemyPos = tileToWorldCenter({ tx: 7, ty: 5 });
    const enemyId = state.store.create({
      position: enemyPos,
      health: { hp: 100, maxHp: 100 },
      faction: { team: 'enemy', faction: 'light_vehicle' },
    });

    // Run tick
    runTick(state, systems);

    // Verify attacker targeted the enemy
    const attacker = state.store.get(attackerId);
    expect(attacker?.components.combat?.targetId).toBe(enemyId);
  });

  it('ignores allies in range', () => {
    // Create attacker with rifle
    const attackerPos = tileToWorldCenter({ tx: 5, ty: 5 });
    const attackerId = state.store.create({
      position: attackerPos,
      faction: { team: 'player', faction: 'rifle_unit' },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
    });

    // Create ally at 2 tiles away (within range, but same team)
    const allyPos = tileToWorldCenter({ tx: 7, ty: 5 });
    state.store.create({
      position: allyPos,
      health: { hp: 100, maxHp: 100 },
      faction: { team: 'player', faction: 'rifle_unit' },
    });

    // Run tick
    runTick(state, systems);

    // Verify attacker has no target (allies are ignored)
    const attacker = state.store.get(attackerId);
    expect(attacker?.components.combat?.targetId).toBeNull();
  });

  it('targetId is null when enemy is out of range', () => {
    // Create attacker with rifle (range: 4.0 tiles = 1024 world units)
    const attackerPos = tileToWorldCenter({ tx: 5, ty: 5 });
    const attackerId = state.store.create({
      position: attackerPos,
      faction: { team: 'player', faction: 'rifle_unit' },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
    });

    // Create enemy far away (> 4 tiles = > 1024 world units)
    // 8 tiles away = 2048+ world units, well out of range
    const enemyPos = tileToWorldCenter({ tx: 13, ty: 5 });
    state.store.create({
      position: enemyPos,
      health: { hp: 100, maxHp: 100 },
      faction: { team: 'enemy', faction: 'light_vehicle' },
    });

    // Run tick
    runTick(state, systems);

    // Verify attacker has no target (enemy out of range)
    const attacker = state.store.get(attackerId);
    expect(attacker?.components.combat?.targetId).toBeNull();
  });

  it('picks nearer of two enemies', () => {
    // Create attacker with rifle
    const attackerPos = tileToWorldCenter({ tx: 5, ty: 5 });
    const attackerId = state.store.create({
      position: attackerPos,
      faction: { team: 'player', faction: 'rifle_unit' },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
    });

    // Create enemy A at 2 tiles away
    const enemyAPos = tileToWorldCenter({ tx: 7, ty: 5 });
    const enemyAId = state.store.create({
      position: enemyAPos,
      health: { hp: 100, maxHp: 100 },
      faction: { team: 'enemy', faction: 'light_vehicle' },
    });

    // Create enemy B at 4 tiles away (farther) — must exist but its id isn't asserted.
    const enemyBPos = tileToWorldCenter({ tx: 9, ty: 5 });
    state.store.create({
      position: enemyBPos,
      health: { hp: 100, maxHp: 100 },
      faction: { team: 'enemy', faction: 'light_vehicle' },
    });

    // Run tick
    runTick(state, systems);

    // Verify attacker targeted the nearer enemy (A at 2 tiles, not B at 4)
    const attacker = state.store.get(attackerId);
    expect(attacker?.components.combat?.targetId).toBe(enemyAId);
  });

  it('skips dead enemy', () => {
    // Create attacker with rifle
    const attackerPos = tileToWorldCenter({ tx: 5, ty: 5 });
    const attackerId = state.store.create({
      position: attackerPos,
      faction: { team: 'player', faction: 'rifle_unit' },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
    });

    // Create dead enemy at 2 tiles away — exists but should never be targeted.
    const enemyPos = tileToWorldCenter({ tx: 7, ty: 5 });
    state.store.create({
      position: enemyPos,
      health: { hp: 0, maxHp: 100 }, // dead
      faction: { team: 'enemy', faction: 'light_vehicle' },
    });

    // Run tick
    runTick(state, systems);

    // Verify attacker has no target (dead enemy is skipped)
    const attacker = state.store.get(attackerId);
    expect(attacker?.components.combat?.targetId).toBeNull();
  });

  it('keeps current target if still valid', () => {
    // Create attacker with rifle
    const attackerPos = tileToWorldCenter({ tx: 5, ty: 5 });
    const attackerId = state.store.create({
      position: attackerPos,
      faction: { team: 'player', faction: 'rifle_unit' },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
    });

    // Create enemy at 2 tiles away
    const enemyPos = tileToWorldCenter({ tx: 7, ty: 5 });
    const enemyId = state.store.create({
      position: enemyPos,
      health: { hp: 100, maxHp: 100 },
      faction: { team: 'enemy', faction: 'light_vehicle' },
    });

    // Manually set target (simulating prior tick)
    const attacker = state.store.get(attackerId);
    if (attacker) {
      attacker.components.combat!.targetId = enemyId;
    }

    // Run tick
    runTick(state, systems);

    // Verify attacker still targets the same enemy (still valid)
    expect(attacker?.components.combat?.targetId).toBe(enemyId);
  });

  it('clears target when current target dies', () => {
    // Create attacker with rifle
    const attackerPos = tileToWorldCenter({ tx: 5, ty: 5 });
    const attackerId = state.store.create({
      position: attackerPos,
      faction: { team: 'player', faction: 'rifle_unit' },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
    });

    // Create enemy at 2 tiles away
    const enemyPos = tileToWorldCenter({ tx: 7, ty: 5 });
    const enemyId = state.store.create({
      position: enemyPos,
      health: { hp: 100, maxHp: 100 },
      faction: { team: 'enemy', faction: 'light_vehicle' },
    });

    // Manually set target (simulating prior tick)
    const attacker = state.store.get(attackerId);
    if (attacker) {
      attacker.components.combat!.targetId = enemyId;
    }

    // Kill the enemy
    const enemy = state.store.get(enemyId);
    if (enemy) {
      enemy.components.health!.hp = 0;
    }

    // Run tick
    runTick(state, systems);

    // Verify attacker target is cleared (enemy is dead)
    expect(attacker?.components.combat?.targetId).toBeNull();
  });

  it('clears target when current target goes out of range', () => {
    // Create attacker with rifle (range: 4.0 tiles)
    const attackerPos = tileToWorldCenter({ tx: 5, ty: 5 });
    const attackerId = state.store.create({
      position: attackerPos,
      faction: { team: 'player', faction: 'rifle_unit' },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
    });

    // Create enemy at 3 tiles away (within range)
    const enemyPos = tileToWorldCenter({ tx: 8, ty: 5 });
    const enemyId = state.store.create({
      position: enemyPos,
      health: { hp: 100, maxHp: 100 },
      faction: { team: 'enemy', faction: 'light_vehicle' },
    });

    // Manually set target (simulating prior tick)
    const attacker = state.store.get(attackerId);
    if (attacker) {
      attacker.components.combat!.targetId = enemyId;
    }

    // Move enemy out of range (> 4 tiles)
    const newEnemyPos = tileToWorldCenter({ tx: 13, ty: 5 }); // 8 tiles away
    const enemy = state.store.get(enemyId);
    if (enemy) {
      enemy.components.position = newEnemyPos;
    }

    // Run tick
    runTick(state, systems);

    // Verify attacker target is cleared (enemy is out of range)
    expect(attacker?.components.combat?.targetId).toBeNull();
  });
});
