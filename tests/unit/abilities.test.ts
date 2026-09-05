import { describe, it, expect } from 'vitest';
import { makeSimState } from '../../src/sim/state.js';
import { makeAbilitySystem } from '../../src/sim/systems/ability.js';
import { orderSystems, runTick, SIM_TICK_RATE } from '../../src/sim/loop.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import { loadUnits } from '../../src/loaders/units.js';
import { unitComponents } from '../../src/sim/factory.js';
import { FACTIONS } from '../../src/sim/factions.js';
import { castAbility } from '../../src/sim/abilities.js';
import unitsData from '../../data/units.json' with { type: 'json' };

const units = loadUnits(unitsData);

// W4 hero kit — castAbility effects + the ability system's cooldown/buff clocks.
// Written by the local coder (hermes-ask cheap) to packets/W4a-test-abilities.md; reviewed.
describe('W4 — hero abilities', () => {
  it('rally: ally buff applied within radius, expired after duration', () => {
    const state = makeSimState({ seed: 1, mapWidth: 32, mapHeight: 32 });
    const wardenDef = units.find(u => u.id === 'warden')!;
    const rallyDef = wardenDef.abilities.find(a => a.id === 'rally_surge')!;

    // Create hero
    const heroId = state.store.create({
      position: tileToWorldCenter({ tx: 10, ty: 10 }),
      ...unitComponents(wardenDef, 'player', FACTIONS.concord),
    });
    const hero = state.store.get(heroId)!;

    // Create ally 2 tiles away (approx 64 subunits)
    const allyId = state.store.create({
      position: tileToWorldCenter({ tx: 10, ty: 12 }), // 2 tiles away
      ...unitComponents(wardenDef, 'player', FACTIONS.concord),
    });
    const ally = state.store.get(allyId)!;

    // Create ally 12 tiles away (approx 384 subunits)
    const farAllyId = state.store.create({
      position: tileToWorldCenter({ tx: 10, ty: 22 }), // 12 tiles away
      ...unitComponents(wardenDef, 'player', FACTIONS.concord),
    });
    const farAlly = state.store.get(farAllyId)!;

    // Create enemy 2 tiles away
    const enemyId = state.store.create({
      position: tileToWorldCenter({ tx: 10, ty: 12 }),
      ...unitComponents(wardenDef, 'enemy', FACTIONS.concord),
    });
    const enemy = state.store.get(enemyId)!;

    // Cast rally
    const result = castAbility(state, hero, wardenDef, rallyDef, null);
    expect(result).toBe(true);

    // Check ally buff
    expect(ally.components.buff?.dmgBonus).toBe(0.35);
    // Check far ally no buff
    expect(farAlly.components.buff).toBeUndefined();
    // Check enemy no buff
    expect(enemy.components.buff).toBeUndefined();

    // Advance time past duration (8s)
    const ticksToAdvance = Math.round(8 * SIM_TICK_RATE) + 1;
    const systems = orderSystems([makeAbilitySystem()]);
    for (let t = 0; t < ticksToAdvance; t++) {
      runTick(state, systems);
    }

    // Buff should be expired
    expect(ally.components.buff).toBeUndefined();
  });

  it('mend: heals ally up to maxHp', () => {
    const state = makeSimState({ seed: 1, mapWidth: 32, mapHeight: 32 });
    const razorDef = units.find(u => u.id === 'razor')!;
    const mendDef = razorDef.abilities.find(a => a.id === 'field_mend')!;

    // Create hero
    const heroId = state.store.create({
      position: tileToWorldCenter({ tx: 10, ty: 10 }),
      ...unitComponents(razorDef, 'player', FACTIONS.concord),
    });
    const hero = state.store.get(heroId)!;

    // Create ally with low hp
    const allyId = state.store.create({
      position: tileToWorldCenter({ tx: 10, ty: 11 }),
      ...unitComponents(razorDef, 'player', FACTIONS.concord),
    });
    const ally = state.store.get(allyId)!;
    ally.components.health!.hp = 10;

    // Cast mend
    const result = castAbility(state, hero, razorDef, mendDef, null);
    expect(result).toBe(true);

    // Check heal
    expect(ally.components.health!.hp).toBe(45); // 10 + 35

    // Create another ally at max hp - 5
    const ally2Id = state.store.create({
      position: tileToWorldCenter({ tx: 10, ty: 12 }),
      ...unitComponents(razorDef, 'player', FACTIONS.concord),
    });
    const ally2 = state.store.get(ally2Id)!;
    ally2.components.health!.hp = ally2.components.health!.maxHp - 5;

    // Second cast on the same hero: clear the cooldown by hand (cooldown itself is covered below).
    hero.components.ability!.cooldowns[mendDef.id] = 0;
    
    const result2 = castAbility(state, hero, razorDef, mendDef, null);
    expect(result2).toBe(true);
    expect(ally2.components.health!.hp).toBe(ally2.components.health!.maxHp);
  });

  it('blink: moves hero to target, returns false if out of range', () => {
    const state = makeSimState({ seed: 1, mapWidth: 32, mapHeight: 32 });
    const vaneDef = units.find(u => u.id === 'vane')!;
    const blinkDef = vaneDef.abilities.find(a => a.id === 'shadowstep')!;

    // Create hero
    const heroId = state.store.create({
      position: tileToWorldCenter({ tx: 10, ty: 10 }),
      ...unitComponents(vaneDef, 'player', FACTIONS.concord),
    });
    const hero = state.store.get(heroId)!;

    // Target 3 tiles away
    const targetPos = tileToWorldCenter({ tx: 10, ty: 13 });
    
    const result = castAbility(state, hero, vaneDef, blinkDef, targetPos);
    expect(result).toBe(true);
    expect(hero.components.position!.wx).toBe(targetPos.wx);
    expect(hero.components.position!.wy).toBe(targetPos.wy);
    expect(hero.components.movement!.target).toBeNull();
    expect(hero.components.movement!.path).toEqual([]);

    // Target 20 tiles away (out of range for blink radius 8)
    const farTargetPos = tileToWorldCenter({ tx: 10, ty: 30 });
    const result2 = castAbility(state, hero, vaneDef, blinkDef, farTargetPos);
    expect(result2).toBe(false);
    // Position should remain at the previous blink target
    expect(hero.components.position!.wx).toBe(targetPos.wx);
    expect(hero.components.position!.wy).toBe(targetPos.wy);
  });

  it('nova: damages enemies, respects shields, ignores allies', () => {
    const state = makeSimState({ seed: 1, mapWidth: 32, mapHeight: 32 });
    const vaneDef = units.find(u => u.id === 'vane')!;
    const novaDef = vaneDef.abilities.find(a => a.id === 'ember_strike')!;

    // Create hero
    const heroId = state.store.create({
      position: tileToWorldCenter({ tx: 10, ty: 10 }),
      ...unitComponents(vaneDef, 'player', FACTIONS.concord),
    });
    const hero = state.store.get(heroId)!;

    // Create enemy with shield
    const enemyId = state.store.create({
      position: tileToWorldCenter({ tx: 10, ty: 11 }), // 1 tile away, within radius 2.5
      ...unitComponents(vaneDef, 'enemy', FACTIONS.concord),
    });
    const enemy = state.store.get(enemyId)!;
    // Ensure shield exists and has 20 hp
    if (!enemy.components.shield) {
      enemy.components.shield = { hp: 20, max: 20, regenDelay: 0 };
    } else {
      enemy.components.shield.hp = 20;
    }
    const initialEnemyHp = enemy.components.health!.hp;

    // Create neutral riftmaw (no concord shield)
    const riftmawDef = units.find(u => u.id === 'riftmaw')!;
    const riftmawId = state.store.create({
      position: tileToWorldCenter({ tx: 10, ty: 12 }), // 2 tiles away, within radius 2.5
      ...unitComponents(riftmawDef, 'neutral', FACTIONS.emberhand), // emberhand has no shield
    });
    const riftmaw = state.store.get(riftmawId)!;
    const initialRiftmawHp = riftmaw.components.health!.hp;

    // Create friendly ally INSIDE the blast (1 tile off the centre) — must be untouched
    const allyId = state.store.create({
      position: tileToWorldCenter({ tx: 11, ty: 11 }),
      ...unitComponents(vaneDef, 'player', FACTIONS.concord),
    });
    const ally = state.store.get(allyId)!;
    const initialAllyHp = ally.components.health!.hp;

    // Cast nova at enemy position
    const result = castAbility(state, hero, vaneDef, novaDef, { wx: enemy.components.position!.wx, wy: enemy.components.position!.wy });
    expect(result).toBe(true);

    // Enemy: shield 20 -> 0, hp reduced by 40 (60 dmg - 20 shield)
    expect(enemy.components.shield!.hp).toBe(0);
    expect(enemy.components.health!.hp).toBe(initialEnemyHp - 40);

    // Riftmaw: neutral, no shield, loses 60 hp
    expect(riftmaw.components.health!.hp).toBe(initialRiftmawHp - 60);

    // Friendly: untouched
    expect(ally.components.health!.hp).toBe(initialAllyHp);
  });

  it('ward: ally within radius gets shield, outside does not', () => {
    const state = makeSimState({ seed: 1, mapWidth: 32, mapHeight: 32 });
    const tempestDef = units.find(u => u.id === 'tempest')!;
    const wardDef = tempestDef.abilities.find(a => a.id === 'crystal_ward')!;

    // Create hero
    const heroId = state.store.create({
      position: tileToWorldCenter({ tx: 10, ty: 10 }),
      ...unitComponents(tempestDef, 'player', FACTIONS.concord),
    });
    const hero = state.store.get(heroId)!;

    // Create ally within radius (1 tile)
    const allyId = state.store.create({
      position: tileToWorldCenter({ tx: 10, ty: 11 }),
      ...unitComponents(tempestDef, 'player', FACTIONS.concord),
    });
    const ally = state.store.get(allyId)!;
    // Remove existing shield to test fresh application
    delete ally.components.shield;

    // Create ally outside radius (10 tiles)
    const farAllyId = state.store.create({
      position: tileToWorldCenter({ tx: 10, ty: 20 }),
      ...unitComponents(tempestDef, 'player', FACTIONS.concord),
    });
    const farAlly = state.store.get(farAllyId)!;
    delete farAlly.components.shield;

    // Cast ward
    const result = castAbility(state, hero, tempestDef, wardDef, null);
    expect(result).toBe(true);

    // Ally within radius carries the 50-point Crystal Ward.
    expect(ally.components.shield!.hp).toBe(50);

    // Ally outside radius should not have shield (or base 20 if it was there, but we deleted it)
    expect(ally.components.shield).toBeDefined();
    expect(farAlly.components.shield).toBeUndefined();
  });

  it('cooldown: second immediate cast returns false, resets after duration', () => {
    const state = makeSimState({ seed: 1, mapWidth: 32, mapHeight: 32 });
    const wardenDef = units.find(u => u.id === 'warden')!;
    const rallyDef = wardenDef.abilities.find(a => a.id === 'rally_surge')!;

    // Create hero
    const heroId = state.store.create({
      position: tileToWorldCenter({ tx: 10, ty: 10 }),
      ...unitComponents(wardenDef, 'player', FACTIONS.concord),
    });
    const hero = state.store.get(heroId)!;

    // First cast
    const result1 = castAbility(state, hero, wardenDef, rallyDef, null);
    expect(result1).toBe(true);

    // Second immediate cast
    const result2 = castAbility(state, hero, wardenDef, rallyDef, null);
    expect(result2).toBe(false);

    // Advance time past cooldown (8s)
    const cooldownTicks = Math.round(rallyDef.cooldownSeconds * SIM_TICK_RATE);
    const systems = orderSystems([makeAbilitySystem()]);
    for (let t = 0; t < cooldownTicks; t++) {
      runTick(state, systems);
    }

    // Third cast should succeed
    const result3 = castAbility(state, hero, wardenDef, rallyDef, null);
    expect(result3).toBe(true);
  });
});
