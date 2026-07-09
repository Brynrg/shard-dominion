// ── XP-6: the Choice — branch objectives + choice-fired triggers ────────────────
import { describe, it, expect } from 'vitest';
import { makeSimState } from '../../src/sim/state.js';
import { orderSystems, runTick } from '../../src/sim/loop.js';
import { makeObjectivesSystem } from '../../src/sim/systems/objectives.js';
import { loadMission } from '../../src/loaders/missions.js';
import { loadUnits } from '../../src/loaders/units.js';
import unitsData from '../../data/units.json' with { type: 'json' };
import m14 from '../../data/missions/m14_first_vein.json' with { type: 'json' };

const units = loadUnits(unitsData);

describe('XP-6 — the Choice', () => {
  it('onlyIfChoice filters branch objectives (seal keeps hold, drops destroy)', () => {
    const m = loadMission(m14);
    const seal = m.objectives.filter(o => !o.onlyIfChoice || o.onlyIfChoice === 'seal');
    const harness = m.objectives.filter(o => !o.onlyIfChoice || o.onlyIfChoice === 'harness');
    expect(seal.some(o => o.id === 'seal_hold')).toBe(true);
    expect(seal.some(o => o.id === 'harness_kill')).toBe(false);
    expect(harness.some(o => o.id === 'harness_kill')).toBe(true);
    expect(harness.some(o => o.id === 'seal_hold')).toBe(false);
  });

  it('a choice trigger fires only under its boot choice', () => {
    const m = loadMission(m14);
    const state = makeSimState({ seed: 1, mapWidth: 32, mapHeight: 32 });
    const sealSys = makeObjectivesSystem(m.objectives, m.failure, m.triggers, units, undefined, 'seal');
    const sys = orderSystems([sealSys]);
    for (let i = 0; i < 5; i++) runTick(state, sys);
    expect(sealSys.firedTriggerIds()).toContain('t14_seal_open');
    expect(sealSys.firedTriggerIds()).not.toContain('t14_harness_open');
    // The other branch, fresh state.
    const state2 = makeSimState({ seed: 1, mapWidth: 32, mapHeight: 32 });
    const harnessSys = makeObjectivesSystem(m.objectives, m.failure, m.triggers, units, undefined, 'harness');
    const sys2 = orderSystems([harnessSys]);
    for (let i = 0; i < 5; i++) runTick(state2, sys2);
    expect(harnessSys.firedTriggerIds()).toContain('t14_harness_open');
    expect(harnessSys.firedTriggerIds()).not.toContain('t14_seal_open');
  });
});
