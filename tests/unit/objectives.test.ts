// ── Objective system tests (campaign mission win/lose) ──────────────────────────
import { describe, it, expect, beforeEach } from 'vitest';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { makeObjectivesSystem } from '../../src/sim/systems/objectives.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import { SIM_TICK_RATE } from '../../src/sim/loop.js';

function addBuilding(state: SimState, team: 'player' | 'enemy', faction: string, withProduction = false) {
  return state.store.create({
    position: tileToWorldCenter({ tx: 10, ty: 10 }),
    building: { onSlab: true, buildProgress: 100, powered: true },
    faction: { team, faction },
    health: { hp: 800, maxHp: 800 }, armor: { armorClass: 'BUILDING' },
    ...(withProduction ? { production: { queue: [], progress: 0 } } : {}),
  });
}
function addEconomy(state: SimState, team: 'player' | 'enemy', credits: number) {
  return state.store.create({
    position: tileToWorldCenter({ tx: 8, ty: 8 }),
    building: { onSlab: true, buildProgress: 100, powered: true },
    faction: { team, faction: 'refinery' },
    economy: { credits, refineryStorage: credits, maxStorage: 2000 },
    health: { hp: 1500, maxHp: 1500 },
  });
}
function addUnit(state: SimState, team: 'player' | 'enemy', tx: number, ty: number) {
  return state.store.create({
    position: tileToWorldCenter({ tx, ty }),
    health: { hp: 20, maxHp: 20 },
    movement: { target: null, path: [], speed: 12 },
    combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
    faction: { team, faction: 'infantry' },
  });
}

describe('objectives — destroy / eliminate', () => {
  let state: SimState;
  beforeEach(() => { state = makeSimState({ seed: 1, mapWidth: 32, mapHeight: 32 }); });

  it('destroy: incomplete while the target lives, complete once it is gone', () => {
    const sys = makeObjectivesSystem([{ type: 'destroy', team: 'enemy', faction: 'barracks', primary: true, text: 'kill barracks' }]);
    const b = addBuilding(state, 'enemy', 'barracks');
    sys.run(state);
    expect(sys.result.won).toBe(false);
    state.store.remove(b);
    sys.run(state);
    expect(sys.result.won).toBe(true);
  });

  it('destroy: a target already dead (hp<=0) counts as destroyed', () => {
    const sys = makeObjectivesSystem([{ type: 'destroy', team: 'enemy', faction: 'barracks', primary: true, text: 'x' }]);
    const b = addBuilding(state, 'enemy', 'barracks');
    state.store.get(b)!.components.health!.hp = 0;
    sys.run(state);
    expect(sys.result.won).toBe(true);
  });

  it('eliminate: complete once the team has no producer and no army', () => {
    const sys = makeObjectivesSystem([{ type: 'eliminate', team: 'enemy', primary: true, text: 'wipe them' }]);
    const bar = addBuilding(state, 'enemy', 'barracks', true);
    sys.run(state);
    expect(sys.result.won).toBe(false);
    state.store.remove(bar);
    sys.run(state);
    expect(sys.result.won).toBe(true);
  });
});

describe('objectives — survive / accumulate / build', () => {
  let state: SimState;
  beforeEach(() => { state = makeSimState({ seed: 1, mapWidth: 32, mapHeight: 32 }); });

  it('survive: complete when the tick reaches seconds × rate', () => {
    const sys = makeObjectivesSystem([{ type: 'survive', seconds: 10, primary: true, text: 'hold 10s' }]);
    state.tick = (10 * SIM_TICK_RATE - 1) as typeof state.tick;
    sys.run(state);
    expect(sys.result.won).toBe(false);
    state.tick = (10 * SIM_TICK_RATE) as typeof state.tick;
    sys.run(state);
    expect(sys.result.won).toBe(true);
  });

  it('accumulate: complete when team credits reach the threshold', () => {
    const sys = makeObjectivesSystem([{ type: 'accumulate', team: 'player', credits: 1000, primary: true, text: 'bank 1000' }]);
    const eco = addEconomy(state, 'player', 400);
    sys.run(state);
    expect(sys.result.won).toBe(false);
    state.store.get(eco)!.components.economy!.credits = 1000;
    sys.run(state);
    expect(sys.result.won).toBe(true);
  });

  it('build: complete once the team owns the structure', () => {
    const sys = makeObjectivesSystem([{ type: 'build', team: 'player', faction: 'barracks', primary: true, text: 'build a barracks' }]);
    sys.run(state);
    expect(sys.result.won).toBe(false);
    addBuilding(state, 'player', 'barracks');
    sys.run(state);
    expect(sys.result.won).toBe(true);
  });
});

describe('objectives — reach / hold', () => {
  let state: SimState;
  beforeEach(() => { state = makeSimState({ seed: 1, mapWidth: 32, mapHeight: 32 }); });

  it('reach: complete (latched) once a team unit enters the region', () => {
    const sys = makeObjectivesSystem([{ type: 'reach', team: 'player', region: { tx: 20, ty: 20, r: 2 }, primary: true, text: 'reach the ridge' }]);
    const u = addUnit(state, 'player', 5, 5);
    sys.run(state);
    expect(sys.result.won).toBe(false);
    state.store.get(u)!.components.position = tileToWorldCenter({ tx: 20, ty: 20 });
    sys.run(state);
    expect(sys.result.won).toBe(true);
    // Latched: leaving the region keeps it complete.
    state.store.get(u)!.components.position = tileToWorldCenter({ tx: 0, ty: 0 });
    sys.run(state);
    expect(sys.result.won).toBe(true);
  });

  it('hold: needs CONTINUOUS presence for the duration; leaving resets it', () => {
    const sys = makeObjectivesSystem([{ type: 'hold', team: 'player', region: { tx: 16, ty: 16, r: 3 }, seconds: 3, primary: true, text: 'hold the vein' }]);
    const u = addUnit(state, 'player', 16, 16); // in region
    // 3s = 60 ticks of continuous presence.
    for (let i = 0; i < 59; i++) sys.run(state);
    expect(sys.result.won).toBe(false);
    // Leave → the hold counter resets.
    state.store.get(u)!.components.position = tileToWorldCenter({ tx: 0, ty: 0 });
    sys.run(state);
    expect(sys.result.won).toBe(false);
    // Return and hold the full duration.
    state.store.get(u)!.components.position = tileToWorldCenter({ tx: 16, ty: 16 });
    for (let i = 0; i < 60; i++) sys.run(state);
    expect(sys.result.won).toBe(true);
  });
});

describe('objectives — failures & win/lose interplay', () => {
  let state: SimState;
  beforeEach(() => { state = makeSimState({ seed: 1, mapWidth: 32, mapHeight: 32 }); });

  it('defend failure: losing the defended entity loses the mission', () => {
    const sys = makeObjectivesSystem(
      [{ type: 'survive', seconds: 999, primary: true, text: 'survive' }],
      [{ type: 'defend', team: 'player', faction: 'construction_yard' }],
    );
    const hq = addBuilding(state, 'player', 'construction_yard');
    sys.run(state);
    expect(sys.result.lost).toBe(false);
    state.store.remove(hq);
    sys.run(state);
    expect(sys.result.lost).toBe(true);
    expect(sys.result.won).toBe(false);
  });

  it('lose_all_producers failure fires when the team is wiped out', () => {
    const sys = makeObjectivesSystem(
      [{ type: 'destroy', team: 'enemy', primary: true, text: 'destroy enemy' }],
      [{ type: 'lose_all_producers', team: 'player' }],
    );
    const bar = addBuilding(state, 'player', 'barracks', true);
    sys.run(state);
    expect(sys.result.lost).toBe(false);
    state.store.remove(bar);
    sys.run(state);
    expect(sys.result.lost).toBe(true);
  });

  it('secondary (non-primary) objectives do not block the win', () => {
    const sys = makeObjectivesSystem([
      { type: 'destroy', team: 'enemy', faction: 'barracks', primary: true, text: 'primary' },
      { type: 'accumulate', team: 'player', credits: 999999, primary: false, text: 'secondary (unmet)' },
    ]);
    const b = addBuilding(state, 'enemy', 'barracks');
    sys.run(state);
    expect(sys.result.won).toBe(false);
    state.store.remove(b);
    sys.run(state);
    expect(sys.result.won).toBe(true); // secondary unmet, but primary done → win
  });

  it('the decision is sticky (won stays won even if state later changes)', () => {
    const sys = makeObjectivesSystem([{ type: 'destroy', team: 'enemy', faction: 'barracks', primary: true, text: 'x' }]);
    const b = addBuilding(state, 'enemy', 'barracks');
    sys.run(state);                     // target seen alive (latches everSeen; not yet won)
    expect(sys.result.won).toBe(false);
    state.store.remove(b);
    sys.run(state);
    expect(sys.result.won).toBe(true);
    addBuilding(state, 'enemy', 'barracks'); // enemy "returns"
    sys.run(state);
    expect(sys.result.won).toBe(true);  // sticky
  });
});
