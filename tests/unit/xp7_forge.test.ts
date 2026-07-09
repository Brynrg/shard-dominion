// ── XP-7: 4-seat lockstep + the Faction Strike ──────────────────────────────────
import { describe, it, expect } from 'vitest';
import { makeLockstep } from '../../src/net/lockstep.js';
import { makeSimState } from '../../src/sim/state.js';
import { orderSystems, runTick } from '../../src/sim/loop.js';
import { makeCommandSystem } from '../../src/sim/systems/command.js';
import { makeCommandQueue } from '../../src/view/input.js';
import { loadStructures } from '../../src/loaders/structures.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import structuresData from '../../data/structures.json' with { type: 'json' };

const structures = loadStructures(structuresData);

describe('XP-7 — 2v2 lockstep', () => {
  it('a 4-seat tick runs only when ALL four bundles are known; teams pair by parity', () => {
    const sent: string[] = [];
    const listeners: ((m: string) => void)[] = [];
    const transport = { send: (m: string) => sent.push(m), onMessage: (cb: (m: string) => void) => listeners.push(cb) };
    const ls = makeLockstep(0, transport, 4);
    expect(ls.team).toBe('player');
    expect(makeLockstep(1, transport, 4).team).toBe('enemy');
    expect(makeLockstep(2, transport, 4).team).toBe('player');
    expect(makeLockstep(3, transport, 4).team).toBe('enemy');
    // Delay window pre-seeded for all 4 seats → tick 0 runnable immediately.
    expect(ls.canRun(0)).toBe(true);
    // Tick 3 (past the delay) needs the other three seats' bundles.
    ls.afterTick(0, 0); // flushes seat 0's bundle for tick 0+delay
    expect(ls.canRun(3)).toBe(false);
    for (const seat of [1, 2, 3]) {
      for (const cb of listeners) cb(JSON.stringify({ type: 'cmd', tick: 3, seat, intents: [] }));
    }
    expect(ls.canRun(3)).toBe(true);
  });
});

describe('XP-7 — Faction Strike', () => {
  it('T3 + 5 Cells buys a delayed splash that damages the target area', () => {
    const state = makeSimState({ seed: 7, mapWidth: 32, mapHeight: 32 });
    state.store.create({
      position: tileToWorldCenter({ tx: 8, ty: 8 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'construction_yard' },
      tech: { tier: 3, upgradingTo: null, ticksLeft: 0 },
      health: { hp: 2000, maxHp: 2000 },
    });
    state.store.create({
      position: tileToWorldCenter({ tx: 9, ty: 8 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'refinery' },
      economy: { credits: 500, refineryStorage: 500, maxStorage: 2000, cells: 6 },
      health: { hp: 1500, maxHp: 1500 },
    });
    const victim = state.store.create({
      position: tileToWorldCenter({ tx: 20, ty: 20 }),
      movement: { target: null, path: [], speed: 12 },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
      faction: { team: 'enemy', faction: 'infantry' },
      health: { hp: 20, maxHp: 20 },
    });
    const queue = makeCommandQueue();
    const sys = orderSystems([makeCommandSystem(queue, structures)]);
    queue.push({ type: 'strike', target: tileToWorldCenter({ tx: 20, ty: 20 }) });
    runTick(state, sys);
    const bank = state.store.all().find(e => e.components.economy)!.components.economy!;
    expect(bank.cells).toBe(1); // 5 charged
    expect(state.store.get(victim)!.components.health!.hp).toBe(20); // telegraphed, not instant
    for (let i = 0; i < 61; i++) runTick(state, sys);
    expect(state.store.get(victim)!.components.health!.hp).toBeLessThan(0); // vaporized
  });

  it('below T3 (or without Cells) the strike refuses and charges nothing', () => {
    const state = makeSimState({ seed: 7, mapWidth: 32, mapHeight: 32 });
    state.store.create({
      position: tileToWorldCenter({ tx: 8, ty: 8 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'construction_yard' },
      tech: { tier: 2, upgradingTo: null, ticksLeft: 0 },
      health: { hp: 2000, maxHp: 2000 },
    });
    state.store.create({
      position: tileToWorldCenter({ tx: 9, ty: 8 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'refinery' },
      economy: { credits: 500, refineryStorage: 500, maxStorage: 2000, cells: 6 },
      health: { hp: 1500, maxHp: 1500 },
    });
    const queue = makeCommandQueue();
    const sys = orderSystems([makeCommandSystem(queue, structures)]);
    queue.push({ type: 'strike', target: tileToWorldCenter({ tx: 20, ty: 20 }) });
    runTick(state, sys);
    expect(state.store.all().find(e => e.components.economy)!.components.economy!.cells).toBe(6);
  });
});
