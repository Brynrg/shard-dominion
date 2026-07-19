// ── TP-2 (v0.42): one team economy — the audit's exact failure scenarios ────────
import { describe, it, expect } from 'vitest';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { orderSystems, runTick } from '../../src/sim/loop.js';
import { makeCommandSystem } from '../../src/sim/systems/command.js';
import { makeHarvestSystem } from '../../src/sim/systems/harvest.js';
import { makePlanetEventSystem } from '../../src/sim/systems/planetEvent.js';
import { structureComponents } from '../../src/sim/factory.js';
import { teamCredits, spendCredits, grantCredits } from '../../src/sim/ledger.js';
import { makeCommandQueue } from '../../src/view/input.js';
import { loadStructures } from '../../src/loaders/structures.js';
import { loadUnits } from '../../src/loaders/units.js';
import { loadEconomyConstants } from '../../src/loaders/economyConstants.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import structuresData from '../../data/structures.json' with { type: 'json' };
import unitsData from '../../data/units.json' with { type: 'json' };
import economyData from '../../data/economyConstants.json' with { type: 'json' };

const structures = loadStructures(structuresData);
const units = loadUnits(unitsData);
const economy = loadEconomyConstants(economyData);

function refinery(state: SimState, team: 'player' | 'enemy', tx: number, ty: number, credits: number) {
  return state.store.create({
    position: tileToWorldCenter({ tx, ty }),
    ...structureComponents('refinery', team, structures, { credits, refineryMaxStorage: 2000 }),
  });
}

describe('TP-2 — split banks are ONE wallet', () => {
  it('a 550 build succeeds when 300+300 sits across two refineries (the HUD-said-yes bug)', () => {
    const state = makeSimState({ seed: 2, mapWidth: 32, mapHeight: 32 });
    state.store.create({ position: tileToWorldCenter({ tx: 8, ty: 8 }), ...structureComponents('construction_yard', 'player', structures) });
    refinery(state, 'player', 10, 8, 300);
    refinery(state, 'player', 12, 8, 300);
    expect(teamCredits(state, 'player')).toBe(600);
    const queue = makeCommandQueue();
    const sys = orderSystems([makeCommandSystem(queue, structures)]);
    // RA build flow (v0.55): the sidebar job serves the build time; tests
    // fast-forward it, then place the READY structure.
    queue.push({ type: 'build-structure', structureId: 'defense_turret' });
    runTick(state, sys);
    { const j = state.structureBuild.get('player'); if (j) j.ticksLeft = 0; }
    queue.push({ type: 'place-structure', structureId: 'defense_turret', tile: { tx: 9, ty: 11 } });
    runTick(state, sys);
    expect(state.store.all().some(e => e.components.faction?.faction === 'defense_turret')).toBe(true);
    expect(teamCredits(state, 'player')).toBe(50); // 600 − 550, drained across banks
  });

  it('spendCredits refuses without total funds and drains deterministically', () => {
    const state = makeSimState({ seed: 2, mapWidth: 32, mapHeight: 32 });
    refinery(state, 'player', 10, 8, 100);
    refinery(state, 'player', 12, 8, 100);
    expect(spendCredits(state, 'player', 300)).toBe(false);
    expect(teamCredits(state, 'player')).toBe(200); // untouched on refusal
    expect(spendCredits(state, 'player', 150)).toBe(true);
    expect(teamCredits(state, 'player')).toBe(50);
  });
});

describe('TP-2 — docking is team-loyal', () => {
  it('a player harvester never docks at the closer ENEMY refinery', () => {
    const state = makeSimState({ seed: 2, mapWidth: 32, mapHeight: 32 });
    const foeRef = refinery(state, 'enemy', 12, 10, 0);
    const ownRef = refinery(state, 'player', 22, 10, 0);
    const h = state.store.create({
      position: tileToWorldCenter({ tx: 11, ty: 10 }), // right beside the enemy dock
      movement: { target: null, path: [], speed: 10 },
      faction: { team: 'player', faction: 'harvester' },
      health: { hp: 200, maxHp: 200 },
      harvest: { state: 'RETURN', targetTile: null, targetRefinery: null, cargo: 300 },
    });
    const sys = orderSystems([makeHarvestSystem(economy)]);
    runTick(state, sys);
    const target = state.store.get(h)!.components.harvest!.targetRefinery;
    expect(target).toBe(ownRef);
    expect(target).not.toBe(foeRef);
  });
});

describe('TP-2 — relays stay relays', () => {
  it('a captured relay keeps its kind and pays CELLS on the relay clock', () => {
    const state = makeSimState({ seed: 2, mapWidth: 32, mapHeight: 32 });
    refinery(state, 'player', 8, 8, 500);
    const relay = state.store.create({
      position: tileToWorldCenter({ tx: 12, ty: 12 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'neutral', faction: 'relay' },
      health: { hp: 1000, maxHp: 1000 },
    });
    // A lone soldier beside it for the 5s capture…
    state.store.create({
      position: tileToWorldCenter({ tx: 12, ty: 13 }),
      movement: { target: null, path: [], speed: 12 },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
      faction: { team: 'player', faction: 'infantry' },
      health: { hp: 20, maxHp: 20 },
    });
    const sys = orderSystems([makePlanetEventSystem(units)]);
    for (let i = 0; i < 110; i++) runTick(state, sys); // capture at 100
    const f = state.store.get(relay)!.components.faction!;
    expect(f.team).toBe('player');
    expect(f.faction).toBe('relay'); // NOT rewritten to 'derrick'
    // Hold 20 more seconds → +1 Cell, and NO derrick credit drip.
    const creditsBefore = teamCredits(state, 'player');
    for (let i = 0; i < 20 * 20 + 5; i++) runTick(state, sys);
    const bank = state.store.all().find(e => e.components.faction?.team === 'player' && e.components.economy)!.components.economy!;
    expect(bank.cells ?? 0).toBe(1);
    expect(teamCredits(state, 'player')).toBe(creditsBefore); // relays never pay credits
  });
});

describe('TP-2 — the softlock trio', () => {
  it('scripted grants BYPASS the storage cap (the M14 HARNESS fix)', () => {
    const state = makeSimState({ seed: 2, mapWidth: 32, mapHeight: 32 });
    refinery(state, 'player', 8, 8, 2000); // exactly at cap
    grantCredits(state, 'player', 800, true);
    expect(teamCredits(state, 'player')).toBe(2800);
  });

  it('after losing every refinery, the ConYard reserve banks the trickle (rebuild path)', () => {
    const state = makeSimState({ seed: 2, mapWidth: 32, mapHeight: 32 });
    state.store.create({ position: tileToWorldCenter({ tx: 8, ty: 8 }), ...structureComponents('construction_yard', 'player', structures) });
    // No refinery, no harvester → the emergency trickle must land in the reserve.
    const sys = orderSystems([makeHarvestSystem(economy)]);
    for (let i = 0; i < 200; i++) runTick(state, sys);
    expect(teamCredits(state, 'player')).toBeGreaterThan(0);
  });
});
