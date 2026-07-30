// ── M1 "First Light" tutorial gate (WC3-style staged build-up) ─────────────────
// The playtest complaint: M1 opened with a pre-built base already harvesting, so
// the player never learned the build flow or what buildings are for. M1 is now the
// WC3 pattern — start with a lone ConYard, and the build steps ARE the objectives,
// each unlocking the next Corr guidance message.
import { describe, it, expect } from 'vitest';
import { makeSimState } from '../../src/sim/state.js';
import { orderSystems, runTick, SIM_TICK_RATE } from '../../src/sim/loop.js';
import { makeCommandSystem } from '../../src/sim/systems/command.js';
import { makeConstructionSystem } from '../../src/sim/systems/construction.js';
import { makeProductionSystem } from '../../src/sim/systems/production.js';
import { makePowerSystem } from '../../src/sim/systems/power.js';
import { makeMovementSystem } from '../../src/sim/systems/movement.js';
import { makeHarvestSystem } from '../../src/sim/systems/harvest.js';
import { makeObjectivesSystem } from '../../src/sim/systems/objectives.js';
import { makeCommandQueue } from '../../src/view/input.js';
import { seedFromMission } from '../../src/sim/seedMission.js';
import { loadMission } from '../../src/loaders/missions.js';
import { makeTeamFactions } from '../../src/sim/factions.js';
import { loadUnits } from '../../src/loaders/units.js';
import { loadStructures } from '../../src/loaders/structures.js';
import { loadEconomyConstants } from '../../src/loaders/economyConstants.js';
import unitsData from '../../data/units.json' with { type: 'json' };
import structuresData from '../../data/structures.json' with { type: 'json' };
import economyData from '../../data/economyConstants.json' with { type: 'json' };
import m1Data from '../../data/missions/m1_first_light.json' with { type: 'json' };

const units = loadUnits(unitsData);
const structures = loadStructures(structuresData);
const economy = loadEconomyConstants(economyData);

describe('M1 First Light — the tutorial teaches by doing', () => {
  it('starts with ONLY a ConYard + squad (nothing pre-built, nothing harvesting)', () => {
    const mission = loadMission(m1Data);
    expect(mission.player.buildings.map(b => b.type)).toEqual(['construction_yard']);
    expect(mission.player.units.every(u => u.type === 'infantry')).toBe(true);
    // Enough credits for the full guided chain even with zero mining income:
    // power 400 + refinery 1200 + harvester 450 + barracks 300 = 2350.
    expect(mission.player.credits).toBeGreaterThanOrEqual(2350);
  });

  it('the build steps are primary objectives that complete as the player does them, then guidance fires', () => {
    const mission = loadMission(m1Data);
    const state = makeSimState({ seed: mission.map.seed, mapWidth: mission.map.width, mapHeight: mission.map.height });
    const tf = makeTeamFactions('concord', 'emberhand');
    seedFromMission(state, mission, { units, structures, economy }, tf);
    const queue = makeCommandQueue();
    const objectives = makeObjectivesSystem(mission.objectives, mission.failure, mission.triggers, units, tf, null);
    const sys = orderSystems([
      makeCommandSystem(queue, structures, ['warden'], [], units, tf),
      objectives,
      makeMovementSystem(), makeHarvestSystem(economy, tf),
      makeConstructionSystem(structures, queue),
      makeProductionSystem(units, tf), makePowerSystem(),
    ]);
    const objState = (id: string): boolean =>
      objectives.result.objectives.find(o => o.id === id)?.complete ?? false;
    const messages = (): string[] => objectives.messages.map(m => m.text);

    runTick(state, sys);
    expect(objState('obj_power')).toBe(false);
    // The opening guidance fires at 3s.
    for (let t = 0; t < 4 * SIM_TICK_RATE; t++) runTick(state, sys);
    expect(messages().join(' ')).toMatch(/Power first/);

    // Step 1: build + place a Power Node the way the player would.
    const place = (id: string, tx: number, ty: number): void => {
      queue.push({ type: 'build-structure', structureId: id });
      runTick(state, sys);
      const job = state.structureBuild.get('player');
      expect(job?.structureId, `job for ${id}`).toBe(id);
      job!.ticksLeft = 0; // tests fast-forward the sidebar clock
      queue.push({ type: 'place-structure', structureId: id, tile: { tx, ty } });
      runTick(state, sys);
      // Serve the on-field unfold so the objective's anyLiving sees it.
      for (let t = 0; t < 5 * SIM_TICK_RATE; t++) runTick(state, sys);
    };
    place('power_node', 11, 14);
    expect(objState('obj_power'), 'power objective ticks').toBe(true);
    for (let t = 0; t < SIM_TICK_RATE; t++) runTick(state, sys);
    expect(messages().join(' ')).toMatch(/Refinery/);

    // Step 2: Refinery.
    place('refinery', 17, 13);
    expect(objState('obj_refinery'), 'refinery objective ticks').toBe(true);
    for (let t = 0; t < SIM_TICK_RATE; t++) runTick(state, sys);
    expect(messages().join(' ')).toMatch(/Harvester/);

    // Step 3: train the Harvester at the refinery.
    queue.push({ type: 'train', unitId: 'harvester' });
    const harvTicks = Math.round(units.find(u => u.id === 'harvester')!.buildTimeSeconds * SIM_TICK_RATE) + 40;
    for (let t = 0; t < harvTicks; t++) runTick(state, sys);
    expect(objState('obj_harvester'), 'harvester objective ticks').toBe(true);

    // Step 4: Barracks → the "attack" guidance + the 300cr reward fire.
    // (11,23): inside the ConYard's build radius, clear of the seeded squad — the
    // 2x2 footprint at (11,19) overlapped the infantry standing at (12,19).
    place('barracks', 11, 23);
    expect(objState('obj_barracks'), 'barracks objective ticks').toBe(true);
    for (let t = 0; t < SIM_TICK_RATE; t++) runTick(state, sys);
    expect(messages().join(' ')).toMatch(/push north-east/);

    // The watch-post objective is still open → the mission is not yet won.
    expect(objectives.result.won).toBe(false);
  });
});
