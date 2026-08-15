// ── v0.51 beyond-WC3 control depth: shift-queued waypoints + military-first box ─
import { describe, it, expect, beforeEach } from 'vitest';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { makeCommandSystem } from '../../src/sim/systems/command.js';
import { makeMovementSystem } from '../../src/sim/systems/movement.js';
import { orderSystems, runTick, type SimSystem } from '../../src/sim/loop.js';
import { tileToWorldCenter, worldToTile } from '../../src/sim/coords.js';
import { makeCommandQueue, type CommandIntent } from '../../src/view/input.js';
import type { EntityId } from '../../src/sim/ids.js';

describe('shift-queued orders + military-first box select', () => {
  let state: SimState;
  let systems: readonly SimSystem[];
  let queue: { drain(): CommandIntent[]; push(intent: CommandIntent): void };

  beforeEach(() => {
    state = makeSimState({ seed: 42, mapWidth: 32, mapHeight: 32 });
    queue = makeCommandQueue();
    systems = orderSystems([makeCommandSystem(queue, []), makeMovementSystem()]);
  });

  const mkSoldier = (tx: number, ty: number, selected = true): EntityId => state.store.create({
    position: tileToWorldCenter({ tx, ty }),
    movement: { target: null, path: [], speed: 40 },
    combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
    health: { hp: 20, maxHp: 20 },
    faction: { team: 'player', faction: 'infantry' },
    ...(selected ? { selection: { selected: true } } : {}),
  });

  const orderTo = (tx: number, ty: number, queued?: boolean): void => {
    queue.push({ type: 'order', target: tileToWorldCenter({ tx, ty }), tile: { tx, ty }, queued });
  };

  it('shift-order appends a waypoint; the unit visits both legs in sequence', () => {
    const id = mkSoldier(5, 5);
    orderTo(8, 5);
    orderTo(8, 8, true); // shift-queued second leg
    runTick(state, systems);

    const mv = state.store.get(id)!.components.movement!;
    expect(mv.orderQueue?.length).toBe(1);
    expect(worldToTile({ wx: mv.target!.wx, wy: mv.target!.wy })).toEqual({ tx: 8, ty: 5 });

    for (let t = 0; t < 400; t++) runTick(state, systems);
    const done = state.store.get(id)!;
    expect(worldToTile(done.components.position!)).toEqual({ tx: 8, ty: 8 });
    expect(done.components.movement!.target).toBeNull();
    expect(done.components.movement!.orderQueue?.length ?? 0).toBe(0);
  });

  it('a queued attack-move leg carries the attackMove flag when it goes live', () => {
    const id = mkSoldier(5, 5);
    orderTo(7, 5);
    queue.push({ type: 'attack-move', target: tileToWorldCenter({ tx: 7, ty: 8 }), tile: { tx: 7, ty: 8 }, queued: true });
    runTick(state, systems);
    expect(state.store.get(id)!.components.movement!.attackMove ?? false).toBe(false);

    for (let t = 0; t < 400; t++) {
      runTick(state, systems);
      const mv = state.store.get(id)!.components.movement!;
      if (mv.attackMove) break;
    }
    expect(state.store.get(id)!.components.movement!.attackMove).toBe(true);
  });

  it('a plain order replaces the whole queue; stop clears it', () => {
    const id = mkSoldier(5, 5);
    orderTo(8, 5);
    orderTo(8, 8, true);
    orderTo(5, 8, true);
    runTick(state, systems);
    expect(state.store.get(id)!.components.movement!.orderQueue?.length).toBe(2);

    orderTo(10, 10); // plain → replaces
    runTick(state, systems);
    const mv = state.store.get(id)!.components.movement!;
    expect(mv.orderQueue?.length ?? 0).toBe(0);
    expect(worldToTile({ wx: mv.target!.wx, wy: mv.target!.wy })).toEqual({ tx: 10, ty: 10 });

    orderTo(12, 12, true);
    runTick(state, systems);
    expect(state.store.get(id)!.components.movement!.orderQueue?.length).toBe(1);
    queue.push({ type: 'stop' });
    runTick(state, systems);
    const stopped = state.store.get(id)!.components.movement!;
    expect(stopped.target).toBeNull();
    expect(stopped.orderQueue?.length ?? 0).toBe(0);
  });

  it('the queue is capped at 8 waypoints', () => {
    const id = mkSoldier(5, 5);
    orderTo(8, 5);
    for (let i = 0; i < 12; i++) orderTo(9 + (i % 3), 6 + (i % 4), true);
    runTick(state, systems);
    expect(state.store.get(id)!.components.movement!.orderQueue?.length).toBe(8);
  });

  it('military-first box select: a mixed box grabs only the fighters; a support-only box still selects', () => {
    const s1 = mkSoldier(5, 5, false);
    const s2 = mkSoldier(6, 5, false);
    const harv = state.store.create({
      position: tileToWorldCenter({ tx: 5, ty: 6 }),
      movement: { target: null, path: [], speed: 10 },
      harvest: { state: 'IDLE', targetTile: null, targetRefinery: null, cargo: 0 },
      faction: { team: 'player', faction: 'harvester' },
    });
    const a = tileToWorldCenter({ tx: 4, ty: 4 });
    const b = tileToWorldCenter({ tx: 7, ty: 7 });
    queue.push({ type: 'select', worldRect: { minWx: a.wx, minWy: a.wy, maxWx: b.wx, maxWy: b.wy } });
    runTick(state, systems);
    expect(state.store.get(s1)?.components.selection?.selected).toBe(true);
    expect(state.store.get(s2)?.components.selection?.selected).toBe(true);
    expect(state.store.get(harv)?.components.selection?.selected ?? false).toBe(false);

    // A box holding ONLY the harvester must still select it (workers stay reachable).
    const c = tileToWorldCenter({ tx: 4, ty: 6 });
    const d = tileToWorldCenter({ tx: 6, ty: 7 });
    queue.push({ type: 'select', worldRect: { minWx: c.wx, minWy: Math.min(c.wy, d.wy), maxWx: d.wx, maxWy: Math.max(c.wy, d.wy) } });
    runTick(state, systems);
    expect(state.store.get(harv)?.components.selection?.selected).toBe(true);
    expect(state.store.get(s1)?.components.selection?.selected).toBe(false);
  });

  it('queued formation legs preserve stable unit-to-slot assignment', () => {
    const a = mkSoldier(5, 5);
    const b = mkSoldier(6, 5);
    const dest1 = tileToWorldCenter({ tx: 8, ty: 5 });
    const dest2 = tileToWorldCenter({ tx: 8, ty: 8 });
    orderTo(8, 5);
    orderTo(8, 8, true);
    runTick(state, systems);
    const ma = state.store.get(a)!.components.movement!;
    const mb = state.store.get(b)!.components.movement!;
    expect(ma.target).not.toEqual(mb.target);
    expect(ma.orderQueue?.length).toBe(1);
    expect(mb.orderQueue?.length).toBe(1);
    const qa = ma.orderQueue![0]!, qb = mb.orderQueue![0]!;
    expect(`${qa.wx},${qa.wy}`).not.toBe(`${qb.wx},${qb.wy}`);
    // Slot identity: the offset from dest1 equals the offset from dest2 (same travel-ish
    // southward second leg vs eastward first — we check ID-stable distinctness and that
    // repeating the command log yields the same slots).
    const tA1 = { ...ma.target! }, tB1 = { ...mb.target! };
    const tA2 = { wx: qa.wx, wy: qa.wy }, tB2 = { wx: qb.wx, wy: qb.wy };
    // Replay from a fresh pair on the same tick-0 state shape.
    const state2 = makeSimState({ seed: 42, mapWidth: 32, mapHeight: 32 });
    const queue2 = makeCommandQueue();
    const systems2 = orderSystems([makeCommandSystem(queue2, []), makeMovementSystem()]);
    const a2 = state2.store.create({
      position: tileToWorldCenter({ tx: 5, ty: 5 }),
      movement: { target: null, path: [], speed: 40 },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
      health: { hp: 20, maxHp: 20 },
      faction: { team: 'player', faction: 'infantry' },
      selection: { selected: true },
    });
    const b2 = state2.store.create({
      position: tileToWorldCenter({ tx: 6, ty: 5 }),
      movement: { target: null, path: [], speed: 40 },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
      health: { hp: 20, maxHp: 20 },
      faction: { team: 'player', faction: 'infantry' },
      selection: { selected: true },
    });
    queue2.push({ type: 'order', target: dest1, tile: { tx: 8, ty: 5 } });
    queue2.push({ type: 'order', target: dest2, tile: { tx: 8, ty: 8 }, queued: true });
    runTick(state2, systems2);
    expect(state2.store.get(a2)!.components.movement!.target).toEqual(tA1);
    expect(state2.store.get(b2)!.components.movement!.target).toEqual(tB1);
    expect(state2.store.get(a2)!.components.movement!.orderQueue![0]).toEqual(tA2);
    expect(state2.store.get(b2)!.components.movement!.orderQueue![0]).toEqual(tB2);
  });
});
