// ── FG-6 tests: faction modifiers + command-log save/replay equivalence ─────────
import { describe, it, expect } from 'vitest';
import { makeSimState, stateHash } from '../../src/sim/state.js';
import { seedFromMission } from '../../src/sim/seedMission.js';
import { loadMission } from '../../src/loaders/missions.js';
import { makeTeamFactions, FACTIONS, modCost, modHp, modSpeed } from '../../src/sim/factions.js';
import { makeCommandSystem } from '../../src/sim/systems/command.js';
import { makeCommandQueue, type CommandIntent } from '../../src/view/input.js';
import { makeMovementSystem } from '../../src/sim/systems/movement.js';
import { makeHarvestSystem } from '../../src/sim/systems/harvest.js';
import { makeProductionSystem } from '../../src/sim/systems/production.js';
import { orderSystems, runTick, type SimSystem } from '../../src/sim/loop.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import { loadUnits } from '../../src/loaders/units.js';
import { loadStructures } from '../../src/loaders/structures.js';
import { loadEconomyConstants } from '../../src/loaders/economyConstants.js';
import unitsData from '../../data/units.json' with { type: 'json' };
import structuresData from '../../data/structures.json' with { type: 'json' };
import economyData from '../../data/economyConstants.json' with { type: 'json' };
import skirmish from '../../data/missions/skirmish.json' with { type: 'json' };

const units = loadUnits(unitsData);
const structures = loadStructures(structuresData);
const economy = loadEconomyConstants(economyData);

describe('FG-6 — faction modifiers', () => {
  it('Emberhand units are cheaper, faster, and more fragile at every spawn site', () => {
    const ember = FACTIONS.emberhand;
    const inf = units.find(u => u.id === 'infantry')!;
    expect(modCost(inf.cost, ember)).toBe(80);   // 100 × 0.8
    expect(modHp(inf.hp, ember)).toBe(17);       // 20 × 0.85
    expect(modSpeed(inf.speed, ember)).toBe(14); // 12 × 1.15

    // Seeded units carry the mods: skirmish with an Emberhand player.
    const mission = loadMission(skirmish);
    const state = makeSimState({ seed: mission.map.seed, mapWidth: 32, mapHeight: 32 });
    seedFromMission(state, mission, { units, structures, economy }, makeTeamFactions('emberhand', 'concord'));
    const soldier = state.store.all().find(e => e.components.faction?.team === 'player' && e.components.faction?.faction === 'infantry')!;
    expect(soldier.components.health!.maxHp).toBe(17);
    expect(soldier.components.movement!.speed).toBe(14);
  });

  it('production charges the faction price', () => {
    const state = makeSimState({ seed: 31, mapWidth: 32, mapHeight: 32 });
    const queue = makeCommandQueue();
    const factions = makeTeamFactions('emberhand', 'concord');
    const systems = orderSystems([makeCommandSystem(queue, structures, ['warden', 'vane'], [], units), makeProductionSystem(units, factions)]);
    const bank = state.store.create({
      position: tileToWorldCenter({ tx: 6, ty: 8 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'refinery' },
      economy: { credits: 500, refineryStorage: 500, maxStorage: 2000 },
      production: { queue: [], progress: 0 },
      health: { hp: 1500, maxHp: 1500 },
    });
    state.store.create({
      position: tileToWorldCenter({ tx: 8, ty: 8 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'barracks' },
      production: { queue: [], progress: 0 },
      health: { hp: 800, maxHp: 800 },
    });
    queue.push({ type: 'train', unitId: 'infantry' });
    runTick(state, systems);
    expect(state.store.get(bank)!.components.economy!.credits).toBe(420); // 500 − 80 (not −100)
  });
});

describe('FG-6 — save = command log (replay equivalence)', () => {
  it('a live-pushed match and a log-replayed match reach the identical stateHash', () => {
    const mission = loadMission(skirmish);
    const mkRig = () => {
      const state = makeSimState({ seed: mission.map.seed, mapWidth: mission.map.width, mapHeight: mission.map.height });
      seedFromMission(state, mission, { units, structures, economy });
      const queue = makeCommandQueue();
      const systems: SimSystem[] = orderSystems([
        makeCommandSystem(queue, structures, ['warden', 'vane'], [], units), makeMovementSystem(), makeHarvestSystem(economy), makeProductionSystem(units),
      ]);
      return { state, queue, systems };
    };
    // Rig A: play "live", recording the log exactly as main.ts does.
    const a = mkRig();
    const log: { t: number; i: CommandIntent }[] = [];
    const push = (i: CommandIntent) => { log.push({ t: a.state.tick, i }); a.queue.push(i); };
    for (let t = 0; t < 200; t++) {
      if (t === 5) push({ type: 'select', worldRect: { minWx: 0, minWy: 0, maxWx: 100000, maxWy: 100000 } });
      if (t === 10) push({ type: 'order', target: tileToWorldCenter({ tx: 20, ty: 20 }), tile: { tx: 20, ty: 20 } });
      if (t === 80) push({ type: 'train', unitId: 'infantry' });
      runTick(a.state, a.systems);
    }
    // Rig B: fast-forward from the log alone (the CONTINUE path).
    const b = mkRig();
    let li = 0;
    for (let t = 0; t < 200; t++) {
      while (li < log.length && log[li]!.t === t) { b.queue.push(log[li]!.i); li++; }
      runTick(b.state, b.systems);
    }
    expect(stateHash(b.state)).toBe(stateHash(a.state));
  });
});
