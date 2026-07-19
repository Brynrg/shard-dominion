// ── XP-1 tech tiers: HQ upgrades gate T2 structures + units ─────────────────────
import { describe, it, expect, beforeEach } from 'vitest';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { orderSystems, runTick } from '../../src/sim/loop.js';
import { makeCommandSystem } from '../../src/sim/systems/command.js';
import { makeConstructionSystem } from '../../src/sim/systems/construction.js';
import { makeProductionSystem } from '../../src/sim/systems/production.js';
import { makeCommandQueue } from '../../src/view/input.js';
import { teamTier } from '../../src/sim/tech.js';
import { loadStructures } from '../../src/loaders/structures.js';
import { loadUnits } from '../../src/loaders/units.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import structuresData from '../../data/structures.json' with { type: 'json' };
import unitsData from '../../data/units.json' with { type: 'json' };

const structures = loadStructures(structuresData);
const units = loadUnits(unitsData);

function seedBase(state: SimState, credits: number, tier = 1) {
  state.store.create({
    position: tileToWorldCenter({ tx: 10, ty: 10 }),
    building: { onSlab: true, buildProgress: 100, powered: true },
    faction: { team: 'player', faction: 'construction_yard' },
    construction: { queue: [], progress: 0, currentStructureId: null },
    tech: { tier, upgradingTo: null, ticksLeft: 0 },
    health: { hp: 2000, maxHp: 2000 },
  });
  state.store.create({
    position: tileToWorldCenter({ tx: 12, ty: 10 }),
    building: { onSlab: true, buildProgress: 100, powered: true },
    faction: { team: 'player', faction: 'refinery' },
    economy: { credits, refineryStorage: credits, maxStorage: 5000 },
    health: { hp: 1500, maxHp: 1500 },
  });
}

describe('XP-1 — HQ tech tiers', () => {
  let state: SimState;
  beforeEach(() => { state = makeSimState({ seed: 3, mapWidth: 32, mapHeight: 32 }); });

  it('upgrade-hq charges the bank and reaches T2 after the build time', () => {
    seedBase(state, 2000);
    const queue = makeCommandQueue();
    const systems = orderSystems([makeCommandSystem(queue, structures), makeConstructionSystem(structures, queue)]);
    queue.push({ type: 'upgrade-hq' });
    runTick(state, systems);
    const bank = state.store.all().find(e => e.components.economy)!.components.economy!;
    expect(bank.credits).toBe(1000); // charged the T2 step
    expect(teamTier(state, 'player')).toBe(1); // still upgrading
    for (let i = 0; i < 601; i++) runTick(state, systems); // 30s at 20Hz
    expect(teamTier(state, 'player')).toBe(2);
  });

  it('upgrade-hq is rejected when unaffordable (no charge, no progress)', () => {
    seedBase(state, 500);
    const queue = makeCommandQueue();
    const systems = orderSystems([makeCommandSystem(queue, structures), makeConstructionSystem(structures, queue)]);
    queue.push({ type: 'upgrade-hq' });
    runTick(state, systems);
    const bank = state.store.all().find(e => e.components.economy)!.components.economy!;
    expect(bank.credits).toBe(500);
    expect(teamTier(state, 'player')).toBe(1);
  });

  it('placing a T2 structure (war_factory) is blocked at T1 and allowed at T2', () => {
    seedBase(state, 5000);
    const queue = makeCommandQueue();
    const systems = orderSystems([makeCommandSystem(queue, structures), makeConstructionSystem(structures, queue)]);
    const count = () => state.store.all().filter(e => e.components.faction?.faction === 'war_factory').length;
    // RA build flow (v0.55): the sidebar job serves the build time; tests
    // fast-forward it, then place the READY structure.
    queue.push({ type: 'build-structure', structureId: 'war_factory' });
    runTick(state, systems);
    { const j = state.structureBuild.get('player'); if (j) j.ticksLeft = 0; }
    queue.push({ type: 'place-structure', structureId: 'war_factory', tile: { tx: 14, ty: 10 } });
    runTick(state, systems);
    expect(count()).toBe(0); // T1 → rejected, nothing spawned
    const bank = state.store.all().find(e => e.components.economy)!.components.economy!;
    expect(bank.credits).toBe(5000); // and nothing charged
    // Raise the tier directly, then place again.
    const yard = state.store.all().find(e => e.components.tech)!;
    yard.components.tech = { tier: 2, upgradingTo: null, ticksLeft: 0 };
    // RA build flow (v0.55): the sidebar job serves the build time; tests
    // fast-forward it, then place the READY structure.
    queue.push({ type: 'build-structure', structureId: 'war_factory' });
    runTick(state, systems);
    { const j = state.structureBuild.get('player'); if (j) j.ticksLeft = 0; }
    queue.push({ type: 'place-structure', structureId: 'war_factory', tile: { tx: 14, ty: 10 } });
    runTick(state, systems);
    expect(count()).toBe(1);
  });

  it('production drops a T2 unit queued while the team is only T1', () => {
    seedBase(state, 5000);
    // A war factory the mission seeded despite T1 (e.g. bad data) — its T2 job must not run.
    state.store.create({
      position: tileToWorldCenter({ tx: 14, ty: 10 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'war_factory' },
      production: { queue: ['scout_vehicle'], progress: 0 },
      health: { hp: 1300, maxHp: 1300 },
    });
    const systems = orderSystems([makeProductionSystem(units)]);
    for (let i = 0; i < 30; i++) runTick(state, systems);
    expect(state.store.all().some(e => e.components.faction?.faction === 'scout_vehicle')).toBe(false);
    const bank = state.store.all().find(e => e.components.economy)!.components.economy!;
    expect(bank.credits).toBe(5000); // never charged
  });

  it('a side without a ConYard anchors its tier on the seeded techTier', () => {
    // Simulates a mission enemy with a War Factory but no yard (tier anchor rule).
    state.store.create({
      position: tileToWorldCenter({ tx: 20, ty: 20 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'enemy', faction: 'war_factory' },
      tech: { tier: 2, upgradingTo: null, ticksLeft: 0 },
      production: { queue: [], progress: 0 },
      health: { hp: 1300, maxHp: 1300 },
    });
    expect(teamTier(state, 'enemy')).toBe(2);
  });
});
