// ── FG-3 combined-arms tests: projectiles + splash, vehicle routing, AI factory ─
import { describe, it, expect, beforeEach } from 'vitest';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { makeCommandSystem } from '../../src/sim/systems/command.js';
import { makeCommandQueue, type CommandQueue } from '../../src/view/input.js';
import { makeMovementSystem } from '../../src/sim/systems/movement.js';
import { makeCombatTargetingSystem } from '../../src/sim/systems/combatTargeting.js';
import { makeDamageSystem } from '../../src/sim/systems/damage.js';
import { makeProjectileSystem } from '../../src/sim/systems/projectile.js';
import { makeProductionSystem } from '../../src/sim/systems/production.js';
import { makeAiSystem } from '../../src/sim/systems/ai.js';
import { orderSystems, runTick, type SimSystem } from '../../src/sim/loop.js';
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

describe('FG-3 — projectiles + splash', () => {
  let state: SimState; let queue: CommandQueue; let systems: SimSystem[];
  beforeEach(() => {
    state = makeSimState({ seed: 9, mapWidth: 32, mapHeight: 32 });
    queue = makeCommandQueue();
    systems = orderSystems([
      makeCommandSystem(queue, structures),
      makeMovementSystem(),
      makeCombatTargetingSystem(weapons),
      makeProjectileSystem(weapons),
      makeDamageSystem(weapons),
    ]);
  });

  it('a tank SHELL flies as a projectile, then splashes the clumped enemies at impact', () => {
    state.store.create({ // stationary tank
      position: tileToWorldCenter({ tx: 10, ty: 10 }),
      health: { hp: 220, maxHp: 220 }, armor: { armorClass: 'HEAVY' },
      combat: { weaponId: 'tank_shell_v', cooldownRemaining: 0, targetId: null },
      faction: { team: 'player', faction: 'assault_tank' },
    });
    // Two enemies STACKED on the same tile, in range (tank range 5.5).
    const mk = () => state.store.create({
      position: tileToWorldCenter({ tx: 13, ty: 10 }),
      health: { hp: 40, maxHp: 40 }, armor: { armorClass: 'LIGHT' },
      faction: { team: 'enemy', faction: 'infantry' },
    });
    const a = mk(), b = mk();

    // Tick 1-2: the shot spawns a projectile; targets not yet damaged (in flight).
    runTick(state, systems);
    const shells = state.store.all().filter(e => e.components.projectile);
    expect(shells.length).toBe(1);
    expect(state.store.get(a)!.components.health!.hp).toBe(40);

    // Fly to impact (3 tiles at 0.6 tile/tick ≈ 5 ticks) → BOTH clumped enemies hurt.
    for (let t = 0; t < 12; t++) runTick(state, systems);
    expect(state.store.get(a)!.components.health!.hp).toBeLessThan(40);
    expect(state.store.get(b)!.components.health!.hp).toBeLessThan(40);
    expect(state.store.all().filter(e => e.components.projectile).length, 'shell consumed').toBe(0);
  });

  it('shells are DODGEABLE: a target that moved away from the captured impact point takes nothing', () => {
    state.store.create({
      position: tileToWorldCenter({ tx: 10, ty: 10 }),
      health: { hp: 220, maxHp: 220 }, armor: { armorClass: 'HEAVY' },
      combat: { weaponId: 'tank_shell_v', cooldownRemaining: 0, targetId: null },
      faction: { team: 'player', faction: 'assault_tank' },
    });
    const runner = state.store.create({
      position: tileToWorldCenter({ tx: 13, ty: 10 }),
      health: { hp: 40, maxHp: 40 }, armor: { armorClass: 'LIGHT' },
      movement: { target: null, path: [], speed: 40 }, // very fast
      faction: { team: 'enemy', faction: 'infantry' },
    });
    runTick(state, systems); // shell fired at (13,10)
    // Sprint away, far past the splash radius.
    state.store.get(runner)!.components.movement!.target = tileToWorldCenter({ tx: 13, ty: 16 });
    for (let t = 0; t < 20; t++) runTick(state, systems);
    expect(state.store.get(runner)!.components.health!.hp).toBe(40);
  });
});

describe('FG-3 — vehicle production routing', () => {
  it('V/C train at the War Factory, not the Barracks', () => {
    const state = makeSimState({ seed: 10, mapWidth: 32, mapHeight: 32 });
    const queue = makeCommandQueue();
    const systems = orderSystems([
      makeCommandSystem(queue, structures),
      makeProductionSystem(units),
    ]);
    state.store.create({
      position: tileToWorldCenter({ tx: 6, ty: 8 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'refinery' },
      economy: { credits: 2000, refineryStorage: 2000, maxStorage: 2000 },
      production: { queue: [], progress: 0 },
      health: { hp: 1500, maxHp: 1500 },
    });
    const barracks = state.store.create({
      position: tileToWorldCenter({ tx: 8, ty: 8 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'barracks' },
      production: { queue: [], progress: 0 },
      health: { hp: 800, maxHp: 800 },
    });
    const factory = state.store.create({
      position: tileToWorldCenter({ tx: 10, ty: 8 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'war_factory' },
      production: { queue: [], progress: 0 },
      tech: { tier: 2, upgradingTo: null, ticksLeft: 0 }, // XP-1: vehicles are T2
      health: { hp: 1300, maxHp: 1300 },
    });
    queue.push({ type: 'train', unitId: 'scout_vehicle' });
    runTick(state, systems);
    const fp = state.store.get(factory)!.components.production!;
    const bp = state.store.get(barracks)!.components.production!;
    expect(fp.queue.length > 0 || fp.current === 'scout_vehicle').toBe(true);
    expect(bp.queue.length).toBe(0);
    expect(bp.current ?? null).toBe(null);
    // The scout spawns with combat + movement after its build time.
    for (let t = 0; t < 220; t++) runTick(state, systems);
    const scout = state.store.all().find(e => e.components.faction?.faction === 'scout_vehicle');
    expect(scout).toBeDefined();
    expect(scout!.components.combat?.weaponId).toBe('scout_gun');
  });
});

describe('FG-3 — AI combined arms', () => {
  it('a rich AI with no expansion left founds a War Factory and queues vehicles', () => {
    const state = makeSimState({ seed: 11, mapWidth: 32, mapHeight: 32 });
    state.store.create({
      position: tileToWorldCenter({ tx: 26, ty: 8 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'enemy', faction: 'refinery' },
      economy: { credits: 2000, refineryStorage: 2000, maxStorage: 2000 },
      production: { queue: [], progress: 0 },
      health: { hp: 1500, maxHp: 1500 },
    });
    state.store.create({
      position: tileToWorldCenter({ tx: 27, ty: 8 }),
      movement: { target: null, path: [], speed: 10 },
      faction: { team: 'enemy', faction: 'harvester' },
      health: { hp: 200, maxHp: 200 },
      harvest: { state: 'IDLE', targetTile: null, targetRefinery: null, cargo: 0 },
    });
    // XP-1: the factory is T2 — give the AI an already-upgraded HQ (the upgrade
    // path itself is covered in tiers.test.ts).
    state.store.create({
      position: tileToWorldCenter({ tx: 25, ty: 9 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'enemy', faction: 'construction_yard' },
      tech: { tier: 2, upgradingTo: null, ticksLeft: 0 },
      health: { hp: 2000, maxHp: 2000 },
    });
    // NO rich fields anywhere → expansion unavailable → factory threshold 1300.
    const ai = makeAiSystem(units, { team: 'enemy', attackTile: { tx: 5, ty: 5 } });
    const systems = orderSystems([ai]);
    for (let t = 0; t < 40; t++) runTick(state, systems);
    const factory = state.store.all().find(e => e.components.faction?.team === 'enemy' && e.components.faction?.faction === 'war_factory');
    expect(factory).toBeDefined();
    expect(factory!.components.production!.queue.length).toBeGreaterThan(0); // vehicles queued
    // It PAID for the factory.
    const total = state.store.all().filter(e => e.components.faction?.team === 'enemy' && e.components.economy)
      .reduce((s, e) => s + e.components.economy!.credits, 0);
    expect(total).toBe(1000); // 2000 − 1000
  });
});
