// ── Combat system unit tests: damage resolution ────────────────────────────────
import { describe, it, expect, beforeEach } from 'vitest';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { makeDamageSystem } from '../../src/sim/systems/damage.js';
import { orderSystems, runTick, type SimSystem } from '../../src/sim/loop.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import weaponsRaw from '../../data/weapons.json';
import { loadWeapons } from '../../src/loaders/loader.js';

const weapons = loadWeapons(weaponsRaw);

describe('damage system', () => {
  let state: SimState;
  let systems: readonly SimSystem[];

  beforeEach(() => {
    state = makeSimState({ seed: 42, mapWidth: 32, mapHeight: 32 });
    systems = orderSystems([makeDamageSystem(weapons)]);
  });

  it('deals damage = weapon.damage × matrix[type][armor] on first tick', () => {
    // Create attacker with rifle (damage: 8, type: BULLET) targeting defender
    const attackerPos = tileToWorldCenter({ tx: 5, ty: 5 });
    const attackerId = state.store.create({
      position: attackerPos,
      faction: { team: 'player', faction: 'rifle_unit' },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
    });

    // Create defender with LIGHT armor at range (within 4.0 tiles = 1024 world units)
    const defenderPos = tileToWorldCenter({ tx: 7, ty: 5 }); // ~2 tiles away
    const defenderId = state.store.create({
      position: defenderPos,
      health: { hp: 100, maxHp: 100 },
      armor: { armorClass: 'LIGHT' },
      faction: { team: 'enemy', faction: 'light_vehicle' },
    });

    // Set target
    const attacker = state.store.get(attackerId);
    if (attacker) {
      attacker.components.combat!.targetId = defenderId;
    }

    // Run one tick
    runTick(state, systems);

    // rifle.damage = 8, matrix['BULLET']['LIGHT'] = 0.5 → 8 × 0.5 = 4 damage
    const defender = state.store.get(defenderId);
    expect(defender?.components.health?.hp).toBe(96);
  });

  it('unit on cooldown does not fire and cooldown decrements', () => {
    // Create attacker with rifle (cooldown: 0.6s = 12 ticks at 20Hz)
    const attackerPos = tileToWorldCenter({ tx: 5, ty: 5 });
    const attackerId = state.store.create({
      position: attackerPos,
      faction: { team: 'player', faction: 'rifle_unit' },
      combat: { weaponId: 'rifle', cooldownRemaining: 5, targetId: null },
    });

    // Create defender at range
    const defenderPos = tileToWorldCenter({ tx: 7, ty: 5 });
    const defenderId = state.store.create({
      position: defenderPos,
      health: { hp: 100, maxHp: 100 },
      armor: { armorClass: 'LIGHT' },
      faction: { team: 'enemy', faction: 'light_vehicle' },
    });

    // Set target
    const attacker = state.store.get(attackerId);
    if (attacker) {
      attacker.components.combat!.targetId = defenderId;
    }

    // Run one tick
    runTick(state, systems);

    // Cooldown should decrement by 1 (5 → 4), no damage dealt
    const attackerAfter = state.store.get(attackerId);
    const defenderAfter = state.store.get(defenderId);
    expect(attackerAfter?.components.combat?.cooldownRemaining).toBe(4);
    expect(defenderAfter?.components.health?.hp).toBe(100);
  });

  it('out-of-range target takes no damage', () => {
    // Create attacker with rifle (range: 4.0 tiles = 1024 world units)
    const attackerPos = tileToWorldCenter({ tx: 5, ty: 5 });
    const attackerId = state.store.create({
      position: attackerPos,
      faction: { team: 'player', faction: 'rifle_unit' },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
    });

    // Create defender far away (> 4 tiles = > 1024 world units)
    // 8 tiles away = 2048+ world units, well out of range
    const defenderPos = tileToWorldCenter({ tx: 13, ty: 5 });
    const defenderId = state.store.create({
      position: defenderPos,
      health: { hp: 100, maxHp: 100 },
      armor: { armorClass: 'LIGHT' },
      faction: { team: 'enemy', faction: 'light_vehicle' },
    });

    // Set target
    const attacker = state.store.get(attackerId);
    if (attacker) {
      attacker.components.combat!.targetId = defenderId;
    }

    // Run one tick
    runTick(state, systems);

    // No damage should be dealt (out of range)
    const defender = state.store.get(defenderId);
    expect(defender?.components.health?.hp).toBe(100);
  });

  it('cooldown resets after firing', () => {
    // Create attacker with rifle (cooldown: 0.6s = 12 ticks at 20Hz)
    const attackerPos = tileToWorldCenter({ tx: 5, ty: 5 });
    const attackerId = state.store.create({
      position: attackerPos,
      faction: { team: 'player', faction: 'rifle_unit' },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
    });

    // Create defender at range
    const defenderPos = tileToWorldCenter({ tx: 7, ty: 5 });
    const defenderId = state.store.create({
      position: defenderPos,
      health: { hp: 100, maxHp: 100 },
      armor: { armorClass: 'LIGHT' },
      faction: { team: 'enemy', faction: 'light_vehicle' },
    });

    // Set target
    const attacker = state.store.get(attackerId);
    if (attacker) {
      attacker.components.combat!.targetId = defenderId;
    }

    // Run one tick - should fire and reset cooldown
    runTick(state, systems);

    // Cooldown should reset to 0.6 * 20 = 12 ticks
    const attackerAfter = state.store.get(attackerId);
    expect(attackerAfter?.components.combat?.cooldownRemaining).toBe(12);
  });

  it('damage multiplier uses NONE armor when armor component missing', () => {
    // rifle.damage = 8, matrix['BULLET']['NONE'] = 1.0 → 8 × 1.0 = 8 damage
    const attackerPos = tileToWorldCenter({ tx: 5, ty: 5 });
    const attackerId = state.store.create({
      position: attackerPos,
      faction: { team: 'player', faction: 'rifle_unit' },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
    });

    // Create defender WITHOUT armor component
    const defenderPos = tileToWorldCenter({ tx: 7, ty: 5 });
    const defenderId = state.store.create({
      position: defenderPos,
      health: { hp: 100, maxHp: 100 },
      faction: { team: 'enemy', faction: 'infantry' },
    });

    // Set target
    const attacker = state.store.get(attackerId);
    if (attacker) {
      attacker.components.combat!.targetId = defenderId;
    }

    runTick(state, systems);

    const defender = state.store.get(defenderId);
    expect(defender?.components.health?.hp).toBe(92);
  });
});
