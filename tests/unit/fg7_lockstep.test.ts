// ── FG-7 lockstep tests: two seats, in-memory pipe, identical simulations ───────
import { describe, it, expect } from 'vitest';
import { makeLockstep, INPUT_DELAY_TICKS, type Transport } from '../../src/net/lockstep.js';
import { makeSimState, stateHash, type SimState } from '../../src/sim/state.js';
import { seedFromMission } from '../../src/sim/seedMission.js';
import { loadMission } from '../../src/loaders/missions.js';
import { makeCommandSystem } from '../../src/sim/systems/command.js';
import { makeCommandQueue, type CommandIntent } from '../../src/view/input.js';
import { makeMovementSystem } from '../../src/sim/systems/movement.js';
import { makeHarvestSystem } from '../../src/sim/systems/harvest.js';
import { makeCombatTargetingSystem } from '../../src/sim/systems/combatTargeting.js';
import { makeDamageSystem } from '../../src/sim/systems/damage.js';
import { makeProductionSystem } from '../../src/sim/systems/production.js';
import { orderSystems, runTick, type SimSystem } from '../../src/sim/loop.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import { loadUnits } from '../../src/loaders/units.js';
import { loadStructures } from '../../src/loaders/structures.js';
import { loadWeapons } from '../../src/loaders/loader.js';
import { loadEconomyConstants } from '../../src/loaders/economyConstants.js';
import unitsData from '../../data/units.json' with { type: 'json' };
import structuresData from '../../data/structures.json' with { type: 'json' };
import weaponsData from '../../data/weapons.json' with { type: 'json' };
import economyData from '../../data/economyConstants.json' with { type: 'json' };
import skirmish from '../../data/missions/skirmish.json' with { type: 'json' };

const units = loadUnits(unitsData);
const structures = loadStructures(structuresData);
const weapons = loadWeapons(weaponsData);
const economy = loadEconomyConstants(economyData);

/** A synchronous in-memory duplex pipe between two transports. */
function makePipe(): [Transport, Transport] {
  const aCbs: ((m: string) => void)[] = [];
  const bCbs: ((m: string) => void)[] = [];
  const a: Transport = { send: (m) => { for (const cb of bCbs) cb(m); }, onMessage: (cb) => aCbs.push(cb) };
  const b: Transport = { send: (m) => { for (const cb of aCbs) cb(m); }, onMessage: (cb) => bCbs.push(cb) };
  return [a, b];
}

interface Seat { state: SimState; systems: SimSystem[]; raw: ReturnType<typeof makeCommandQueue>; ls: ReturnType<typeof makeLockstep> }

function makeSeat(seatNo: number, transport: Transport): Seat {
  const mission = loadMission(skirmish);
  const state = makeSimState({ seed: mission.map.seed, mapWidth: mission.map.width, mapHeight: mission.map.height });
  seedFromMission(state, mission, { units, structures, economy });
  const raw = makeCommandQueue();
  const systems = orderSystems([
    makeCommandSystem(raw, structures, ['warden', 'vane'], [], units), makeMovementSystem(), makeHarvestSystem(economy),
    makeCombatTargetingSystem(weapons), makeDamageSystem(weapons), makeProductionSystem(units),
  ]);
  return { state, systems, raw, ls: makeLockstep(seatNo, transport) };
}

/** Advance a seat by at most one tick, exactly as the renderer loop would. */
function step(seat: Seat): boolean {
  const t = seat.state.tick;
  if (!seat.ls.canRun(t)) return false;
  for (const i of seat.ls.takeDue(t)) seat.raw.push(i);
  runTick(seat.state, seat.systems);
  seat.ls.afterTick(t, stateHash(seat.state));
  return true;
}

describe('FG-7 — lockstep 1v1', () => {
  it('both seats issue orders; sims stay hash-identical for 300 ticks (uneven pacing)', () => {
    const [ta, tb] = makePipe();
    const A = makeSeat(0, ta); // team 'player'
    const B = makeSeat(1, tb); // team 'enemy'

    const orderA: CommandIntent = { type: 'order', target: tileToWorldCenter({ tx: 20, ty: 20 }), tile: { tx: 20, ty: 20 } };
    const orderB: CommandIntent = { type: 'order', target: tileToWorldCenter({ tx: 10, ty: 10 }), tile: { tx: 10, ty: 10 } };

    let issuedA = false, issuedB = false;
    // Deliberately UNEVEN pacing: A steps twice per loop, B once — lockstep must
    // hold the faster seat, never letting it run ahead of B's flushed bundles.
    for (let loop = 0; loop < 900 && (A.state.tick < 300 || B.state.tick < 300); loop++) {
      if (!issuedA && A.state.tick === 5) {
        A.ls.submit({ type: 'select', worldRect: { minWx: 0, minWy: 0, maxWx: 1e6, maxWy: 1e6 } }, A.state.tick);
        A.ls.submit(orderA, A.state.tick);
        issuedA = true;
      }
      if (!issuedB && B.state.tick === 9) {
        B.ls.submit({ type: 'select', worldRect: { minWx: 0, minWy: 0, maxWx: 1e6, maxWy: 1e6 } }, B.state.tick);
        B.ls.submit(orderB, B.state.tick);
        issuedB = true;
      }
      step(A); step(A);
      step(B);
    }
    expect(A.state.tick).toBeGreaterThanOrEqual(300);
    expect(B.state.tick).toBeGreaterThanOrEqual(300);
    // The faster seat can never exceed the peer by more than the input delay window.
    expect(Math.abs(A.state.tick - B.state.tick)).toBeLessThanOrEqual(INPUT_DELAY_TICKS + 1);
    expect(A.ls.status().desynced).toBe(false);
    expect(B.ls.status().desynced).toBe(false);
    // Roll B forward to A's tick and compare states EXACTLY.
    while (B.state.tick < A.state.tick) { if (!step(B)) break; }
    expect(B.state.tick).toBe(A.state.tick);
    expect(stateHash(B.state)).toBe(stateHash(A.state));
  });

  it("seat 1's intents act on the ENEMY team (its own units), not the player's", () => {
    const [ta, tb] = makePipe();
    const A = makeSeat(0, ta);
    const B = makeSeat(1, tb);
    // B selects everything and orders a move — only ENEMY units should move.
    B.ls.submit({ type: 'select', worldRect: { minWx: 0, minWy: 0, maxWx: 1e6, maxWy: 1e6 } }, 0);
    B.ls.submit({ type: 'order', target: tileToWorldCenter({ tx: 16, ty: 26 }), tile: { tx: 16, ty: 26 } }, 0);
    for (let loop = 0; loop < 40; loop++) { step(A); step(B); }
    // The skirmish enemy's only mobile unit is its HARVESTER: B's ground order
    // must suspend its FSM (IDLE) and move it; A's units must be untouched.
    const enemyHarv = A.state.store.all().find(e =>
      e.components.faction?.team === 'enemy' && e.components.faction?.faction === 'harvester')!;
    expect(enemyHarv.components.harvest!.state).toBe('IDLE');
    const playerOrdered = A.state.store.all().some(e =>
      e.components.faction?.team === 'player' && e.components.selection?.selected);
    expect(playerOrdered).toBe(false); // B's select-all touched only its OWN side
  });
});
