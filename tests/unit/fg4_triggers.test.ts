// ── FG-4 trigger tests: time/credits/objective conditions, spawn/message/grant ──
import { describe, it, expect } from 'vitest';
import { makeSimState } from '../../src/sim/state.js';
import { makeObjectivesSystem } from '../../src/sim/systems/objectives.js';
import { orderSystems, runTick, SIM_TICK_RATE } from '../../src/sim/loop.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import { loadUnits } from '../../src/loaders/units.js';
import unitsData from '../../data/units.json' with { type: 'json' };

const units = loadUnits(unitsData);

describe('FG-4 — mission triggers', () => {
  it('a time trigger fires ONCE: message queued (then expires) + wave spawned attack-moving', () => {
    const state = makeSimState({ seed: 1, mapWidth: 32, mapHeight: 32 });
    const sys = makeObjectivesSystem(
      [{ type: 'survive', seconds: 999, primary: true, text: 'x' }], [],
      [{
        id: 'wave1',
        when: { timeSeconds: 2 },
        actions: [
          { type: 'message', speaker: 'SCOUTS', text: 'Contact north.' },
          { type: 'spawn', team: 'enemy', units: [{ type: 'infantry', tx: 20, ty: 4 }, { type: 'infantry', tx: 21, ty: 4 }], attackMoveTo: { tx: 8, ty: 24 } },
        ],
      }], units);
    const systems = orderSystems([sys]);
    for (let t = 0; t < SIM_TICK_RATE * 2 - 2; t++) runTick(state, systems);
    expect(sys.messages.length).toBe(0); // not yet due
    expect(state.store.all().filter(e => e.components.faction?.team === 'enemy').length).toBe(0);

    for (let t = 0; t < 4; t++) runTick(state, systems);
    expect(sys.messages.length).toBe(1);
    expect(sys.messages[0]!.speaker).toBe('SCOUTS');
    const wave = state.store.all().filter(e => e.components.faction?.team === 'enemy');
    expect(wave.length).toBe(2);
    // Spawned attackers are COMMITTED: attack-moving toward the point.
    expect(wave[0]!.components.movement!.attackMove).toBe(true);
    expect(wave[0]!.components.movement!.target).toEqual(tileToWorldCenter({ tx: 8, ty: 24 }));

    // Fires exactly once; the message expires after ~8s.
    for (let t = 0; t < SIM_TICK_RATE * 9; t++) runTick(state, systems);
    expect(state.store.all().filter(e => e.components.faction?.team === 'enemy').length).toBe(2);
    expect(sys.messages.length).toBe(0);
  });

  it('credits + objectiveComplete conditions fire; grantCredits lands in the bank', () => {
    const state = makeSimState({ seed: 2, mapWidth: 32, mapHeight: 32 });
    const bank = state.store.create({
      position: tileToWorldCenter({ tx: 6, ty: 8 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'refinery' },
      economy: { credits: 400, refineryStorage: 400, maxStorage: 5000 },
      health: { hp: 1500, maxHp: 1500 },
    });
    // Quota is a SECONDARY here (the realistic shape: reaching it triggers a beat
    // mid-mission; the mission continues on the survive primary).
    const sys = makeObjectivesSystem(
      [
        { type: 'survive', seconds: 999, primary: true, text: 'hold' },
        { type: 'accumulate', id: 'quota', team: 'player', credits: 500, primary: false, text: 'bank 500' },
      ], [],
      [
        { id: 'rich', when: { credits: { team: 'player', gte: 450 } }, actions: [{ type: 'grantCredits', team: 'player', amount: 100 }] },
        { id: 'quota_met', when: { objectiveComplete: 'quota' }, actions: [{ type: 'message', text: 'Quota met.' }] },
      ], units);
    const systems = orderSystems([sys]);
    runTick(state, systems);
    expect(sys.messages.length).toBe(0); // 400 < 450: nothing yet
    state.store.get(bank)!.components.economy!.credits = 460;
    runTick(state, systems); // credits trigger → +100 → 560 ≥ 500 → objective completes
    expect(state.store.get(bank)!.components.economy!.credits).toBe(560);
    runTick(state, systems); // objectiveComplete condition sees last tick's completion
    expect(sys.messages.some(m => m.text === 'Quota met.')).toBe(true);
    expect(sys.result.won).toBe(false); // survive primary still pending
  });
});
