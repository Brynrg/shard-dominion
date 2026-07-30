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
import { AI_PERSONALITIES } from '../../src/sim/aiPersonality.js';

// Plan tests run with no learning grace and no post-wave lull: they assert plan
// SELECTION, not the wave pacing that aiPersonality.ts is responsible for.
const NO_GRACE = { ...AI_PERSONALITIES.normal, graceTicks: 0, waveLullTicks: 0 };

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

/** A HEAVY-armour player vehicle. Classification is by armorClass (Phase B5), so the
 *  fixture must actually carry one — addSoldier() leaves it at the 'NONE' default. */
function addArmour(state: SimState, tx: number, ty: number, team: 'player' | 'enemy' = 'player') {
  return state.store.create({
    position: tileToWorldCenter({ tx, ty }),
    health: { hp: 220, maxHp: 220 },
    armor: { armorClass: 'HEAVY' },
    movement: { target: null, path: [], speed: 9 },
    combat: { weaponId: 'tank_shell_v', cooldownRemaining: 0, targetId: null },
    faction: { team, faction: 'assault_tank' },
  });
}

describe('ai FSM — economy', () => {
  let state: SimState;
  let systems: readonly SimSystem[];
  const cfg = { team: 'enemy' as const, attackTile: { tx: 5, ty: 5 }, evalInterval: 1, personality: NO_GRACE };

  beforeEach(() => {
    state = makeSimState({ seed: 42, mapWidth: 32, mapHeight: 32 });
    systems = orderSystems([makeAiSystem(units, cfg, structures)]);
  });

  it('rebuilds a lost harvester at the refinery (no harvester alive)', () => {
    const ref = addRefinery(state, 10, 10, 600);
    runTick(state, systems);
    expect(state.store.get(ref)?.components.production?.queue).toEqual(['harvester']);
  });

  it('builds up to the personality target, then stops', () => {
    // Harvester COUNT is the economic lever now (Phase A1), so one alive is not
    // "enough" — the AI works toward targetHarvesters and then leaves it alone.
    const ref = addRefinery(state, 10, 10, 600);
    addHarvester(state, 11, 10);
    runTick(state, systems);
    expect(state.store.get(ref)?.components.production?.queue,
      'still below target → keeps investing').toEqual(['harvester']);

    // At the target it must stop.
    const state2 = makeSimState({ seed: 42, mapWidth: 32, mapHeight: 32 });
    const sys2 = orderSystems([makeAiSystem(units, cfg, structures)]);
    const ref2 = addRefinery(state2, 10, 10, 600);
    for (let i = 0; i < AI_PERSONALITIES.normal.targetHarvesters; i++) addHarvester(state2, 11 + i, 10);
    runTick(state2, sys2);
    expect(state2.store.get(ref2)?.components.production?.queue).toEqual([]);
  });
});

describe('ai FSM — reactive composition', () => {
  let state: SimState;
  let systems: readonly SimSystem[];
  const cfg = { team: 'enemy' as const, attackTile: { tx: 5, ty: 5 }, evalInterval: 1, personality: NO_GRACE };

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

  it('cannot react to a player army it cannot SEE (fog, Phase B4)', () => {
    addRefinery(state, 10, 10, 600);
    addHarvester(state, 11, 10);
    const bar = addBarracks(state, 12, 10);
    // Armour far outside the AI's 6-tile vision: it must open with its default pick,
    // because it has no way to know what it is facing. Pre-B4 the AI read the whole
    // store and countered through solid fog.
    addArmour(state, 3, 3); addArmour(state, 4, 3);
    runTick(state, systems);
    expect(state.store.get(bar)?.components.production?.queue).toEqual(['infantry']);
  });

  it('counters VISIBLE armour with rockets, from the Barracks (Phase A5/B5)', () => {
    addRefinery(state, 10, 10, 600);
    addHarvester(state, 11, 10);
    const bar = addBarracks(state, 12, 10);
    // Inside vision this time, and classified by ARMOUR CLASS — the old code compared
    // the faction id to 'vehicle', so tanks were miscounted as infantry.
    addArmour(state, 13, 11); addArmour(state, 14, 11);
    runTick(state, systems);
    const queued = state.store.get(bar)?.components.production?.queue ?? [];
    expect(queued).toEqual(['rocket_trooper']);
    // And whatever it queued must be something a Barracks can actually build.
    expect(units.find(u => u.id === queued[0])?.producedBy).toBe('barracks');
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
    const cfg = { team: 'enemy' as const, attackTile: { tx: 2, ty: 2 }, evalInterval: 1, assaultValue: 200, personality: NO_GRACE };
    const systems = orderSystems([makeAiSystem(units, cfg, structures)]);
    addRefinery(state, 10, 10, 600); addHarvester(state, 11, 10);
    const a = addSoldier(state, 10, 12); const b = addSoldier(state, 11, 12); // value 200 ≥ 200
    runTick(state, systems);
    const target = tileToWorldCenter({ tx: 2, ty: 2 });
    expect(state.store.get(a)?.components.movement?.target).toEqual(target);
    expect(state.store.get(b)?.components.movement?.target).toEqual(target);
  });

  it('Assault does not retarget an already-fighting unit', () => {
    const cfg = { team: 'enemy' as const, attackTile: { tx: 2, ty: 2 }, evalInterval: 1, assaultValue: 200, personality: NO_GRACE };
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
    const cfg = {
      team: 'enemy' as const, attackTile: { tx: 2, ty: 2 }, evalInterval: 1, raidUnitCap: 2,
      // Raiding must not be pre-empted by an assault, and needs no grace.
      personality: { ...NO_GRACE, assaultValue: 100000, pressureValue: 100000 },
    };
    const systems = orderSystems([makeAiSystem(units, cfg, structures)]);
    addRefinery(state, 10, 10, 600); addHarvester(state, 11, 10);
    const s1 = addSoldier(state, 10, 12); const s2 = addSoldier(state, 11, 12); const s3 = addSoldier(state, 12, 12);
    // The player harvester must be WITHIN the AI's vision (Phase B4): it can only raid
    // what it can actually see. Undefended, so it reads as exposed.
    addHarvester(state, 13, 13, 'player');
    runTick(state, systems);
    const raidTarget = tileToWorldCenter({ tx: 13, ty: 13 });
    const targets = [s1, s2, s3].map(id => state.store.get(id)?.components.movement?.target);
    const raiders = targets.filter(t => t?.wx === raidTarget.wx && t?.wy === raidTarget.wy);
    expect(raiders.length).toBe(2); // exactly raidUnitCap
  });

  it('Stabilize: no harvester → recalls the army home AND rebuilds a harvester', () => {
    const cfg = { team: 'enemy' as const, attackTile: { tx: 2, ty: 2 }, evalInterval: 1, personality: NO_GRACE };
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
    const cfg = { team: 'enemy' as const, attackTile: { tx: 5, ty: 5 }, evalInterval: 1, personality: NO_GRACE };
    addRefinery(state, 10, 10, 600); addHarvester(state, 11, 10); addBarracks(state, 12, 10);
    const systems = orderSystems([makeAiSystem(units, cfg, structures), makeProductionSystem(units)]);
    // Infantry build time comes from DATA (it was retuned 3s -> 5s in Phase A2), so
    // derive the wait instead of hardcoding 80 ticks.
    const wait = Math.round(units.find(u => u.id === 'infantry')!.buildTimeSeconds * 20) + 20;
    for (let i = 0; i < wait; i++) runTick(state, systems);
    const combat = state.store.all().find(e =>
      e.components.faction?.team === 'enemy' && e.components.combat && e.components.health && e.components.movement);
    expect(combat).toBeDefined();
  });
});
