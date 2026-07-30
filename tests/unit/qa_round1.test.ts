// ── QA round-1 regression tests (play-test report 2026-07-09) ───────────────────
// BUG-3: harvester-loss soft-lock → emergency salvage trickle.
// BUG-5: AI opened Assault in the first minute → difficulty grace period.
import { describe, it, expect, beforeEach } from 'vitest';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { makeHarvestSystem } from '../../src/sim/systems/harvest.js';
import { makeAiSystem } from '../../src/sim/systems/ai.js';
import { loadEconomyConstants } from '../../src/loaders/economyConstants.js';
import { loadUnits } from '../../src/loaders/units.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import economyData from '../../data/economyConstants.json' with { type: 'json' };
import unitsData from '../../data/units.json' with { type: 'json' };

const economy = loadEconomyConstants(economyData);
const units = loadUnits(unitsData);

function addRefinery(state: SimState, team: 'player' | 'enemy', credits: number, tx = 8, ty = 8) {
  return state.store.create({
    position: tileToWorldCenter({ tx, ty }),
    building: { onSlab: true, buildProgress: 100, powered: true },
    faction: { team, faction: 'refinery' },
    economy: { credits, refineryStorage: credits, maxStorage: 2000 },
    production: { queue: [], progress: 0 },
    health: { hp: 1500, maxHp: 1500 },
  });
}
function addHarvester(state: SimState, team: 'player' | 'enemy', tx = 9, ty = 8) {
  return state.store.create({
    position: tileToWorldCenter({ tx, ty }),
    movement: { target: null, path: [], speed: 10 },
    faction: { team, faction: 'harvester' },
    health: { hp: 200, maxHp: 200 },
    harvest: { state: 'SEEK', targetTile: null, targetRefinery: null, cargo: 0 },
  });
}
function addSoldier(state: SimState, team: 'player' | 'enemy', tx: number, ty: number) {
  return state.store.create({
    position: tileToWorldCenter({ tx, ty }),
    health: { hp: 20, maxHp: 20 },
    movement: { target: null, path: [], speed: 12 },
    combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
    faction: { team, faction: 'infantry' },
  });
}

describe('BUG-3 — emergency salvage trickle', () => {
  let state: SimState;
  beforeEach(() => { state = makeSimState({ seed: 7, mapWidth: 32, mapHeight: 32 }); });

  it('a side with a refinery and NO harvesters trickles credits (soft-lock recovery)', () => {
    const r = addRefinery(state, 'player', 230); // QA's stuck value
    const sys = makeHarvestSystem(economy);
    for (let i = 0; i < 20; i++) sys.run(state); // 1 second
    const credits = state.store.get(r)!.components.economy!.credits;
    expect(credits).toBeCloseTo(230 + economy.salvageRatePerSec, 1);
  });

  it('the trickle stops at the cap (comeback mechanic, not AFK income)', () => {
    const r = addRefinery(state, 'player', economy.salvageTrickleCap - 1);
    const sys = makeHarvestSystem(economy);
    for (let i = 0; i < 200; i++) sys.run(state);
    expect(state.store.get(r)!.components.economy!.credits).toBe(economy.salvageTrickleCap);
  });

  it('no trickle while a living harvester exists', () => {
    const r = addRefinery(state, 'player', 230);
    addHarvester(state, 'player');
    const sys = makeHarvestSystem(economy);
    for (let i = 0; i < 40; i++) sys.run(state);
    expect(state.store.get(r)!.components.economy!.credits).toBe(230);
  });

  it('a dead (hp 0) harvester does not block the trickle', () => {
    const r = addRefinery(state, 'player', 100);
    const h = addHarvester(state, 'player');
    state.store.get(h)!.components.health!.hp = 0;
    const sys = makeHarvestSystem(economy);
    for (let i = 0; i < 20; i++) sys.run(state);
    expect(state.store.get(r)!.components.economy!.credits).toBeGreaterThan(100);
  });
});

describe('BUG-5 — AI difficulty grace period', () => {
  let state: SimState;
  beforeEach(() => { state = makeSimState({ seed: 7, mapWidth: 32, mapHeight: 32 }); });

  function fundedWarband(graceTicks: number) {
    // Enemy base in the far corner: refinery + harvester + a big standing army
    // (over any assault threshold). Player base FAR away so 'enemyNearBase' is false.
    addRefinery(state, 'enemy', 2000, 26, 26);
    addHarvester(state, 'enemy', 27, 26);
    for (let i = 0; i < 8; i++) addSoldier(state, 'enemy', 24 + (i % 4), 24 + Math.floor(i / 4));
    // Player: a refinery + one soldier in the opposite corner.
    addRefinery(state, 'player', 500, 4, 4);
    addSoldier(state, 'player', 4, 5);
    return makeAiSystem(units, { team: 'enemy', attackTile: { tx: 4, ty: 4 }, evalInterval: 1, assaultValue: 300, graceTicks });
  }

  it('inside the grace window the AI does not go aggressive despite a huge army', () => {
    const ai = fundedWarband(1000);
    for (let i = 0; i < 50; i++) { ai.run(state); state.tick = (state.tick + 1) as typeof state.tick; }
    expect(['Develop', 'Expand', 'Stabilize', 'Recover']).toContain(ai.debugState());
  });

  it('after the grace window the same board goes aggressive', () => {
    const ai = fundedWarband(10);
    // The AI now attacks in WAVES with a lull between them, so sampling one arbitrary
    // tick can legitimately land in the rest phase. Assert it went aggressive at all.
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) { ai.run(state); seen.add(ai.debugState()); state.tick = (state.tick + 1) as typeof state.tick; }
    const wentAggressive = ['Assault', 'Pressure', 'Raid'].some(p => seen.has(p));
    expect(wentAggressive, `plans seen after grace: ${[...seen].join(',')}`).toBe(true);
  });
});
