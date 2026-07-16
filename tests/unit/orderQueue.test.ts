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
});
