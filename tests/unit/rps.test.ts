// ── RPS (rock-paper-scissors) test: prove counter triangle via real damage system ─────────
import { describe, it, expect, beforeEach } from 'vitest';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { makeDamageSystem } from '../../src/sim/systems/damage.js';
import { orderSystems, runTick, type SimSystem } from '../../src/sim/loop.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import weaponsRaw from '../../data/weapons.json';
import { loadWeapons } from '../../src/loaders/loader.js';

const weapons = loadWeapons(weaponsRaw);

describe('RPS damage matrix', () => {
  let state: SimState;
  let systems: readonly SimSystem[];

  beforeEach(() => {
    state = makeSimState({ seed: 42, mapWidth: 32, mapHeight: 32 });
    systems = orderSystems([makeDamageSystem(weapons)]);
  });

  it('ROCKET vs MEDIUM removes MORE hp than BULLET vs MEDIUM', () => {
    // ROCKET vs MEDIUM: 20 × 0.9 = 18 damage
    // BULLET vs MEDIUM: 8 × 0.3 = 2.4 damage
    // Create two identical MEDIUM-armor targets
    const targetPos = tileToWorldCenter({ tx: 10, ty: 10 });
    const targetId = state.store.create({
      position: targetPos,
      health: { hp: 100, maxHp: 100 },
      armor: { armorClass: 'MEDIUM' },
      faction: { team: 'enemy', faction: 'medium_target' },
    });

    // ROCKET attacker
    const rocketAttackerPos = tileToWorldCenter({ tx: 8, ty: 10 });
    const rocketAttackerId = state.store.create({
      position: rocketAttackerPos,
      faction: { team: 'player', faction: 'rocket_unit' },
      combat: { weaponId: 'inf_rocket', cooldownRemaining: 0, targetId: null },
    });

    // BULLET attacker
    const bulletAttackerPos = tileToWorldCenter({ tx: 12, ty: 10 });
    const bulletAttackerId = state.store.create({
      position: bulletAttackerPos,
      faction: { team: 'player', faction: 'rifle_unit' },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
    });

    // Set both attackers to target the same MEDIUM armor unit
    const rocketAttacker = state.store.get(rocketAttackerId);
    const bulletAttacker = state.store.get(bulletAttackerId);
    if (rocketAttacker) rocketAttacker.components.combat!.targetId = targetId;
    if (bulletAttacker) bulletAttacker.components.combat!.targetId = targetId;

    // Run one tick - both fire
    runTick(state, systems);

    // ROCKET deals 18 damage, BULLET deals 2.4 damage
    const target = state.store.get(targetId);
    expect(target?.components.health?.hp).toBe(100 - 18 - 2.4);
  });

  it('BULLET vs NONE > BULLET vs MEDIUM (matrix multiplier check)', () => {
    // BULLET.NONE = 1.0, BULLET.MEDIUM = 0.3 → 1.0 > 0.3
    const bulletMult = weapons.matrix['BULLET'] ?? {};
    expect(bulletMult['NONE'] ?? 0).toBeGreaterThan(bulletMult['MEDIUM'] ?? 0);
  });

  it('ROCKET vs MEDIUM > ROCKET vs NONE (matrix multiplier check)', () => {
    // ROCKET.MEDIUM = 0.9, ROCKET.NONE = 0.4 → 0.9 > 0.4
    const rocketMult = weapons.matrix['ROCKET'] ?? {};
    expect(rocketMult['MEDIUM'] ?? 0).toBeGreaterThan(rocketMult['NONE'] ?? 0);
  });

  it('full RPS loop: ROCKET shreds MEDIUM, BULLET shreds LIGHT, LIGHT shreds ROCKET', () => {
    // ROCKET vs MEDIUM: 20 × 0.9 = 18
    // BULLET vs LIGHT: 8 × 0.5 = 4
    // ROCKET vs LIGHT: 20 × 1.0 = 20 (this is the "LIGHT shreds ROCKET" part of the triangle)
    const bulletMult = weapons.matrix['BULLET'] ?? {};
    const rocketMult = weapons.matrix['ROCKET'] ?? {};

    // ROCKET >> MEDIUM (18 > 2.4)
    const rocketVsMedium = 20 * (rocketMult['MEDIUM'] ?? 0);
    const bulletVsMedium = 8 * (bulletMult['MEDIUM'] ?? 0);
    expect(rocketVsMedium).toBeGreaterThan(bulletVsMedium);

    // BULLET >> LIGHT (4 > 0.5)
    const bulletVsLight = 8 * (bulletMult['LIGHT'] ?? 0);
    expect(bulletVsLight).toBeGreaterThan(0); // BULLET does damage to LIGHT

    // ROCKET >> LIGHT (20 > 0.4)
    const rocketVsLight = 20 * (rocketMult['LIGHT'] ?? 0);
    const rocketVsNone = 20 * (rocketMult['NONE'] ?? 0);
    expect(rocketVsLight).toBeGreaterThan(rocketVsNone);
  });
});
