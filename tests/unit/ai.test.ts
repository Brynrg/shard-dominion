// ── AI FSM unit tests (v0.24): economy, reactive composition, plan selection ─────
import { describe, it, expect, beforeEach } from 'vitest';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { makeAiSystem } from '../../src/sim/systems/ai.js';
import { makeProductionSystem } from '../../src/sim/systems/production.js';
import { orderSystems, runTick, type SimSystem } from '../../src/sim/loop.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import { loadUnits } from '../../src/loaders/units.js';
import { loadStructures } from '../../src/loaders/structures.js';
import unitsData from '../../data/units.json' with { type: 'json' };
import structuresData from '../../data/structures.json' with { type: 'json' };
import { asEntityId } from '../../src/sim/ids.js';

const units = loadUnits(unitsData);
const structures = loadStructures(structuresData);

function addRefinery(state: SimState, tx: number, ty: number, credits: number, team = 'enemy' as const) {
  return state.store.create({
    position: tileToWorldCenter({ tx, ty }),
    building: { onSlab: true, buildProgress: 100, powered: true },
    faction: { team, faction: 'refinery' },
    economy: { credits, refineryStorage: credits, maxStorage: 2000 },
    production: { queue: [], progress: 0, current: null },
    health: { hp: 1500, maxHp: 1500 }, armor: { armorClass: 'BUILDING' },
  });
}
function addBarracks(state: SimState, tx: number, ty: number, team = 'enemy' as const) {
  return state.store.create({
    position: tileToWorldCenter({ tx, ty }),
    building: { onSlab: true, buildProgress: 100, powered: true },
    faction: { team, faction: 'barracks' },
    production: { queue: [], progress: 0 },
    health: { hp: 800, maxHp: 800 }, armor: { armorClass: 'BUILDING' },
  });
}
function addHarvester(state: SimState, tx: number, ty: number, team: 'player' | 'enemy' = 'enemy') {
  return state.store.create({
    position: tileToWorldCenter({ tx, ty }),
    movement: { target: null, path: [], speed: 10 },
    faction: { team, faction: 'harvester' },
    health: { hp: 200, maxHp: 200 }, armor: { armorClass: 'MEDIUM' },
    harvest: { state: 'SEEK', targetTile: null, targetRefinery: null, cargo: 0 },
  });
}
function addSoldier(state: SimState, tx: number, ty: number, team: 'player' | 'enemy' = 'enemy', faction = 'infantry', weaponId = 'rifle') {
  return state.store.create({
    position: tileToWorldCenter({ tx, ty }),
    health: { hp: 20, maxHp: 20 },
    movement: { target: null, path: [], speed: 12 },
    combat: { weaponId, cooldownRemaining: 0, targetId: null },
    faction: { team, faction },
  });
}

describe('ai FSM — economy', () => {
  let state: SimState;
  let systems: readonly SimSystem[];
  const cfg = { team: 'enemy' as const, attackTile: { tx: 5, ty: 5 }, evalInterval: 1 };

  beforeEach(() => {
    state = makeSimState({ seed: 42, mapWidth: 32, mapHeight: 32 });
    systems = orderSystems([makeAiSystem(units, cfg, structures)]);
  });

  it('rebuilds a lost harvester at the refinery (no harvester alive)', () => {
    const ref = addRefinery(state, 10, 10, 600);
    runTick(state, systems);
    expect(state.store.get(ref)?.components.production?.queue).toEqual(['harvester']);
  });

  it('does NOT queue a harvester when one is alive', () => {
    const ref = addRefinery(state, 10, 10, 600);
    addHarvester(state, 11, 10);
    runTick(state, systems);
    expect(state.store.get(ref)?.components.production?.queue).toEqual([]);
  });
});

describe('ai FSM — reactive composition', () => {
  let state: SimState;
  let systems: readonly SimSystem[];
  const cfg = { team: 'enemy' as const, attackTile: { tx: 5, ty: 5 }, evalInterval: 1 };

  beforeEach(() => {
    state = makeSimState({ seed: 42, mapWidth: 32, mapHeight: 32 });
    systems = orderSystems([makeAiSystem(units, cfg, structures)]);
  });

  it('queues infantry by default (no player army observed)', () => {
    addRefinery(state, 10, 10, 600);
    addHarvester(state, 11, 10);
    const bar = addBarracks(state, 12, 10);
    runTick(state, systems);
    expect(state.store.get(bar)?.components.production?.queue).toEqual(['infantry']);
  });

  it('counters a rifle-heavy player with a vehicle', () => {
    addRefinery(state, 10, 10, 600);
    addHarvester(state, 11, 10);
    const bar = addBarracks(state, 12, 10);
    addSoldier(state, 3, 3, 'player', 'infantry', 'rifle');
    addSoldier(state, 4, 3, 'player', 'infantry', 'rifle');
    runTick(state, systems);
    expect(state.store.get(bar)?.components.production?.queue).toEqual(['vehicle']);
  });

  it('does not queue a unit the bank cannot start', () => {
    addRefinery(state, 10, 10, 50); // 50 < infantry cost 100
    addHarvester(state, 11, 10);
    const bar = addBarracks(state, 12, 10);
    runTick(state, systems);
    expect(state.store.get(bar)?.components.production?.queue).toEqual([]);
  });
});

describe('ai FSM — plans', () => {
  let state: SimState;

  beforeEach(() => {
    state = makeSimState({ seed: 42, mapWidth: 32, mapHeight: 32 });
  });

  it('Assault: a strong army marches on the attack tile', () => {
    const cfg = { team: 'enemy' as const, attackTile: { tx: 2, ty: 2 }, evalInterval: 1, assaultValue: 200 };
    const systems = orderSystems([makeAiSystem(units, cfg, structures)]);
    addRefinery(state, 10, 10, 600); addHarvester(state, 11, 10);
    const a = addSoldier(state, 10, 12); const b = addSoldier(state, 11, 12); // value 200 ≥ 200
    runTick(state, systems);
    const target = tileToWorldCenter({ tx: 2, ty: 2 });
    expect(state.store.get(a)?.components.movement?.target).toEqual(target);
    expect(state.store.get(b)?.components.movement?.target).toEqual(target);
  });

  it('Assault does not retarget an already-fighting unit', () => {
    const cfg = { team: 'enemy' as const, attackTile: { tx: 2, ty: 2 }, evalInterval: 1, assaultValue: 200 };
    const systems = orderSystems([makeAiSystem(units, cfg, structures)]);
    addRefinery(state, 10, 10, 600); addHarvester(state, 11, 10);
    const fighting = addSoldier(state, 10, 12);
    state.store.get(fighting)!.components.combat!.targetId = asEntityId(999);
    const idle = addSoldier(state, 11, 12); addSoldier(state, 12, 12);
    runTick(state, systems);
    expect(state.store.get(fighting)?.components.movement?.target).toBeNull();
    expect(state.store.get(idle)?.components.movement?.target).toEqual(tileToWorldCenter({ tx: 2, ty: 2 }));
  });

  it('Raid: peels units to an exposed player harvester (not the base)', () => {
    const cfg = { team: 'enemy' as const, attackTile: { tx: 2, ty: 2 }, evalInterval: 1, raidUnitCap: 2 };
    const systems = orderSystems([makeAiSystem(units, cfg, structures)]);
    addRefinery(state, 10, 10, 600); addHarvester(state, 11, 10);
    // Medium army (300 < 500 assault threshold) → not an assault.
    const s1 = addSoldier(state, 10, 12); const s2 = addSoldier(state, 11, 12); const s3 = addSoldier(state, 12, 12);
    // Player harvester far away with NO player defenders → exposed.
    addHarvester(state, 24, 24, 'player');
    runTick(state, systems);
    const raidTarget = tileToWorldCenter({ tx: 24, ty: 24 });
    const targets = [s1, s2, s3].map(id => state.store.get(id)?.components.movement?.target);
    const raiders = targets.filter(t => t?.wx === raidTarget.wx && t?.wy === raidTarget.wy);
    expect(raiders.length).toBe(2); // exactly raidUnitCap
  });

  it('Stabilize: no harvester → recalls the army home AND rebuilds a harvester', () => {
    const cfg = { team: 'enemy' as const, attackTile: { tx: 2, ty: 2 }, evalInterval: 1, assaultValue: 100 };
    const systems = orderSystems([makeAiSystem(units, cfg, structures)]);
    const ref = addRefinery(state, 10, 10, 600); // no harvester
    const a = addSoldier(state, 20, 20); addSoldier(state, 21, 20);
    runTick(state, systems);
    // army recalled to the base (refinery) position, not the attack tile
    expect(state.store.get(a)?.components.movement?.target).toEqual(tileToWorldCenter({ tx: 10, ty: 10 }));
    expect(state.store.get(ref)?.components.production?.queue).toEqual(['harvester']);
  });
});

describe('ai FSM — end to end', () => {
  it('AI queues → production builds → an enemy combat unit exists', () => {
    const state = makeSimState({ seed: 42, mapWidth: 32, mapHeight: 32 });
    const cfg = { team: 'enemy' as const, attackTile: { tx: 5, ty: 5 }, evalInterval: 1 };
    addRefinery(state, 10, 10, 600); addHarvester(state, 11, 10); addBarracks(state, 12, 10);
    const systems = orderSystems([makeAiSystem(units, cfg, structures), makeProductionSystem(units)]);
    for (let i = 0; i < 80; i++) runTick(state, systems);
    const combat = state.store.all().find(e =>
      e.components.faction?.team === 'enemy' && e.components.combat && e.components.health && e.components.movement);
    expect(combat).toBeDefined();
  });
});
