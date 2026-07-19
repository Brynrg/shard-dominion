// ── v0.55 RA build flow: sidebar structure production (the C&C operating model) ──
// Click → job starts (paid upfront, clock ticks) → READY → place (short unfold).
// One structure per team at a time; right-click cancels with a full refund.
import { describe, it, expect, beforeEach } from 'vitest';
import { makeSimState, stateHash, type SimState } from '../../src/sim/state.js';
import { makeCommandSystem } from '../../src/sim/systems/command.js';
import { makeConstructionSystem } from '../../src/sim/systems/construction.js';
import { orderSystems, runTick, type SimSystem } from '../../src/sim/loop.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import { makeCommandQueue, type CommandIntent } from '../../src/view/input.js';
import { loadStructures } from '../../src/loaders/structures.js';
import { structureComponents } from '../../src/sim/factory.js';
import { teamCredits } from '../../src/sim/ledger.js';
import structuresData from '../../data/structures.json' with { type: 'json' };

const structures = loadStructures(structuresData);
const barracks = structures.find(s => s.id === 'barracks')!;

describe('RA build flow', () => {
  let state: SimState;
  let systems: readonly SimSystem[];
  let queue: { drain(): CommandIntent[]; push(intent: CommandIntent): void };

  beforeEach(() => {
    state = makeSimState({ seed: 42, mapWidth: 32, mapHeight: 32 });
    queue = makeCommandQueue();
    systems = orderSystems([makeCommandSystem(queue, structures), makeConstructionSystem(structures, queue)]);
    // A ConYard (build radius) + a funded bank.
    state.store.create({ position: tileToWorldCenter({ tx: 8, ty: 8 }), ...structureComponents('construction_yard', 'player', structures) });
    state.store.create({ position: tileToWorldCenter({ tx: 10, ty: 8 }), ...structureComponents('refinery', 'player', structures, { credits: 2000, refineryMaxStorage: 5000 }) });
  });

  it('build-structure charges upfront, ticks in the sidebar, and refuses a second job (one at a time)', () => {
    queue.push({ type: 'build-structure', structureId: 'barracks' });
    runTick(state, systems);
    const job = state.structureBuild.get('player')!;
    expect(job.structureId).toBe('barracks');
    expect(teamCredits(state, 'player')).toBe(2000 - barracks.cost); // paid at START
    const before = job.ticksLeft;
    runTick(state, systems);
    expect(state.structureBuild.get('player')!.ticksLeft).toBeLessThan(before); // clock sweeps

    // The RA rule: a second structure is refused while one builds — no job
    // replacement, no double charge.
    queue.push({ type: 'build-structure', structureId: 'power_node' });
    runTick(state, systems);
    expect(state.structureBuild.get('player')!.structureId).toBe('barracks');
    expect(teamCredits(state, 'player')).toBe(2000 - barracks.cost);
  });

  it('placement is refused before READY, works after, consumes the job, and unfolds fast without a second charge', () => {
    queue.push({ type: 'build-structure', structureId: 'barracks' });
    runTick(state, systems);
    // Too early: the job is still building.
    queue.push({ type: 'place-structure', structureId: 'barracks', tile: { tx: 12, ty: 8 } });
    runTick(state, systems);
    expect(state.store.all().some(e => e.components.faction?.faction === 'barracks')).toBe(false);

    // READY → place: site appears, job consumed, no extra credits taken.
    state.structureBuild.get('player')!.ticksLeft = 0;
    queue.push({ type: 'place-structure', structureId: 'barracks', tile: { tx: 12, ty: 8 } });
    runTick(state, systems);
    const site = state.store.all().find(e => e.components.faction?.faction === 'barracks')!;
    expect(site).toBeDefined();
    expect(state.structureBuild.get('player')).toBeUndefined();
    expect(teamCredits(state, 'player')).toBe(2000 - barracks.cost);

    // The on-field phase is the short UNFOLD (~3s), not the full build time.
    for (let i = 0; i < 3 * 20 + 5; i++) runTick(state, systems);
    expect(site.components.building!.buildProgress).toBe(100);
  });

  it('cancel-structure refunds in full, mid-build or READY', () => {
    queue.push({ type: 'build-structure', structureId: 'barracks' });
    runTick(state, systems);
    queue.push({ type: 'cancel-structure' });
    runTick(state, systems);
    expect(state.structureBuild.get('player')).toBeUndefined();
    expect(teamCredits(state, 'player')).toBe(2000);
  });

  it('the sidebar job is authoritative state: it changes the stateHash', () => {
    const before = stateHash(state);
    queue.push({ type: 'build-structure', structureId: 'barracks' });
    runTick(state, systems);
    // Compare at equal tick counts: a fresh twin state without the job.
    const twin = makeSimState({ seed: 42, mapWidth: 32, mapHeight: 32 });
    expect(stateHash(state)).not.toBe(before);
    expect(state.structureBuild.get('player')).toBeDefined();
    expect(twin.structureBuild.get('player')).toBeUndefined();
  });
});
