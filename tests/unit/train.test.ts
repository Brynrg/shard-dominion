// ── Train intent tests: player queues units from barracks ────────────────────────
import { describe, it, expect, beforeEach } from 'vitest';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { makeCommandSystem } from '../../src/sim/systems/command.js';
import { makeProductionSystem } from '../../src/sim/systems/production.js';
import { orderSystems, runTick, type SimSystem } from '../../src/sim/loop.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import { makeCommandQueue, type CommandIntent } from '../../src/view/input.js';
import { loadUnits } from '../../src/loaders/units.js';
import unitsData from '../../data/units.json' with { type: 'json' };

const units = loadUnits(unitsData);

describe('train intent', () => {
  let state: SimState;
  let systems: readonly SimSystem[];
  let queue: { drain(): CommandIntent[]; push(intent: CommandIntent): void };
  let commandSystem: ReturnType<typeof makeCommandSystem>;

  beforeEach(() => {
    state = makeSimState({ seed: 42, mapWidth: 32, mapHeight: 32 });
    queue = makeCommandQueue();
    commandSystem = makeCommandSystem(queue, []);
    systems = orderSystems([commandSystem, makeProductionSystem(units)]);
  });

  function addBarracks(tx: number, ty: number) {
    const barracksPos = tileToWorldCenter({ tx, ty });
    state.store.create({
      position: barracksPos,
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'barracks' },
      production: { queue: [], progress: 0 },
      health: { hp: 800, maxHp: 800 },
      armor: { armorClass: 'BUILDING' },
    });
  }

  function addRefinery(tx: number, ty: number, credits: number) {
    const refineryPos = tileToWorldCenter({ tx, ty });
    state.store.create({
      position: refineryPos,
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'refinery' },
      economy: { credits, refineryStorage: credits, maxStorage: 2000 },
      // The Refinery is the Harvester producer (C&C-accurate: up from turn one).
      production: { queue: [], progress: 0 },
      health: { hp: 1500, maxHp: 1500 },
      armor: { armorClass: 'BUILDING' },
    });
  }

  it('train intent queues into the barracks', () => {
    addRefinery(5, 5, 500);
    addBarracks(5, 6);

    // Push a train intent for infantry
    queue.push({ type: 'train', unitId: 'infantry' });

    // Run tick to process the intent
    runTick(state, systems);

    // The train intent reached the barracks: production starts it the SAME tick
    // (draining the queue into the active build), so the barracks is now either
    // queued OR building infantry — not idle.
    const barracks = state.store.all().find(e =>
      e.components.faction?.faction === 'barracks' && e.components.production);
    const prod = barracks?.components.production;
    expect((prod?.queue.length ?? 0) > 0 || (prod?.progress ?? 0) > 0).toBe(true);
  });

  it('train Harvester routes to the Refinery, not the Barracks', () => {
    addRefinery(5, 5, 800);
    addBarracks(5, 6);

    queue.push({ type: 'train', unitId: 'harvester' });
    runTick(state, systems); // command queues it, production may start it same tick

    const refinery = state.store.all().find(e => e.components.faction?.faction === 'refinery');
    const barracks = state.store.all().find(e => e.components.faction?.faction === 'barracks');
    const refProd = refinery?.components.production;
    // Refinery is building (queued OR started same tick); Barracks stays idle.
    expect((refProd?.queue.length ?? 0) > 0 || (refProd?.current === 'harvester')).toBe(true);
    expect(barracks?.components.production?.queue.length ?? 0).toBe(0);
    expect(barracks?.components.production?.current ?? null).toBe(null);
  });

  it('train infantry spawns after build time (~65 ticks) and credits drop 100', () => {
    addRefinery(5, 5, 500);
    addBarracks(5, 6);

    // Push a train intent for infantry
    queue.push({ type: 'train', unitId: 'infantry' });

    // Run tick to queue the unit
    runTick(state, systems);

    // Credits should drop by 100 (infantry cost)
    const refinery = state.store.all().find(e => e.components.economy);
    expect(refinery?.components.economy?.credits).toBe(400);

    // Run ~65 ticks for the build to complete
    for (let i = 0; i < 65; i++) {
      runTick(state, systems);
    }

    // Verify infantry spawned
    const infantry = state.store.all().find(e =>
      e.components.faction?.faction === 'infantry' && e.components.faction?.team === 'player');
    expect(infantry).toBeDefined();
    expect(infantry?.components.health?.hp).toBe(20);
  });

  it('two train intents create two units eventually', () => {
    addRefinery(5, 5, 1000); // Enough for 2 infantry
    addBarracks(5, 6);

    // Push two train intents
    queue.push({ type: 'train', unitId: 'infantry' });
    queue.push({ type: 'train', unitId: 'infantry' });

    // Run tick to queue both units (production starts the first the same tick, so
    // one is building + one still queued).
    runTick(state, systems);

    // First build started → 100 spent (1000 → 900).
    const refinery = state.store.all().find(e => e.components.economy);
    expect(refinery?.components.economy?.credits).toBe(900);

    // Run ~65 ticks for first infantry to complete
    for (let i = 0; i < 65; i++) {
      runTick(state, systems);
    }

    // First infantry should exist
    const infantry1 = state.store.all().find(e =>
      e.components.faction?.faction === 'infantry' && e.components.faction?.team === 'player');
    expect(infantry1).toBeDefined();

    // Second infantry hasn't started yet (credits only cover one)
    const infantryCount = state.store.all().filter(e =>
      e.components.faction?.faction === 'infantry' && e.components.faction?.team === 'player').length;
    expect(infantryCount).toBe(1);

    // Run another ~65 ticks for second infantry to complete
    for (let i = 0; i < 65; i++) {
      runTick(state, systems);
    }

    // Second infantry should exist
    const infantry2 = state.store.all().find(e =>
      e.components.faction?.faction === 'infantry' && e.components.faction?.team === 'player' && e.id !== infantry1?.id);
    expect(infantry2).toBeDefined();
  });

  it('train intent with no barracks present does nothing (no crash)', () => {
    addRefinery(5, 5, 500);
    // No barracks added

    // Push a train intent for infantry
    queue.push({ type: 'train', unitId: 'infantry' });

    // Run tick - should not crash
    expect(() => runTick(state, systems)).not.toThrow();

    // Verify no infantry spawned
    const infantry = state.store.all().find(e =>
      e.components.faction?.faction === 'infantry');
    expect(infantry).toBeUndefined();
  });

  it('train rocket_trooper works (cost 200)', () => {
    addRefinery(5, 5, 500);
    addBarracks(5, 6);

    // Push a train intent for rocket trooper
    queue.push({ type: 'train', unitId: 'rocket_trooper' });

    // Run tick to queue the unit
    runTick(state, systems);

    // Credits should drop by 200 (rocket_trooper cost)
    const refinery = state.store.all().find(e => e.components.economy);
    expect(refinery?.components.economy?.credits).toBe(300);

    // Rocket trooper builds in 4s = 80 ticks — run 90 for margin.
    for (let i = 0; i < 90; i++) {
      runTick(state, systems);
    }

    // Verify rocket trooper spawned
    const rocketTrooper = state.store.all().find(e =>
      e.components.faction?.faction === 'rocket_trooper' && e.components.faction?.team === 'player');
    expect(rocketTrooper).toBeDefined();
    expect(rocketTrooper?.components.health?.hp).toBe(20);
    expect(rocketTrooper?.components.combat?.weaponId).toBe('inf_rocket');
  });

  it('train a Harvester (450) — spawns with a harvest FSM, not combat', () => {
    addRefinery(5, 5, 800);
    addBarracks(5, 6);

    queue.push({ type: 'train', unitId: 'harvester' });
    runTick(state, systems);
    // 450 charged (800 → 350)
    expect(state.store.all().find(e => e.components.economy)?.components.economy?.credits).toBe(350);

    // Harvester builds in 12s = 240 ticks — run 250 for margin.
    for (let i = 0; i < 250; i++) runTick(state, systems);

    const harv = state.store.all().find(e =>
      e.components.faction?.faction === 'harvester' && e.components.faction?.team === 'player');
    expect(harv).toBeDefined();
    expect(harv?.components.harvest?.state).toBe('SEEK'); // auto-mines
    expect(harv?.components.combat).toBeUndefined();      // not a fighter
  });
});
