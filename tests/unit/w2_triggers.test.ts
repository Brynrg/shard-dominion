import { describe, it, expect } from 'vitest';
import { makeSimState } from '../../src/sim/state.js';
import { makeObjectivesSystem } from '../../src/sim/systems/objectives.js';
import { makeFogSystem } from '../../src/sim/systems/fog.js';
import { orderSystems, runTick, SIM_TICK_RATE } from '../../src/sim/loop.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import { loadUnits } from '../../src/loaders/units.js';
import unitsData from '../../data/units.json' with { type: 'json' };
import { unitComponents } from '../../src/sim/factory.js';
import { FACTIONS } from '../../src/sim/factions.js';

const units = loadUnits(unitsData);

// W2 trigger vocabulary — written by the local coder (hermes-ask cheap) to
// packets/W2b-trigger-tests.md; tick-boundary loops + the hpBelow fixture corrected in review.
describe('W2 — trigger vocabulary', () => {
  it('unitEnters: no player unit in region → no message; create infantry at (20,20) → next tick message; fires only once', () => {
    const state = makeSimState({ seed: 1, mapWidth: 32, mapHeight: 32 });
    const sys = makeObjectivesSystem(
      [{ type: 'survive', seconds: 999, primary: true, text: 'x' }],
      [],
      [{
        id: 't1',
        when: { unitEnters: { team: 'player', region: { tx: 20, ty: 20, r: 2 } } },
        actions: [{ type: 'message', text: 'Unit entered.' }],
      }],
      units
    );
    const systems = orderSystems([sys]);

    // No player unit in region initially
    runTick(state, systems);
    expect(sys.messages.length).toBe(0);

    // Create an infantry at (20,20)
    const infantryDef = units.find(u => u.id === 'infantry')!;
    state.store.create({
      position: tileToWorldCenter({ tx: 20, ty: 20 }),
      ...unitComponents(infantryDef, 'player', FACTIONS.concord),
    });

    // Next tick: message should be queued
    runTick(state, systems);
    expect(sys.messages.length).toBe(1);
    expect(sys.messages[0]!.text).toBe('Unit entered.');

    // Further 5 ticks: still exactly one message (trigger fired only once)
    for (let i = 0; i < 5; i++) {
      runTick(state, systems);
    }
    expect(sys.messages.length).toBe(1);
  });

  it('destroyed latch: enemy barracks alive → no fire; set hp=0 → fires next tick; kind never existed does not fire', () => {
    const state = makeSimState({ seed: 1, mapWidth: 32, mapHeight: 32 });
    const sys = makeObjectivesSystem(
      [{ type: 'survive', seconds: 999, primary: true, text: 'x' }],
      [],
      [
        {
          id: 't_barracks',
          when: { destroyed: { team: 'enemy', kind: 'barracks' } },
          actions: [{ type: 'message', text: 'Barracks destroyed.' }],
        },
        {
          id: 't_never',
          when: { destroyed: { team: 'enemy', kind: 'neverkind' } },
          actions: [{ type: 'message', text: 'Never.' }],
        },
      ],
      units
    );
    const systems = orderSystems([sys]);

    // Enemy barracks alive → no fire
    const barracksId = state.store.create({
      position: tileToWorldCenter({ tx: 10, ty: 10 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'enemy', faction: 'barracks' },
      health: { hp: 100, maxHp: 100 },
    });
    runTick(state, systems);
    expect(sys.messages.length).toBe(0);

    // Set hp = 0 → fires next tick
    state.store.get(barracksId)!.components.health!.hp = 0;
    runTick(state, systems);
    expect(sys.messages.length).toBe(1);
    expect(sys.messages[0]!.text).toBe('Barracks destroyed.');

    // Trigger whose kind NEVER existed does not fire
    expect(sys.messages.some(m => m.text === 'Never.')).toBe(false);
  });

  it('hpBelow fraction 0.5: infantry at full hp → no fire; set hp to 40% → fires', () => {
    const state = makeSimState({ seed: 1, mapWidth: 32, mapHeight: 32 });
    const sys = makeObjectivesSystem(
      [{ type: 'survive', seconds: 999, primary: true, text: 'x' }],
      [],
      [{
        id: 't_hp',
        when: { hpBelow: { team: 'player', kind: 'infantry', fraction: 0.5 } },
        actions: [{ type: 'message', text: 'Low HP.' }],
      }],
      units
    );
    const systems = orderSystems([sys]);

    // Infantry at full hp → no fire
    const infantryDef = units.find(u => u.id === 'infantry')!;
    state.store.create({
      position: tileToWorldCenter({ tx: 15, ty: 15 }),
      ...unitComponents(infantryDef, 'player', FACTIONS.concord),
    });
    runTick(state, systems);
    expect(sys.messages.length).toBe(0);

    // Set hp to 40% → fires
    const infantryId = state.store.all().find(e => e.components.faction?.team === 'player' && e.components.faction?.faction === 'infantry')!.id;
    const inf = state.store.get(infantryId)!.components.health!;
    inf.hp = Math.floor(inf.maxHp * 0.4); // 40% of a 20-HP rifleman
    runTick(state, systems);
    expect(sys.messages.length).toBe(1);
    expect(sys.messages[0]!.text).toBe('Low HP.');
  });

  it('triggerFired + delaySeconds: trigger A timeSeconds:1; trigger B triggerFired:A delaySeconds:2 → B fires ≥2s after A', () => {
    const state = makeSimState({ seed: 1, mapWidth: 32, mapHeight: 32 });
    const sys = makeObjectivesSystem(
      [{ type: 'survive', seconds: 999, primary: true, text: 'x' }],
      [],
      [
        {
          id: 'A',
          when: { timeSeconds: 1 },
          actions: [{ type: 'message', text: 'A fired.' }],
        },
        {
          id: 'B',
          when: { triggerFired: 'A', delaySeconds: 2 },
          actions: [{ type: 'message', text: 'B fired.' }],
        },
      ],
      units
    );
    const systems = orderSystems([sys]);

    // Run until A fires (at tick ~20)
    for (let t = 0; t <= SIM_TICK_RATE; t++) {
      runTick(state, systems);
    }
    // A should have fired
    expect(sys.messages.some(m => m.text === 'A fired.')).toBe(true);
    // B should NOT have fired yet (delay not elapsed)
    expect(sys.messages.some(m => m.text === 'B fired.')).toBe(false);

    // Check at A+30 ticks (total ~50 ticks): B still absent
    for (let t = 0; t < 30; t++) {
      runTick(state, systems);
    }
    expect(sys.messages.some(m => m.text === 'B fired.')).toBe(false);

    // Check at A+41 ticks (total ~61 ticks): B present
    for (let t = 0; t < 11; t++) {
      runTick(state, systems);
    }
    expect(sys.messages.some(m => m.text === 'B fired.')).toBe(true);
  });

  it('addObjective + completeObjective: time trigger adds objective; second trigger completes it', () => {
    const state = makeSimState({ seed: 1, mapWidth: 32, mapHeight: 32 });
    const sys = makeObjectivesSystem(
      [{ type: 'survive', seconds: 999, primary: true, text: 'x' }],
      [],
      [
        {
          id: 't_add',
          when: { timeSeconds: 1 },
          actions: [{
            type: 'addObjective',
            objective: { type: 'build', id: 'extra', team: 'player', kind: 'barracks', primary: false, text: 'Build one' },
          }],
        },
        {
          id: 't_complete',
          when: { timeSeconds: 2 },
          actions: [{ type: 'completeObjective', id: 'extra' }],
        },
      ],
      units
    );
    const systems = orderSystems([sys]);

    // Run until time trigger adds objective
    for (let t = 0; t <= SIM_TICK_RATE; t++) {
      runTick(state, systems);
    }
    // Check objectives: should have 2 entries (survive + extra), extra incomplete
    const result = sys.result.objectives;
    expect(result.length).toBe(2);
    const extraObj = result.find(o => o.id === 'extra');
    expect(extraObj).toBeDefined();
    expect(extraObj!.complete).toBe(false);

    // Run until second trigger completes it
    for (let t = 0; t <= SIM_TICK_RATE; t++) {
      runTick(state, systems);
    }
    // Check objectives: extra should be complete
    const result2 = sys.result.objectives;
    const extraObj2 = result2.find(o => o.id === 'extra');
    expect(extraObj2).toBeDefined();
    expect(extraObj2!.complete).toBe(true);
  });

  it('removeUnits with region: two player infantry, one inside (20,20 r2) and one outside → after trigger, only outside remains', () => {
    const state = makeSimState({ seed: 1, mapWidth: 32, mapHeight: 32 });
    const sys = makeObjectivesSystem(
      [{ type: 'survive', seconds: 999, primary: true, text: 'x' }],
      [],
      [{
        id: 't_remove',
        when: { timeSeconds: 1 },
        actions: [{ type: 'removeUnits', team: 'player', kind: 'infantry', region: { tx: 20, ty: 20, r: 2 } }],
      }],
      units
    );
    const systems = orderSystems([sys]);

    // Create two player infantry: one inside region, one outside
    const infantryDef = units.find(u => u.id === 'infantry')!;
    const insideId = state.store.create({
      position: tileToWorldCenter({ tx: 20, ty: 20 }),
      ...unitComponents(infantryDef, 'player', FACTIONS.concord),
    });
    const outsideId = state.store.create({
      position: tileToWorldCenter({ tx: 0, ty: 0 }),
      ...unitComponents(infantryDef, 'player', FACTIONS.concord),
    });

    // Run until time trigger removes units in region
    for (let t = 0; t <= SIM_TICK_RATE; t++) {
      runTick(state, systems);
    }

    // Check that only the outside unit remains
    const allUnits = state.store.all();
    const playerUnits = allUnits.filter(e => e.components.faction?.team === 'player' && e.components.faction?.faction === 'infantry');
    expect(playerUnits.length).toBe(1);
    expect(playerUnits[0]!.id).toBe(outsideId);
    expect(playerUnits.some(u => u.id === insideId)).toBe(false);
  });

  it('reveal → fog: before trigger fog.visible has (20,20) false; after trigger true; after 1s+2 ticks false again', () => {
    const state = makeSimState({ seed: 1, mapWidth: 32, mapHeight: 32 });
    const sys = makeObjectivesSystem(
      [{ type: 'survive', seconds: 999, primary: true, text: 'x' }],
      [],
      [{
        id: 't_reveal',
        when: { timeSeconds: 1 },
        actions: [{ type: 'reveal', region: { tx: 20, ty: 20, r: 2 }, seconds: 1 }],
      }],
      units
    );
    const fog = makeFogSystem('player', () => sys.activeReveals());
    const systems = orderSystems([sys, fog]);

    // Before trigger: no player units near (20,20), so fog.visible should not have it
    for (let t = 0; t < SIM_TICK_RATE; t++) {
      runTick(state, systems);
    }
    expect(fog.visible.has('20,20')).toBe(false);

    // After trigger: reveal active, so fog.visible should have it
    runTick(state, systems);
    expect(fog.visible.has('20,20')).toBe(true);

    // After 1s + 2 ticks: reveal expired, so fog.visible should not have it
    for (let t = 0; t < SIM_TICK_RATE + 2; t++) {
      runTick(state, systems);
    }
    expect(fog.visible.has('20,20')).toBe(false);
  });

  it('panCamera pushes {tx:5, ty:6, tick} onto sys.cameraRequests; message.seconds:1 expires after ~20 ticks', () => {
    const state = makeSimState({ seed: 1, mapWidth: 32, mapHeight: 32 });
    const sys = makeObjectivesSystem(
      [{ type: 'survive', seconds: 999, primary: true, text: 'x' }],
      [],
      [
        {
          id: 't_cam',
          when: { timeSeconds: 1 },
          actions: [{ type: 'panCamera', tx: 5, ty: 6 }],
        },
        {
          id: 't_msg',
          when: { timeSeconds: 1 },
          actions: [{ type: 'message', text: 'Default message.', seconds: 1 }],
        },
      ],
      units
    );
    const systems = orderSystems([sys]);

    // Run until time triggers fire
    for (let t = 0; t <= SIM_TICK_RATE; t++) {
      runTick(state, systems);
    }

    // Check camera request
    expect(sys.cameraRequests.length).toBe(1);
    expect(sys.cameraRequests[0]!.tx).toBe(5);
    expect(sys.cameraRequests[0]!.ty).toBe(6);

    // Check message expires after ~20 ticks (1 second)
    for (let t = 0; t < SIM_TICK_RATE + 5; t++) {
      runTick(state, systems);
    }
    expect(sys.messages.length).toBe(0);
  });
});
