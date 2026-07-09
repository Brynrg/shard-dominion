// ── XP-1 walls: path-blocking buildings ──────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { makeSimState } from '../../src/sim/state.js';
import { findPath } from '../../src/sim/pathfind.js';
import { orderSystems, runTick } from '../../src/sim/loop.js';
import { makeMovementSystem } from '../../src/sim/systems/movement.js';
import { tileToWorldCenter, worldToTile } from '../../src/sim/coords.js';

describe('XP-1 — walls block pathing', () => {
  it('findPath detours around a blocked tile line', () => {
    const state = makeSimState({ seed: 42, mapWidth: 32, mapHeight: 32 });
    // A vertical wall line at tx=10, ty 8..12; walk from (8,10) to (12,10).
    const blocked = new Set<string>();
    for (let ty = 8; ty <= 12; ty++) blocked.add(`10,${ty}`);
    const path = findPath(state.grid, { tx: 8, ty: 10 }, { tx: 12, ty: 10 }, blocked);
    expect(path).not.toBeNull();
    for (const t of path!) expect(blocked.has(`${t.tx},${t.ty}`), `path crosses wall at ${t.tx},${t.ty}`).toBe(false);
    // It actually detours (longer than the straight 4-tile line).
    expect(path!.length).toBeGreaterThan(4);
  });

  it('the movement system routes a unit around a living wall entity', () => {
    const state = makeSimState({ seed: 42, mapWidth: 32, mapHeight: 32 });
    // Wall entities (blocksPath) at (10,9),(10,10),(10,11).
    for (const ty of [9, 10, 11]) {
      state.store.create({
        position: tileToWorldCenter({ tx: 10, ty }),
        building: { onSlab: true, buildProgress: 100, powered: true, blocksPath: true },
        faction: { team: 'player', faction: 'wall' },
        health: { hp: 300, maxHp: 300 },
      });
    }
    const unit = state.store.create({
      position: tileToWorldCenter({ tx: 8, ty: 10 }),
      movement: { target: tileToWorldCenter({ tx: 12, ty: 10 }), path: [], speed: 20 },
      faction: { team: 'player', faction: 'infantry' },
      health: { hp: 20, maxHp: 20 },
    });
    const systems = orderSystems([makeMovementSystem()]);
    const wallTiles = new Set(['10,9', '10,10', '10,11']);
    for (let i = 0; i < 400; i++) {
      runTick(state, systems);
      const p = state.store.get(unit)!.components.position!;
      const t = worldToTile(p);
      expect(wallTiles.has(`${t.tx},${t.ty}`), `unit entered wall tile at tick ${i}`).toBe(false);
    }
    // It arrived on the far side.
    const end = worldToTile(state.store.get(unit)!.components.position!);
    expect(end.tx).toBe(12);
    expect(end.ty).toBe(10);
  });
});
