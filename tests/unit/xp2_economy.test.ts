// ── XP-2 Economy 2.0: Cells, wrecks/salvage, Resonance attribution ──────────────
import { describe, it, expect, beforeEach } from 'vitest';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { orderSystems, runTick } from '../../src/sim/loop.js';
import { makeHarvestSystem } from '../../src/sim/systems/harvest.js';
import { makeVictorySystem } from '../../src/sim/systems/victory.js';
import { makeProductionSystem } from '../../src/sim/systems/production.js';
import { loadEconomyConstants } from '../../src/loaders/economyConstants.js';
import { loadUnits } from '../../src/loaders/units.js';
import { FACTIONS } from '../../src/sim/factions.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import economyData from '../../data/economyConstants.json' with { type: 'json' };
import unitsData from '../../data/units.json' with { type: 'json' };

const economy = loadEconomyConstants(economyData);
const units = loadUnits(unitsData);

function bank(state: SimState, team: 'player' | 'enemy', credits: number, cells = 0) {
  return state.store.create({
    position: tileToWorldCenter({ tx: 8, ty: 8 }),
    building: { onSlab: true, buildProgress: 100, powered: true },
    faction: { team, faction: 'refinery' },
    economy: { credits, refineryStorage: credits, maxStorage: 5000, cells },
    production: { queue: [], progress: 0 },
    health: { hp: 1500, maxHp: 1500 },
  });
}
function plant(state: SimState, team: 'player' | 'enemy') {
  return state.store.create({
    position: tileToWorldCenter({ tx: 10, ty: 8 }),
    building: { onSlab: true, buildProgress: 100, powered: true },
    faction: { team, faction: 'processing_plant' },
    power: { powerSupply: 0, powerDemand: 25, powered: true },
    health: { hp: 900, maxHp: 900 },
  });
}

describe('XP-2 — Cells', () => {
  let state: SimState;
  beforeEach(() => { state = makeSimState({ seed: 5, mapWidth: 32, mapHeight: 32 }); });

  it('a powered plant converts 100 credits → 1 Cell every 8s, capped at 12', () => {
    const b = bank(state, 'player', 2000);
    plant(state, 'player');
    const sys = orderSystems([makeHarvestSystem(economy)]);
    for (let i = 0; i < 8 * 20; i++) runTick(state, sys);
    const eco = state.store.get(b)!.components.economy!;
    expect(eco.cells).toBe(1);
    expect(eco.credits).toBe(1900);
    // Run far past the cap: cells never exceed 12.
    for (let i = 0; i < 8 * 20 * 30; i++) runTick(state, sys);
    expect(state.store.get(b)!.components.economy!.cells).toBeLessThanOrEqual(12);
  });

  it('no plant (or an unpowered one) converts nothing', () => {
    const b = bank(state, 'player', 2000);
    const p = plant(state, 'player');
    state.store.get(p)!.components.power!.powered = false;
    const sys = orderSystems([makeHarvestSystem(economy)]);
    for (let i = 0; i < 8 * 20 + 5; i++) runTick(state, sys);
    expect(state.store.get(b)!.components.economy!.cells ?? 0).toBe(0);
  });

  it('the Warden charges 2 Cells at production start (and waits without them)', () => {
    const b = bank(state, 'player', 5000, 0);
    const barracks = state.store.create({
      position: tileToWorldCenter({ tx: 12, ty: 8 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'barracks' },
      production: { queue: ['warden'], progress: 0 },
      health: { hp: 800, maxHp: 800 },
    });
    const sys = orderSystems([makeProductionSystem(units)]);
    for (let i = 0; i < 30; i++) runTick(state, sys);
    // No cells → job never starts, credits untouched.
    expect(state.store.get(b)!.components.economy!.credits).toBe(5000);
    expect(state.store.get(barracks)!.components.production!.queue).toContain('warden');
    // Grant cells → charges both currencies.
    state.store.get(b)!.components.economy!.cells = 2;
    for (let i = 0; i < 30; i++) runTick(state, sys);
    const eco = state.store.get(b)!.components.economy!;
    expect(eco.cells).toBe(0);
    expect(eco.credits).toBeLessThan(5000);
  });
});

describe('XP-2 — wrecks + salvage', () => {
  let state: SimState;
  beforeEach(() => { state = makeSimState({ seed: 5, mapWidth: 32, mapHeight: 32 }); });

  it('a dead tank leaves a wreck worth 30% of cost; a touching harvester reclaims it', () => {
    bank(state, 'player', 100);
    const tank = state.store.create({
      position: tileToWorldCenter({ tx: 15, ty: 15 }),
      movement: { target: null, path: [], speed: 9 },
      combat: { weaponId: 'tank_shell_v', cooldownRemaining: 0, targetId: null },
      faction: { team: 'enemy', faction: 'assault_tank' },
      health: { hp: 0, maxHp: 220 },
    });
    const victory = makeVictorySystem(units);
    const harvest = makeHarvestSystem(economy);
    const sys = orderSystems([harvest, victory]);
    runTick(state, sys); // cull → wreck
    expect(state.store.get(tank)).toBeUndefined();
    const wreck = state.store.all().find(e => e.components.faction?.faction === 'wreck');
    expect(wreck).toBeDefined();
    const tankCost = units.find(u => u.id === 'assault_tank')!.cost;
    expect(wreck!.components.resource!.cargo).toBe(Math.round(tankCost * 0.3));
    // A harvester parked on it reclaims (any faction).
    state.store.create({
      position: tileToWorldCenter({ tx: 15, ty: 15 }),
      movement: { target: null, path: [], speed: 10 },
      faction: { team: 'player', faction: 'harvester' },
      health: { hp: 200, maxHp: 200 },
      harvest: { state: 'IDLE', targetTile: null, targetRefinery: null, cargo: 0 },
    });
    runTick(state, sys);
    expect(state.store.all().some(e => e.components.faction?.faction === 'wreck')).toBe(false);
    const eco = state.store.all().find(e => e.components.economy)!.components.economy!;
    // (± the emergency trickle, which also runs — this bank has no live harvester... it does now, so exact +value plus ≤1 trickle tick)
    expect(eco.credits).toBeGreaterThanOrEqual(100 + Math.round(tankCost * 0.3));
    expect(eco.credits).toBeLessThan(102 + Math.round(tankCost * 0.3));
  });

  it('Emberhand salvages with ANY unit; Concord infantry cannot', () => {
    bank(state, 'player', 0);
    state.store.create({
      position: tileToWorldCenter({ tx: 15, ty: 15 }),
      faction: { team: 'neutral', faction: 'wreck' },
      resource: { cargo: 90, capacity: 90 },
    });
    state.store.create({
      position: tileToWorldCenter({ tx: 15, ty: 15 }),
      movement: { target: null, path: [], speed: 12 },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
      faction: { team: 'player', faction: 'infantry' },
      health: { hp: 20, maxHp: 20 },
    });
    // Concord (no salvageAll): infantry can't reclaim.
    const concordSys = orderSystems([makeHarvestSystem(economy, { player: FACTIONS.concord, enemy: FACTIONS.concord })]);
    runTick(state, concordSys);
    expect(state.store.all().some(e => e.components.faction?.faction === 'wreck')).toBe(true);
    // Emberhand: the same infantry reclaims by touch.
    const emberSys = orderSystems([makeHarvestSystem(economy, { player: FACTIONS.emberhand, enemy: FACTIONS.concord })]);
    runTick(state, emberSys);
    expect(state.store.all().some(e => e.components.faction?.faction === 'wreck')).toBe(false);
    const c = state.store.all().find(e => e.components.economy)!.components.economy!.credits;
    expect(c).toBeGreaterThanOrEqual(90); // + ≤2 ticks of the no-harvester trickle
    expect(c).toBeLessThan(93);
  });
});
