// ── Production system unit tests ────────────────────────────────────────────────
// Tests: exact single deduction, spawn only after build time, pause on poor + resume, sequential queue
import { describe, it, expect, beforeEach } from 'vitest';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { makeProductionSystem } from '../../src/sim/systems/production.js';
import { orderSystems, runTick, type SimSystem } from '../../src/sim/loop.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import { asEntityId, type EntityId } from '../../src/sim/ids.js';
import { loadUnits } from '../../src/loaders/units.js';
import unitsData from '../../data/units.json' with { type: 'json' };

const units = loadUnits(unitsData);
// Build length comes from DATA, not a hardcoded 60: these tests assert the
// SEQUENCING of a job (pay once, spawn only at completion, queue in order), and
// must survive any retune of infantry's buildTimeSeconds.
const INFANTRY_TICKS = Math.max(1, Math.round(
  units.find(u => u.id === 'infantry')!.buildTimeSeconds * 20));

describe('production system', () => {
  let state: SimState;
  let systems: readonly SimSystem[];

  beforeEach(() => {
    state = makeSimState({ seed: 42, mapWidth: 32, mapHeight: 32 });
    systems = orderSystems([makeProductionSystem(units)]);
  });

  function addProducer(tx: number, ty: number, credits: number) {
    const producerPos = tileToWorldCenter({ tx, ty });
    const producerId = state.store.create({
      position: producerPos,
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'barracks' },
      production: { queue: ['infantry'], progress: 0 },
      economy: { credits, refineryStorage: 0, maxStorage: 2000 },
    });
    return asEntityId(producerId);
  }

  function addBank(producerId: EntityId, credits: number) {
    const producer = state.store.get(producerId);
    if (!producer || !producer.components.position) throw new Error('Producer not found');
    const bankPos = producer.components.position;
    const bankId = state.store.create({
      position: bankPos,
      faction: { team: 'player', faction: 'bank' },
      economy: { credits, refineryStorage: 0, maxStorage: 2000 },
    });
    return asEntityId(bankId);
  }

  it('starting a job deducts EXACTLY cost once (credits 500 -> 400 for infantry cost 100)', () => {
    const producerId = addProducer(5, 5, 500);
    addBank(producerId, 500);

    const initialCredits = state.store.get(producerId)?.components.economy?.credits || 0;
    expect(initialCredits).toBe(500);

    // Run one tick to start the job
    runTick(state, systems);

    // Credits should drop by exactly 100 (infantry cost)
    const afterStartCredits = state.store.get(producerId)?.components.economy?.credits || 0;
    expect(afterStartCredits).toBe(400);
  });

  it('no unit spawns before build time elapses (derived from data)', () => {
    const producerId = addProducer(5, 5, 500);
    addBank(producerId, 500);

    // The start tick counts as a build tick, so an N-tick build completes ON the
    // Nth runTick. Run N-1: still building.
    for (let i = 0; i < INFANTRY_TICKS - 1; i++) {
      runTick(state, systems);
    }

    // No new unit should exist yet - only producer + bank = 2 entities
    const allEntities = state.store.all();
    expect(allEntities.length).toBe(2);

    // The final tick completes the build
    runTick(state, systems);

    // Now exactly ONE infantry should exist - producer + bank + infantry = 3
    const allEntities2 = state.store.all();
    expect(allEntities2.length).toBe(3);

    const infantry = allEntities2.find(e => e.components.faction?.faction === 'infantry');
    expect(infantry).toBeDefined();
    expect(infantry?.components.faction?.team).toBe('player');
    expect(infantry?.components.health?.hp).toBe(20);
    expect(infantry?.components.combat?.weaponId).toBe('rifle');
  });

  it('insufficient credits pauses production (no deduction, no spawn)', () => {
    const producerId = addProducer(5, 5, 20); // 20 + 50 = 70 TOTAL, infantry costs 100 (TP-2: one wallet)
    addBank(producerId, 50);

    const initialCredits = state.store.get(producerId)?.components.economy?.credits || 0;
    expect(initialCredits).toBe(20);

    // Run many ticks
    for (let i = 0; i < 100; i++) {
      runTick(state, systems);
    }

    // Credits should remain unchanged (no deduction)
    const afterCredits = state.store.get(producerId)?.components.economy?.credits || 0;
    expect(afterCredits).toBe(20);

    // No unit should spawn
    const allEntities = state.store.all();
    expect(allEntities.length).toBe(2); // producer + bank only
  });

  it('resume after topping up credits', () => {
    const producerId = addProducer(5, 5, 20); // 20 + 50 = 70 total: insufficient (TP-2 wallet)
    addBank(producerId, 50);

    // Run ticks with insufficient credits
    for (let i = 0; i < 100; i++) {
      runTick(state, systems);
    }

    // Credits unchanged, no spawn
    expect(state.store.get(producerId)?.components.economy?.credits).toBe(20);
    expect(state.store.all().length).toBe(2);

    // Top up credits to 500
    const bank = state.store.all().find(e => e.components.economy);
    if (bank && bank.components.economy) {
      bank.components.economy.credits = 500;
    }

    // Run the full build
    for (let i = 0; i < INFANTRY_TICKS; i++) {
      runTick(state, systems);
    }

    // Now infantry should exist
    const allEntities = state.store.all();
    expect(allEntities.length).toBe(3);

    const infantry = allEntities.find(e => e.components.faction?.faction === 'infantry');
    expect(infantry).toBeDefined();
  });

  it('sequential queue: second deduction happens only after first completes', () => {
    const producerId = addProducer(5, 5, 1000); // 1000 credits for 2 infantry (200 total cost)
    addBank(producerId, 1000);

    // Replace queue with 2 infantry
    const producer = state.store.get(producerId);
    if (producer && producer.components.production) {
      producer.components.production = { queue: ['infantry', 'infantry'], progress: 0 };
    }

    // First infantry should complete
    for (let i = 0; i < INFANTRY_TICKS; i++) {
      runTick(state, systems);
    }

    // After first completes, credits should be 900 (1000 - 100 for first infantry)
    // The second infantry starts in the same tick, so credits are 900
    const afterFirstCredits = state.store.get(producerId)?.components.economy?.credits || 0;
    expect(afterFirstCredits).toBe(900);

    // Only one infantry should exist (second hasn't completed yet)
    const infantryCount = state.store.all().filter(e => e.components.faction?.faction === 'infantry').length;
    expect(infantryCount).toBe(1);

    // Second infantry should complete
    for (let i = 0; i < INFANTRY_TICKS; i++) {
      runTick(state, systems);
    }

    // After second completes, credits should be 800 (900 - 100 for second infantry)
    const afterSecondCredits = state.store.get(producerId)?.components.economy?.credits || 0;
    expect(afterSecondCredits).toBe(800);

    // Two infantry should exist
    const finalInfantryCount = state.store.all().filter(e => e.components.faction?.faction === 'infantry').length;
    expect(finalInfantryCount).toBe(2);
  });

  it('second queued item does not start until first completes (insufficient credits)', () => {
    const producerId = addProducer(5, 5, 100); // Only 100 credits for 2 infantry (200 total cost)
    addBank(producerId, 100);

    // Replace queue with 2 infantry
    const producer = state.store.get(producerId);
    if (producer && producer.components.production) {
      producer.components.production = { queue: ['infantry', 'infantry'], progress: 0 };
    }

    // Run the full build
    for (let i = 0; i < INFANTRY_TICKS; i++) {
      runTick(state, systems);
    }

    // Only one infantry should exist (first completed, second paused due to insufficient credits)
    const infantryCount = state.store.all().filter(e => e.components.faction?.faction === 'infantry').length;
    expect(infantryCount).toBe(1);

    // Credits should be 0 (100 spent on first)
    const credits = state.store.get(producerId)?.components.economy?.credits || 0;
    expect(credits).toBe(0);
  });
});
