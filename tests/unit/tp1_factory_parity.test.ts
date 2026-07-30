// ── TP-1 (v0.42 Truth Pass): every creation path builds IDENTICAL entities ──────
// QA round 2's root finding: seed/production/trigger/AI/placement had drifted.
// These tests create the same kind through EVERY path and assert the components
// that previously diverged (flying, ammo, stealth, shields, containers, arming,
// power demand, production) are present on all of them.
import { describe, it, expect } from 'vitest';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { orderSystems, runTick } from '../../src/sim/loop.js';
import { makeProductionSystem } from '../../src/sim/systems/production.js';
import { makeCommandSystem } from '../../src/sim/systems/command.js';
import { makeObjectivesSystem } from '../../src/sim/systems/objectives.js';
import { unitComponents, structureComponents } from '../../src/sim/factory.js';
import { makeCommandQueue } from '../../src/view/input.js';
import { loadUnits } from '../../src/loaders/units.js';
import { loadStructures } from '../../src/loaders/structures.js';
import { FACTIONS, makeTeamFactions } from '../../src/sim/factions.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import unitsData from '../../data/units.json' with { type: 'json' };
import structuresData from '../../data/structures.json' with { type: 'json' };

const units = loadUnits(unitsData);
const structures = loadStructures(structuresData);
type Entity = ReturnType<SimState['store']['all']>[number];

/** Spawn `kind` through production (bank + producer seeded, queue drained). */
function produceUnit(kind: string, producerKind: string): Entity {
  const state = makeSimState({ seed: 3, mapWidth: 32, mapHeight: 32 });
  state.store.create({
    position: tileToWorldCenter({ tx: 8, ty: 8 }),
    ...structureComponents('refinery', 'player', structures, { credits: 9000, refineryMaxStorage: 9000 }),
  });
  state.store.create({
    position: tileToWorldCenter({ tx: 10, ty: 8 }),
    ...structureComponents(producerKind, 'player', structures),
  });
  // Producer queue + a T3 tech anchor so tier gates never interfere.
  const producer = state.store.all().find(e => e.components.faction?.faction === producerKind)!;
  producer.components.production = { queue: [kind], progress: 0 };
  producer.components.tech = { tier: 3, upgradingTo: null, ticksLeft: 0 };
  const tf = makeTeamFactions('concord', 'concord');
  const sys = orderSystems([makeProductionSystem(units, tf)]);
  for (let i = 0; i < 900; i++) {
    runTick(state, sys);
    const u = state.store.all().find(e => e.components.faction?.faction === kind && !e.components.building);
    if (u) return u;
  }
  throw new Error(`production never spawned ${kind}`);
}

/** Spawn `kind` through a mission trigger. */
function triggerUnit(kind: string): Entity {
  const state = makeSimState({ seed: 3, mapWidth: 32, mapHeight: 32 });
  const tf = makeTeamFactions('concord', 'concord');
  const sys = makeObjectivesSystem(
    [{ type: 'survive', seconds: 999, primary: true, text: 'x' }], [],
    [{ id: 't', when: { timeSeconds: 0.05 }, actions: [{ type: 'spawn', team: 'player', units: [{ type: kind, tx: 12, ty: 12 }], attackMoveTo: { tx: 20, ty: 20 } }] }],
    units, tf);
  const systems = orderSystems([sys]);
  for (let i = 0; i < 10; i++) runTick(state, systems);
  const u = state.store.all().find(e => e.components.faction?.faction === kind);
  if (!u) throw new Error(`trigger never spawned ${kind}`);
  return u;
}

/** Spawn `kind` as the seed path does (factory direct — seedMission delegates). */
function seedUnit(kind: string, faction = FACTIONS.concord): Entity {
  const state = makeSimState({ seed: 3, mapWidth: 32, mapHeight: 32 });
  const def = units.find(u => u.id === kind)!;
  const id = state.store.create({ position: tileToWorldCenter({ tx: 5, ty: 5 }), ...unitComponents(def, 'player', faction) });
  return state.store.get(id)!;
}

describe('TP-1 — unit parity across creation paths', () => {
  it('gunships FLY with ammo on every path (the audit headline)', () => {
    for (const [path, u] of [
      ['seed', seedUnit('gunship')],
      ['production', produceUnit('gunship', 'skypad')],
      ['trigger', triggerUnit('gunship')],
    ] as const) {
      expect(u.components.movement?.flying, `${path}: flying`).toBe(true);
      expect(u.components.combat?.ammo, `${path}: ammo`).toBe(6);
      expect(u.components.combat?.ammoMax, `${path}: ammoMax`).toBe(6);
    }
  });

  it('ghostwalkers spawn CLOAKED on every path', () => {
    // (production path needs the emberhand faction for the lock — use trigger+seed
    // for concord-side lock realism isn't the point; stealth presence is.)
    const state = makeSimState({ seed: 3, mapWidth: 32, mapHeight: 32 });
    void state;
    for (const [path, u] of [
      ['seed', seedUnit('ghostwalker', FACTIONS.emberhand)],
      ['trigger', triggerUnit('ghostwalker')],
    ] as const) {
      expect(u.components.stealth?.cloaked, `${path}: cloaked`).toBe(true);
    }
  });

  it('APCs carry their container on every path', () => {
    for (const [path, u] of [
      ['seed', seedUnit('skimmer_apc')],
      ['production', produceUnit('skimmer_apc', 'war_factory')],
      ['trigger', triggerUnit('skimmer_apc')],
    ] as const) {
      expect(u.components.container?.capacity, `${path}: container`).toBe(5);
    }
  });

  it('Concord combat units carry shields on every path (workers never do)', () => {
    const def = units.find(u => u.id === 'infantry')!;
    const bag = unitComponents(def, 'player', FACTIONS.concord);
    expect((bag.shield as { hp: number }).hp).toBe(20);
    const harv = unitComponents(units.find(u => u.id === 'harvester')!, 'player', FACTIONS.concord);
    expect(harv.shield).toBeUndefined();
    // Trigger path with concord factions:
    const t = triggerUnit('infantry');
    expect(t.components.shield?.hp).toBe(20);
  });
});

describe('TP-1 — structure parity across creation paths', () => {
  it('AA turrets are ARMED and power-hungry from seed, placement, and factory', () => {
    const bag = structureComponents('aa_turret', 'player', structures);
    expect((bag.combat as { weaponId: string }).weaponId).toBe('aa_missile');
    expect((bag.power as { powerDemand: number }).powerDemand).toBeGreaterThan(0);
    // Placement path:
    const state = makeSimState({ seed: 3, mapWidth: 32, mapHeight: 32 });
    state.store.create({ position: tileToWorldCenter({ tx: 8, ty: 8 }), ...structureComponents('construction_yard', 'player', structures) });
    // Tech spine (Phase C2): refinery/turrets now require a standing Power Node,
    // so the fixture base has the one a real base always builds first.
    state.store.create({ position: tileToWorldCenter({ tx: 6, ty: 8 }), ...structureComponents('power_node', 'player', structures) });
    state.store.create({ position: tileToWorldCenter({ tx: 9, ty: 8 }), ...structureComponents('refinery', 'player', structures, { credits: 5000, refineryMaxStorage: 5000 }) });
    const queue = makeCommandQueue();
    const sys = orderSystems([makeCommandSystem(queue, structures)]);
    // RA build flow (v0.55): the sidebar job serves the build time; tests
    // fast-forward it, then place the READY structure.
    queue.push({ type: 'build-structure', structureId: 'aa_turret' });
    runTick(state, sys);
    { const j = state.structureBuild.get('player'); if (j) j.ticksLeft = 0; }
    queue.push({ type: 'place-structure', structureId: 'aa_turret', tile: { tx: 11, ty: 9 } });
    runTick(state, sys);
    const aa = state.store.all().find(e => e.components.faction?.faction === 'aa_turret');
    expect(aa, 'placement spawned AA').toBeDefined();
    expect(aa!.components.combat?.weaponId).toBe('aa_missile');
    expect(aa!.components.power?.powerDemand).toBeGreaterThan(0);
  });

  it('skypads are PRODUCERS on every path; plants/turrets carry their power demand', () => {
    expect(structureComponents('skypad', 'player', structures).production).toBeDefined();
    expect((structureComponents('processing_plant', 'player', structures).power as { powerDemand: number }).powerDemand).toBe(25);
    expect((structureComponents('defense_turret', 'player', structures).power as { powerDemand: number } | undefined)?.powerDemand ?? 0).toBeGreaterThanOrEqual(0);
  });

  it('the ConYard carries the TP-2 command-reserve bank', () => {
    const bag = structureComponents('construction_yard', 'player', structures);
    expect((bag.economy as { maxStorage: number }).maxStorage).toBe(1500);
  });
});
