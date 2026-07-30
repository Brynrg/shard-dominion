// ── Phase C sim gates: producer binding, tech spine, stacking, superweapons ────
import { describe, it, expect } from 'vitest';
import { makeSimState, type SimState, stateHash } from '../../src/sim/state.js';
import { orderSystems, runTick, SIM_TICK_RATE } from '../../src/sim/loop.js';
import { makeCommandSystem } from '../../src/sim/systems/command.js';
import { makeProductionSystem } from '../../src/sim/systems/production.js';
import { makeConstructionSystem } from '../../src/sim/systems/construction.js';
import { makeCommandQueue } from '../../src/view/input.js';
import { structureComponents, unitComponents } from '../../src/sim/factory.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import { loadUnits } from '../../src/loaders/units.js';
import { loadStructures } from '../../src/loaders/structures.js';
import { loadRefinements, refinementValue } from '../../src/loaders/refinements.js';
import { makeTeamFactions } from '../../src/sim/factions.js';
import { refuseStructure, prerequisitesMet, hasStructure } from '../../src/sim/buildRules.js';
import unitsData from '../../data/units.json' with { type: 'json' };
import structuresData from '../../data/structures.json' with { type: 'json' };
import refinementsData from '../../data/refinements.json' with { type: 'json' };

const units = loadUnits(unitsData);
const structures = loadStructures(structuresData);
const refinements = loadRefinements(refinementsData);
const tf = makeTeamFactions('concord', 'emberhand');

function base(state: SimState, credits = 20000, tier = 3): void {
  state.store.create({
    position: tileToWorldCenter({ tx: 8, ty: 8 }),
    ...structureComponents('construction_yard', 'player', structures),
  });
  // A powered base: without supply, production runs at the low-power penalty (2 of
  // every 5 ticks skipped) and the build waits below would undershoot.
  state.store.create({
    position: tileToWorldCenter({ tx: 6, ty: 8 }),
    ...structureComponents('power_node', 'player', structures),
  });
  // Give the HQ the tier under test outright (the ladder itself is tiers.test.ts).
  for (const e of state.store.all()) {
    if (e.components.faction?.faction === 'construction_yard' && e.components.tech) {
      e.components.tech = { tier, upgradingTo: null, ticksLeft: 0 };
    }
  }
  state.store.create({
    position: tileToWorldCenter({ tx: 11, ty: 8 }),
    ...structureComponents('refinery', 'player', structures, { credits, refineryMaxStorage: 99999 }),
  });
  // Elite units (heroes) charge Cells at production start — stock the bank so the
  // producer-binding sweep can actually build them.
  for (const e of state.store.all()) {
    if (e.components.faction?.faction === 'refinery' && e.components.economy) {
      e.components.economy.cells = 12;
    }
  }
}

describe('Phase A5 — producer binding is sim-authoritative', () => {
  it('a Barracks cannot build a tank, and a War Factory can', () => {
    for (const [producerKind, shouldBuild] of [['barracks', false], ['war_factory', true]] as const) {
      const state = makeSimState({ seed: 1, mapWidth: 32, mapHeight: 32 });
      base(state);
      state.store.create({
        position: tileToWorldCenter({ tx: 14, ty: 14 }),
        ...structureComponents(producerKind, 'player', structures),
      });
      const producer = [...state.store.all()].find(e => e.components.faction?.faction === producerKind)!;
      producer.components.production = { queue: ['assault_tank'], progress: 0 };
      const sys = orderSystems([makeProductionSystem(units, tf)]);
      const ticks = Math.round(units.find(u => u.id === 'assault_tank')!.buildTimeSeconds * SIM_TICK_RATE) + 20;
      for (let t = 0; t < ticks; t++) runTick(state, sys);
      const built = [...state.store.all()].some(e => e.components.faction?.faction === 'assault_tank');
      expect(built, `${producerKind} building a tank`).toBe(shouldBuild);
    }
  });

  it('every unit is buildable by exactly the structure its data names', () => {
    for (const u of units) {
      if (!u.producedBy) continue;
      const state = makeSimState({ seed: 2, mapWidth: 32, mapHeight: 32 });
      base(state);
      // The producer this unit declares.
      state.store.create({
        position: tileToWorldCenter({ tx: 5, ty: 14 }),
        ...structureComponents(u.producedBy, 'player', structures),
      });
      const producer = [...state.store.all()].find(e => e.components.faction?.faction === u.producedBy)!;
      expect(producer.components.production, `${u.producedBy} must be a producer`).toBeDefined();
      producer.components.production = { queue: [u.id], progress: 0 };
      const sys = orderSystems([makeProductionSystem(units, tf)]);
      for (let t = 0; t < Math.round(u.buildTimeSeconds * SIM_TICK_RATE) + 20; t++) runTick(state, sys);
      // Faction-locked units only build for their own faction (player = concord here).
      if (u.factionLock && u.factionLock !== 'concord') continue;
      const built = [...state.store.all()].some(e => e.components.faction?.faction === u.id);
      expect(built, `${u.producedBy} should build ${u.id}`).toBe(true);
    }
  });
});

describe('Phase C2 — the tech spine is enforced', () => {
  it('a structure with unmet prerequisites is refused, and allowed once met', () => {
    const state = makeSimState({ seed: 3, mapWidth: 32, mapHeight: 32 });
    base(state);
    const techLab = structures.find(s => s.id === 'tech_lab')!;
    expect(techLab.prerequisites).toContain('war_factory');
    // No War Factory yet → refused for the right reason.
    expect(prerequisitesMet(state, 'player', techLab)).toBe(false);
    expect(refuseStructure(state, 'player', techLab, 'concord')).toBe('prereq');
    // Raise one → allowed.
    state.store.create({
      position: tileToWorldCenter({ tx: 5, ty: 5 }),
      ...structureComponents('war_factory', 'player', structures),
    });
    expect(hasStructure(state, 'player', 'war_factory')).toBe(true);
    expect(refuseStructure(state, 'player', techLab, 'concord')).toBeNull();
  });

  it('an unfinished prerequisite does NOT unlock anything', () => {
    const state = makeSimState({ seed: 4, mapWidth: 32, mapHeight: 32 });
    base(state);
    // A War Factory still under construction is a scaffold, not a War Factory.
    state.store.create({
      position: tileToWorldCenter({ tx: 5, ty: 5 }),
      ...structureComponents('war_factory', 'player', structures, { buildProgress: 0 }),
    });
    expect(hasStructure(state, 'player', 'war_factory')).toBe(false);
    expect(refuseStructure(state, 'player', structures.find(s => s.id === 'tech_lab')!, 'concord')).toBe('prereq');
  });

  it('the build-structure command refuses an unmet prerequisite and keeps the money', () => {
    const state = makeSimState({ seed: 5, mapWidth: 32, mapHeight: 32 });
    base(state, 20000);
    const queue = makeCommandQueue();
    const sys = orderSystems([makeCommandSystem(queue, structures, ['warden'], refinements, units, tf)]);
    queue.push({ type: 'build-structure', structureId: 'tech_lab' }); // needs a War Factory
    runTick(state, sys);
    expect(state.structureBuild.get('player'), 'no job should start').toBeUndefined();
    const credits = [...state.store.all()].reduce((s, e) => s + (e.components.economy?.credits ?? 0), 0);
    expect(credits, 'a refused build must not charge').toBe(20000);
  });
});

describe('Phase C2 — refinements stack instead of shadowing', () => {
  it('two damage refinements sum (tier 2 used to be a silent no-op)', () => {
    const t1 = refinements.find(r => r.effect === 'damage' && (r.tier ?? 1) === 1)!;
    const t2 = refinements.find(r => r.effect === 'damage' && r.tier === 2)!;
    const one = refinementValue([t1.id], refinements, 'damage');
    const both = refinementValue([t1.id, t2.id], refinements, 'damage');
    expect(one).toBeCloseTo(t1.value);
    expect(both, 'the tier-2 refinement must ADD, not be shadowed').toBeCloseTo(t1.value + t2.value);
    expect(both).toBeGreaterThan(one);
  });

  it('every effect declared in the data is read by some system', () => {
    // Guards against re-introducing a paid-for no-op. `range`/`firepower`/`buildTime`
    // were parsed and applied nowhere before Phase C2.
    const effects = new Set(refinements.map(r => r.effect));
    for (const eff of effects) {
      expect(refinementValue(['__none__'], refinements, eff)).toBe(0);
      const holder = refinements.find(r => r.effect === eff)!;
      expect(refinementValue([holder.id], refinements, eff)).toBeGreaterThan(0);
    }
  });
});

describe('Phase C3 — superweapons', () => {
  function withIonCannon(): { state: SimState; queue: ReturnType<typeof makeCommandQueue>; sys: ReturnType<typeof orderSystems> } {
    const state = makeSimState({ seed: 6, mapWidth: 32, mapHeight: 32 });
    base(state);
    state.store.create({
      position: tileToWorldCenter({ tx: 6, ty: 12 }),
      ...structureComponents('ion_cannon', 'player', structures),
    });
    const queue = makeCommandQueue();
    const sys = orderSystems([
      makeCommandSystem(queue, structures, ['warden'], refinements, units, tf),
      makeConstructionSystem(structures, queue),
    ]);
    return { state, queue, sys };
  }

  it('charges on a clock, and refuses to fire before it is ready', () => {
    const { state, queue, sys } = withIonCannon();
    runTick(state, sys);
    const charge = state.superweapons.get('player:ion_cannon');
    expect(charge, 'a standing superweapon registers a charge').toBeDefined();
    expect(charge!.ticksLeft).toBeGreaterThan(0);

    // A victim next to the target point.
    const victim = state.store.create({
      position: tileToWorldCenter({ tx: 20, ty: 20 }),
      ...unitComponents(units.find(u => u.id === 'infantry')!, 'enemy', tf.enemy, {}),
    });
    const hpBefore = state.store.get(victim)!.components.health!.hp;
    queue.push({ type: 'superweapon', structureId: 'ion_cannon', target: tileToWorldCenter({ tx: 20, ty: 20 }) });
    for (let t = 0; t < 80; t++) runTick(state, sys);
    expect(state.store.get(victim)?.components.health?.hp,
      'firing while charging must do nothing').toBe(hpBefore);
  });

  it('once charged it fires, kills in its radius, and resets the cooldown', () => {
    const { state, queue, sys } = withIonCannon();
    runTick(state, sys);
    state.superweapons.get('player:ion_cannon')!.ticksLeft = 0; // fast-forward the charge

    const victim = state.store.create({
      position: tileToWorldCenter({ tx: 20, ty: 20 }),
      ...unitComponents(units.find(u => u.id === 'infantry')!, 'enemy', tf.enemy, {}),
    });
    queue.push({ type: 'superweapon', structureId: 'ion_cannon', target: tileToWorldCenter({ tx: 20, ty: 20 }) });
    runTick(state, sys);
    // The cooldown resets immediately (so it cannot be double-fired).
    expect(state.superweapons.get('player:ion_cannon')!.ticksLeft).toBeGreaterThan(0);
    // The strike lands after its warning delay.
    for (let t = 0; t < 80; t++) runTick(state, sys);
    const v = state.store.get(victim);
    expect(v === undefined || (v.components.health?.hp ?? 0) <= 0, 'the target should be destroyed').toBe(true);
  });

  it('the charge is in stateHash (multiplayer/replay safety)', () => {
    const { state, sys } = withIonCannon();
    runTick(state, sys);
    const before = stateHash(state);
    state.superweapons.get('player:ion_cannon')!.ticksLeft -= 25;
    expect(stateHash(state), 'a charge change must move the hash').not.toBe(before);
  });

  it('losing the structure drops its charge', () => {
    const { state, sys } = withIonCannon();
    runTick(state, sys);
    expect(state.superweapons.get('player:ion_cannon')).toBeDefined();
    const cannon = [...state.store.all()].find(e => e.components.faction?.faction === 'ion_cannon')!;
    state.store.remove(cannon.id);
    runTick(state, sys);
    expect(state.superweapons.get('player:ion_cannon'),
      'a destroyed superweapon keeps no charge').toBeUndefined();
  });
});
