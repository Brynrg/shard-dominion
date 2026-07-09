// ── FG-5 tests: Riftmaw awakenings, derrick capture + income, veterancy, hero ───
import { describe, it, expect } from 'vitest';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { makePlanetEventSystem } from '../../src/sim/systems/planetEvent.js';
import { makeCombatTargetingSystem } from '../../src/sim/systems/combatTargeting.js';
import { makeDamageSystem } from '../../src/sim/systems/damage.js';
import { makeCommandSystem } from '../../src/sim/systems/command.js';
import { makeCommandQueue } from '../../src/view/input.js';
import { orderSystems, runTick } from '../../src/sim/loop.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import { loadUnits } from '../../src/loaders/units.js';
import { loadStructures } from '../../src/loaders/structures.js';
import { loadWeapons } from '../../src/loaders/loader.js';
import unitsData from '../../data/units.json' with { type: 'json' };
import structuresData from '../../data/structures.json' with { type: 'json' };
import weaponsData from '../../data/weapons.json' with { type: 'json' };

const units = loadUnits(unitsData);
const structures = loadStructures(structuresData);
const weapons = loadWeapons(weaponsData);

function soldier(state: SimState, team: 'player' | 'enemy', tx: number, ty: number, hp = 20) {
  return state.store.create({
    position: tileToWorldCenter({ tx, ty }),
    health: { hp, maxHp: hp }, armor: { armorClass: 'LIGHT' },
    movement: { target: null, path: [], speed: 12 },
    combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
    faction: { team, faction: 'infantry' },
  });
}

describe('FG-5 — Riftmaws', () => {
  it('deep mining wakes a Riftmaw at a bitten field tile (cap respected)', () => {
    const state = makeSimState({ seed: 21, mapWidth: 32, mapHeight: 32 });
    // A rich field, partially mined: simulate by dropping density directly.
    for (let i = 0; i < 4; i++) state.shardDensity.set(`${10 + i},10`, 800);
    const sys = makePlanetEventSystem(units);
    const systems = orderSystems([sys]);
    runTick(state, systems); // baseline ledger
    // Mine 3100 credits worth: 800→최 leaves tiles "bitten".
    state.shardDensity.set('10,10', 100);  // -700
    state.shardDensity.set('11,10', 100);  // -700
    state.shardDensity.set('12,10', 100);  // -700
    state.shardDensity.set('13,10', 0);    // -800  → total mined 2900
    runTick(state, systems);
    expect(state.store.all().filter(e => e.components.faction?.faction === 'riftmaw').length).toBe(0);
    state.shardDensity.set('10,10', 0);    // -100 more → 3000 crossed
    runTick(state, systems);
    const maws = state.store.all().filter(e => e.components.faction?.faction === 'riftmaw');
    expect(maws.length).toBe(1);
    expect(maws[0]!.components.faction!.team).toBe('neutral');
  });

  it('a Riftmaw aggros the nearest intruder and neutral targeting works both ways', () => {
    const state = makeSimState({ seed: 22, mapWidth: 32, mapHeight: 32 });
    const maw = state.store.create({
      position: tileToWorldCenter({ tx: 15, ty: 15 }),
      health: { hp: 420, maxHp: 420 }, armor: { armorClass: 'HEAVY' },
      movement: { target: null, path: [], speed: 8 },
      combat: { weaponId: 'flame', cooldownRemaining: 0, targetId: null },
      faction: { team: 'neutral', faction: 'riftmaw' },
    });
    const prey = soldier(state, 'player', 18, 15, 60);
    const systems = orderSystems([makePlanetEventSystem(units), makeCombatTargetingSystem(weapons), makeDamageSystem(weapons)]);
    for (let t = 0; t < 60; t++) runTick(state, systems);
    // The maw moved toward / attacked the soldier (aggro), and combat engaged.
    expect(state.store.get(prey)!.components.health!.hp).toBeLessThan(60);
    expect(state.store.get(maw)!.components.movement!.attackMove).toBe(true);
  });
});

describe('FG-5 — derricks', () => {
  it('a lone team captures the derrick after sustained presence; income drips to its bank', () => {
    const state = makeSimState({ seed: 23, mapWidth: 32, mapHeight: 32 });
    const derrick = state.store.create({
      position: tileToWorldCenter({ tx: 12, ty: 12 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'neutral', faction: 'derrick' },
      health: { hp: 1000, maxHp: 1000 }, armor: { armorClass: 'BUILDING' },
    });
    const bank = state.store.create({
      position: tileToWorldCenter({ tx: 6, ty: 8 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'refinery' },
      economy: { credits: 100, refineryStorage: 100, maxStorage: 5000 },
      health: { hp: 1500, maxHp: 1500 },
    });
    soldier(state, 'player', 12, 13); // adjacent, alone
    const systems = orderSystems([makePlanetEventSystem(units)]);
    for (let t = 0; t < 99; t++) runTick(state, systems);
    expect(state.store.get(derrick)!.components.faction!.team).toBe('neutral'); // not yet
    for (let t = 0; t < 3; t++) runTick(state, systems);
    expect(state.store.get(derrick)!.components.faction!.team).toBe('player'); // captured
    const c0 = state.store.get(bank)!.components.economy!.credits;
    for (let t = 0; t < 40; t++) runTick(state, systems); // 2s of income at 5/s
    const c1 = state.store.get(bank)!.components.economy!.credits;
    expect(c1 - c0).toBeCloseTo(10, 0);
  });

  it('soldiers do NOT auto-target a neutral derrick (passive neutrals are spared)', () => {
    const state = makeSimState({ seed: 24, mapWidth: 32, mapHeight: 32 });
    const derrick = state.store.create({
      position: tileToWorldCenter({ tx: 12, ty: 12 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'neutral', faction: 'derrick' },
      health: { hp: 1000, maxHp: 1000 }, armor: { armorClass: 'BUILDING' },
    });
    soldier(state, 'player', 12, 13);
    const systems = orderSystems([makeCombatTargetingSystem(weapons), makeDamageSystem(weapons)]);
    for (let t = 0; t < 40; t++) runTick(state, systems);
    expect(state.store.get(derrick)!.components.health!.hp).toBe(1000);
  });
});

describe('FG-5 — veterancy + hero', () => {
  it('3 kills → rank 1 → +15% damage; the shooter earns experience', () => {
    const state = makeSimState({ seed: 25, mapWidth: 32, mapHeight: 32 });
    const vet = soldier(state, 'player', 10, 10, 60);
    const systems = orderSystems([makeCombatTargetingSystem(weapons), makeDamageSystem(weapons)]);
    // Feed it three 8hp victims (rifle one-shots them: 8 dmg × 1.0 LIGHT ≥ 8hp).
    for (let k = 0; k < 3; k++) {
      state.store.create({
        position: tileToWorldCenter({ tx: 11, ty: 10 }),
        health: { hp: 8, maxHp: 8 }, armor: { armorClass: 'LIGHT' },
        faction: { team: 'enemy', faction: 'infantry' },
      });
      for (let t = 0; t < 30; t++) runTick(state, systems);
      // cull the corpse so the next victim can be acquired
      for (const e of state.store.all()) if ((e.components.health?.hp ?? 1) <= 0) state.store.remove(e.id);
    }
    const xp = state.store.get(vet)!.components.experience;
    expect(xp?.kills).toBe(3);
    expect(xp?.rank).toBe(1);
    // Ranked damage: 8 rifle dmg × 0.5 (BULLET vs LIGHT) × 1.15 rank-1 = 4.6 per hit.
    const dummy = state.store.create({
      position: tileToWorldCenter({ tx: 11, ty: 10 }),
      health: { hp: 1000, maxHp: 1000 }, armor: { armorClass: 'LIGHT' },
      faction: { team: 'enemy', faction: 'infantry' },
    });
    // Measure the FIRST hit on the dummy.
    let firstHit = 0;
    let prev = state.store.get(dummy)!.components.health!.hp;
    for (let t = 0; t < 60 && firstHit === 0; t++) {
      runTick(state, systems);
      const hp = state.store.get(dummy)!.components.health!.hp;
      if (hp < prev) firstHit = prev - hp;
      prev = hp;
    }
    expect(firstHit).toBeCloseTo(4.6, 5);
  });

  it('the Warden is capped at one (train intent rejected while one lives)', () => {
    const state = makeSimState({ seed: 26, mapWidth: 32, mapHeight: 32 });
    const queue = makeCommandQueue();
    const systems = orderSystems([makeCommandSystem(queue, structures)]);
    state.store.create({ // living hero
      position: tileToWorldCenter({ tx: 10, ty: 10 }),
      health: { hp: 150, maxHp: 150 },
      movement: { target: null, path: [], speed: 13 },
      combat: { weaponId: 'raider_cannon', cooldownRemaining: 0, targetId: null },
      faction: { team: 'player', faction: 'warden' },
    });
    const barracks = state.store.create({
      position: tileToWorldCenter({ tx: 8, ty: 8 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'barracks' },
      production: { queue: [], progress: 0 },
      health: { hp: 800, maxHp: 800 },
    });
    queue.push({ type: 'train', unitId: 'warden' });
    runTick(state, systems);
    expect(state.store.get(barracks)!.components.production!.queue.length).toBe(0); // capped
    queue.push({ type: 'train', unitId: 'infantry' });
    runTick(state, systems);
    expect(state.store.get(barracks)!.components.production!.queue).toContain('infantry'); // others fine
  });
});
