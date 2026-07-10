// ── FG-2 map-economy tests: buildable refinery, turret, power penalty, repair, AI expand ──
import { describe, it, expect, beforeEach } from 'vitest';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { makeCommandSystem } from '../../src/sim/systems/command.js';
import { makeCommandQueue, type CommandQueue } from '../../src/view/input.js';
import { makeMovementSystem } from '../../src/sim/systems/movement.js';
import { makeCombatTargetingSystem } from '../../src/sim/systems/combatTargeting.js';
import { makeDamageSystem } from '../../src/sim/systems/damage.js';
import { makeProductionSystem } from '../../src/sim/systems/production.js';
import { makeConstructionSystem } from '../../src/sim/systems/construction.js';
import { makePowerSystem, teamPowerShortage } from '../../src/sim/systems/power.js';
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

function addConYard(state: SimState, tx: number, ty: number) {
  return state.store.create({
    position: tileToWorldCenter({ tx, ty }),
    building: { onSlab: true, buildProgress: 100, powered: true },
    faction: { team: 'player', faction: 'construction_yard' },
    construction: { queue: [], progress: 0, currentStructureId: null },
    power: { powerSupply: 20, powerDemand: 0, powered: true },
    health: { hp: 2000, maxHp: 2000 },
  });
}
function addBank(state: SimState, credits: number, team: 'player' | 'enemy' = 'player', tx = 6, ty = 8) {
  return state.store.create({
    position: tileToWorldCenter({ tx, ty }),
    building: { onSlab: true, buildProgress: 100, powered: true },
    faction: { team, faction: 'refinery' },
    economy: { credits, refineryStorage: credits, maxStorage: 2000 },
    production: { queue: [], progress: 0 },
    health: { hp: 1500, maxHp: 1500 },
  });
}

describe('FG-2 — buildable refinery + turret', () => {
  let state: SimState; let queue: CommandQueue; let systems: SimSystem[];
  beforeEach(() => {
    state = makeSimState({ seed: 1, mapWidth: 32, mapHeight: 32 });
    queue = makeCommandQueue();
    systems = orderSystems([
      makeCommandSystem(queue, structures),
      makeMovementSystem(),
      makeConstructionSystem(structures, queue),
      makePowerSystem(),
      makeCombatTargetingSystem(weapons),
      makeDamageSystem(weapons),
      makeProductionSystem(units),
    ]);
  });

  it('placing a refinery charges 1200 and creates a dock/bank/producer with NO free harvester', () => {
    addConYard(state, 8, 8);
    addBank(state, 1500);
    queue.push({ type: 'place-structure', structureId: 'refinery', tile: { tx: 10, ty: 8 } });
    runTick(state, systems);
    const refineries = state.store.all().filter(e => e.components.faction?.faction === 'refinery' && e.components.faction?.team === 'player');
    expect(refineries.length).toBe(2); // the bank + the new one
    const built = refineries.find(r => r.components.economy!.maxStorage === 1500)!;
    expect(built.components.production).toBeDefined();       // harvester producer
    expect(built.components.economy!.credits).toBe(0);       // no free credits
    const totalCredits = refineries.reduce((s, r) => s + r.components.economy!.credits, 0);
    expect(totalCredits).toBe(300);                          // 1500 − 1200
    const harvesters = state.store.all().filter(e => e.components.faction?.faction === 'harvester');
    expect(harvesters.length).toBe(0);                       // de-bundled: NO free harvester
  });

  it('a placed turret autonomously fires on an enemy in range (and never moves)', () => {
    addConYard(state, 8, 8);
    addBank(state, 1000);
    queue.push({ type: 'place-structure', structureId: 'defense_turret', tile: { tx: 10, ty: 10 } });
    runTick(state, systems);
    const turret = state.store.all().find(e => e.components.faction?.faction === 'defense_turret')!;
    expect(turret).toBeDefined();
    expect(turret.components.combat?.weaponId).toBe('raider_cannon');
    // Enemy soldier 2 tiles away (inside raider_cannon range 4).
    const foe = state.store.create({
      position: tileToWorldCenter({ tx: 12, ty: 10 }),
      health: { hp: 60, maxHp: 60 }, armor: { armorClass: 'LIGHT' },
      faction: { team: 'enemy', faction: 'infantry' },
    });
    // TP-3: the turret is a construction SITE first — build it out, then it fires.
    const buildTicks = structures.find(st => st.id === 'defense_turret')!.buildTimeSeconds * 20 + 40;
    for (let t = 0; t < buildTicks + 60; t++) runTick(state, systems);
    expect(state.store.get(foe)!.components.health!.hp).toBeLessThan(60);
    expect(turret.components.movement).toBeUndefined();
  });
});

describe('FG-2 — power shortage penalty', () => {
  it('production is ~40% slower while demand exceeds supply', () => {
    const build = (withPower: boolean): number => {
      const state = makeSimState({ seed: 2, mapWidth: 32, mapHeight: 32 });
      const queue = makeCommandQueue();
      const systems = orderSystems([
        makeCommandSystem(queue, structures),
        makePowerSystem(),
        makeProductionSystem(units),
      ]);
      addBank(state, 5000);
      // Barracks with power demand; supply only when withPower.
      state.store.create({
        position: tileToWorldCenter({ tx: 10, ty: 10 }),
        building: { onSlab: true, buildProgress: 100, powered: true },
        faction: { team: 'player', faction: 'barracks' },
        production: { queue: ['infantry'], progress: 0 },
        power: { powerSupply: withPower ? 100 : 0, powerDemand: 40, powered: true },
        health: { hp: 800, maxHp: 800 },
      });
      let ticks = 0;
      for (let t = 0; t < 400; t++) {
        runTick(state, systems);
        ticks = t + 1;
        const done = state.store.all().some(e => e.components.faction?.faction === 'infantry');
        if (done) break;
      }
      return ticks;
    };
    const powered = build(true);
    const starved = build(false);
    expect(starved).toBeGreaterThan(powered * 1.3); // ≈1.67× slower
  });

  it('teamPowerShortage is PER TEAM (enemy demand cannot brown-out the player)', () => {
    const state = makeSimState({ seed: 3, mapWidth: 32, mapHeight: 32 });
    state.store.create({ // player: balanced
      position: tileToWorldCenter({ tx: 5, ty: 5 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'power_node' },
      power: { powerSupply: 100, powerDemand: 0, powered: true },
    });
    state.store.create({ // enemy: starving
      position: tileToWorldCenter({ tx: 25, ty: 25 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'enemy', faction: 'barracks' },
      power: { powerSupply: 0, powerDemand: 50, powered: true },
    });
    expect(teamPowerShortage(state, 'player')).toBe(false);
    expect(teamPowerShortage(state, 'enemy')).toBe(true);
  });
});

describe('FG-2 — repair', () => {
  it('toggled repair heals the building and drains credits, then auto-clears', () => {
    const state = makeSimState({ seed: 4, mapWidth: 32, mapHeight: 32 });
    const queue = makeCommandQueue();
    const systems = orderSystems([
      makeCommandSystem(queue, structures),
      makeConstructionSystem(structures, queue),
    ]);
    const bank = addBank(state, 1000);
    const barracks = state.store.create({
      position: tileToWorldCenter({ tx: 10, ty: 10 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'barracks' },
      health: { hp: 300, maxHp: 800 },
      selection: { selected: true },
    });
    queue.push({ type: 'repair' });
    runTick(state, systems);
    expect(state.store.get(barracks)!.components.building!.repairing).toBe(true);
    for (let t = 0; t < 500; t++) runTick(state, systems);
    const h = state.store.get(barracks)!.components.health!;
    expect(h.hp).toBe(h.maxHp);                                              // fully healed
    expect(state.store.get(barracks)!.components.building!.repairing).toBe(false); // auto-cleared
    expect(state.store.get(bank)!.components.economy!.credits).toBeLessThan(1000); // credits drained
  });
});

describe('FG-2 — AI Expand', () => {
  it('a fat bank + a rich unexploited field → the AI founds a second refinery near it', () => {
    const state = makeSimState({ seed: 5, mapWidth: 32, mapHeight: 32 });
    addBank(state, 2000, 'enemy', 26, 8); // AI home refinery + fat bank
    state.store.create({ // its barracks (real AI bases have one; isolates this test)
      position: tileToWorldCenter({ tx: 25, ty: 9 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'enemy', faction: 'barracks' },
      production: { queue: [], progress: 0 },
      health: { hp: 800, maxHp: 800 },
    });
    state.store.create({ // its harvester (so Stabilize doesn't preempt)
      position: tileToWorldCenter({ tx: 27, ty: 8 }),
      movement: { target: null, path: [], speed: 10 },
      faction: { team: 'enemy', faction: 'harvester' },
      health: { hp: 200, maxHp: 200 },
      harvest: { state: 'IDLE', targetTile: null, targetRefinery: null, cargo: 0 },
    });
    // A rich field FAR from its refinery (player side of the map).
    for (let dx = 0; dx < 3; dx++) state.shardDensity.set(`${8 + dx},24`, 800);
    const ai = makeAiSystem(units, { team: 'enemy', attackTile: { tx: 5, ty: 5 } });
    const systems = orderSystems([ai]);
    for (let t = 0; t < 40; t++) runTick(state, systems);
    const refineries = state.store.all().filter(e => e.components.faction?.team === 'enemy' && e.components.faction?.faction === 'refinery');
    expect(refineries.length).toBe(2);
    const bank = state.store.all().find(e => e.components.faction?.team === 'enemy' && e.components.economy && e.components.economy.credits > 0)?.components.economy
      ?? state.store.all().find(e => e.components.faction?.team === 'enemy' && e.components.economy)?.components.economy;
    // It PAID for it (2000 − 1200 = 800 in the original bank).
    const total = state.store.all().filter(e => e.components.faction?.team === 'enemy' && e.components.economy)
      .reduce((s, e) => s + e.components.economy!.credits, 0);
    expect(total).toBe(800);
    expect(bank).toBeDefined();
  });
});
