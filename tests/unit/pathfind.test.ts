// ── Pathfinding tests (FG-1): A* correctness, determinism, mission-map sanity ───
import { describe, it, expect } from 'vitest';
import { makeTerrainGrid, makeGridManager } from '../../src/sim/grid.js';
import { findPath, nearestWalkable } from '../../src/sim/pathfind.js';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { seedFromMission } from '../../src/sim/seedMission.js';
import { loadMission } from '../../src/loaders/missions.js';
import { loadUnits } from '../../src/loaders/units.js';
import { loadStructures } from '../../src/loaders/structures.js';
import { loadEconomyConstants } from '../../src/loaders/economyConstants.js';
import { makeMovementSystem } from '../../src/sim/systems/movement.js';
import { orderSystems, runTick } from '../../src/sim/loop.js';
import { tileToWorldCenter, worldToTile } from '../../src/sim/coords.js';
import unitsData from '../../data/units.json' with { type: 'json' };
import structuresData from '../../data/structures.json' with { type: 'json' };
import economyData from '../../data/economyConstants.json' with { type: 'json' };
import skirmish from '../../data/missions/skirmish.json' with { type: 'json' };
import badlands from '../../data/missions/skirmish_badlands.json' with { type: 'json' };
import m1 from '../../data/missions/m1_first_light.json' with { type: 'json' };
import m2 from '../../data/missions/m2_lifeblood.json' with { type: 'json' };
import m3 from '../../data/missions/m3_hold_the_line.json' with { type: 'json' };
import m4 from '../../data/missions/m4_the_vein.json' with { type: 'json' };
import m5 from '../../data/missions/m5_iron_ash.json' with { type: 'json' };
import m6 from '../../data/missions/m6_ashen_warlord.json' with { type: 'json' };

const units = loadUnits(unitsData);
const structures = loadStructures(structuresData);
const economy = loadEconomyConstants(economyData);

/** 12×12 all-SAND grid with a vertical IMPASSABLE wall at tx=6, ty=0..9 (gap at the bottom). */
function wallGrid() {
  const t = makeTerrainGrid(12, 12, 'SAND');
  for (let ty = 0; ty <= 9; ty++) t.set({ tx: 6, ty }, 'IMPASSABLE');
  return makeGridManager(t);
}

describe('pathfind — A* core', () => {
  it('routes AROUND an impassable wall (never through it)', () => {
    const grid = wallGrid();
    const path = findPath(grid, { tx: 2, ty: 2 }, { tx: 10, ty: 2 });
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(8); // forced detour, longer than the straight line
    let prev = { tx: 2, ty: 2 };
    for (const t of path!) {
      expect(grid.isWalkable(t), `path crosses unwalkable (${t.tx},${t.ty})`).toBe(true);
      expect(Math.max(Math.abs(t.tx - prev.tx), Math.abs(t.ty - prev.ty))).toBe(1); // contiguous steps
      prev = t;
    }
    expect(prev).toEqual({ tx: 10, ty: 2 }); // ends at the goal
  });

  it('is deterministic: identical inputs → identical path', () => {
    const a = findPath(wallGrid(), { tx: 2, ty: 2 }, { tx: 10, ty: 2 });
    const b = findPath(wallGrid(), { tx: 2, ty: 2 }, { tx: 10, ty: 2 });
    expect(a).toEqual(b);
  });

  it('an enclosed start has no path (null), not an infinite loop', () => {
    const t = makeTerrainGrid(12, 12, 'SAND');
    for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
      t.set({ tx: 3 + dx!, ty: 3 + dy! }, 'IMPASSABLE');
    }
    const grid = makeGridManager(t);
    expect(findPath(grid, { tx: 3, ty: 3 }, { tx: 10, ty: 10 })).toBeNull();
  });

  it('an unwalkable GOAL is adjusted to the nearest walkable tile', () => {
    const t = makeTerrainGrid(12, 12, 'SAND');
    t.set({ tx: 8, ty: 8 }, 'IMPASSABLE');
    const grid = makeGridManager(t);
    expect(nearestWalkable(grid, { tx: 8, ty: 8 })).not.toBeNull();
    const path = findPath(grid, { tx: 1, ty: 1 }, { tx: 8, ty: 8 });
    expect(path).not.toBeNull();
    const end = path![path!.length - 1]!;
    expect(grid.isWalkable(end)).toBe(true);
    expect(Math.max(Math.abs(end.tx - 8), Math.abs(end.ty - 8))).toBeLessThanOrEqual(1);
  });
});

describe('pathfind — movement integration', () => {
  it('a unit ordered across a mesa arrives without ever standing on unwalkable ground', () => {
    // Find, on any of a few seeds, an impassable tile flanked (horizontally or
    // vertically) by walkable tiles 3 away — a forced-detour crossing.
    let state: SimState | null = null;
    let from: { tx: number; ty: number } | null = null, to: { tx: number; ty: number } | null = null;
    for (const seed of [42, 1337, 7, 99]) {
      const s = makeSimState({ seed, mapWidth: 32, mapHeight: 32 });
      for (let ty = 3; ty < 29 && !from; ty++) {
        for (let tx = 3; tx < 29 && !from; tx++) {
          if (s.grid.terrainAt({ tx, ty }) !== 'IMPASSABLE') continue;
          if (s.grid.isWalkable({ tx: tx - 3, ty }) && s.grid.isWalkable({ tx: tx + 3, ty })) {
            from = { tx: tx - 3, ty }; to = { tx: tx + 3, ty };
          } else if (s.grid.isWalkable({ tx, ty: ty - 3 }) && s.grid.isWalkable({ tx, ty: ty + 3 })) {
            from = { tx, ty: ty - 3 }; to = { tx, ty: ty + 3 };
          }
        }
      }
      if (from) { state = s; break; }
    }
    expect(from, 'no seed produced a flanked mesa (mapgen should guarantee mesas)').not.toBeNull();

    const id = state!.store.create({
      position: tileToWorldCenter(from!),
      movement: { target: tileToWorldCenter(to!), path: [], speed: 20 },
      faction: { team: 'player', faction: 'infantry' },
    });
    state = state!;
    const systems = orderSystems([makeMovementSystem()]);
    for (let i = 0; i < 400; i++) {
      runTick(state, systems);
      const p = state.store.get(id)!.components.position!;
      expect(state.grid.isWalkable(worldToTile(p)), `tick ${i}: standing on unwalkable`).toBe(true);
      if (!state.store.get(id)!.components.movement!.target) break; // arrived
    }
    expect(state.store.get(id)!.components.movement!.target).toBeNull(); // did arrive
  });

  it('separation: two units ordered to the same point do not stack', () => {
    const state: SimState = makeSimState({ seed: 7, mapWidth: 32, mapHeight: 32 });
    const dest = tileToWorldCenter({ tx: 16, ty: 16 });
    const mk = (tx: number) => state.store.create({
      position: tileToWorldCenter({ tx, ty: 16 }),
      movement: { target: { ...dest }, path: [], speed: 20 },
      faction: { team: 'player', faction: 'infantry' },
    });
    const a = mk(10), b = mk(22);
    const systems = orderSystems([makeMovementSystem()]);
    for (let i = 0; i < 300; i++) runTick(state, systems);
    const pa = state.store.get(a)!.components.position!;
    const pb = state.store.get(b)!.components.position!;
    const dist = Math.hypot(pa.wx - pb.wx, pa.wy - pb.wy);
    expect(dist).toBeGreaterThan(50); // not a single stacked point (was ~0 before FG-1)
  });
});

describe('pathfind — mission map sanity (mesas must not break the shipped missions)', () => {
  for (const [name, raw] of [['skirmish', skirmish], ['badlands', badlands], ['m1_first_light', m1], ['m2', m2], ['m3', m3], ['m4', m4], ['m5', m5], ['m6', m6]] as const) {
    it(`${name}: seeded entities + fields on walkable tiles; base→base path exists`, () => {
      const mission = loadMission(raw);
      const state = makeSimState({ seed: mission.map.seed, mapWidth: mission.map.width, mapHeight: mission.map.height });
      const meta = seedFromMission(state, mission, { units, structures, economy });

      const placed = [
        ...mission.player.buildings, ...mission.player.units,
        ...mission.enemies.flatMap(e => [...e.buildings, ...e.units]),
      ];
      for (const p of placed) {
        expect(state.grid.isWalkable({ tx: p.tx, ty: p.ty }), `${name}: "${p.type}" at (${p.tx},${p.ty}) is on unwalkable terrain`).toBe(true);
      }
      const fields = [...mission.fields, ...mission.enemies.flatMap(e => e.fields)];
      for (const f of fields) {
        for (let dy = 0; dy < f.h; dy++) for (let dx = 0; dx < f.w; dx++) {
          expect(state.grid.isWalkable({ tx: f.tx + dx, ty: f.ty + dy }), `${name}: field tile (${f.tx + dx},${f.ty + dy}) unwalkable`).toBe(true);
        }
      }
      expect(findPath(state.grid, meta.playerStartTile, meta.objectiveTile), `${name}: no path between the bases`).not.toBeNull();
    });
  }
});

describe('pathfind — unreachable orders stop safely', () => {
  it('an enclosed unit receiving an unreachable order never enters an impassable or blocked tile', () => {
    const state = makeSimState({ seed: 7, mapWidth: 32, mapHeight: 32 });
    let hole: { tx: number; ty: number } | null = null;
    for (let ty = 2; ty < 30 && !hole; ty++) {
      for (let tx = 2; tx < 30 && !hole; tx++) {
        let ok = true;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!state.grid.isWalkable({ tx: tx + dx, ty: ty + dy })) ok = false;
        }
        if (ok) hole = { tx, ty };
      }
    }
    expect(hole).not.toBeNull();
    const walls = new Set<string>();
    for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
      const t = { tx: hole!.tx + dx!, ty: hole!.ty + dy! };
      walls.add(`${t.tx},${t.ty}`);
      state.store.create({
        position: tileToWorldCenter(t),
        building: { onSlab: true, buildProgress: 100, powered: true, blocksPath: true },
        faction: { team: 'player', faction: 'wall' },
        health: { hp: 300, maxHp: 300 },
      });
    }
    const id = state.store.create({
      position: tileToWorldCenter(hole!),
      movement: { target: tileToWorldCenter({ tx: hole!.tx + 10, ty: hole!.ty }), path: [], speed: 20 },
      faction: { team: 'player', faction: 'infantry' },
      health: { hp: 20, maxHp: 20 },
    });
    const systems = orderSystems([makeMovementSystem()]);
    for (let i = 0; i < 200; i++) {
      runTick(state, systems);
      const p = state.store.get(id)!.components.position!;
      const t = worldToTile(p);
      expect(state.grid.isWalkable(t), `tick ${i}: entered impassable (${t.tx},${t.ty})`).toBe(true);
      expect(walls.has(`${t.tx},${t.ty}`), `tick ${i}: entered wall (${t.tx},${t.ty})`).toBe(false);
    }
    expect(state.store.get(id)!.components.movement!.target).toBeNull();
    expect(worldToTile(state.store.get(id)!.components.position!)).toEqual(hole);
  });

  it('a blocked raw target is not used as the arrival point (unit stays on walkable ground)', () => {
    const state = makeSimState({ seed: 42, mapWidth: 32, mapHeight: 32 });
    const blocked = { tx: 16, ty: 10 };
    state.store.create({
      position: tileToWorldCenter(blocked),
      building: { onSlab: true, buildProgress: 100, powered: true, blocksPath: true },
      faction: { team: 'player', faction: 'wall' },
      health: { hp: 300, maxHp: 300 },
    });
    const from = { tx: 10, ty: 10 };
    const id = state.store.create({
      position: tileToWorldCenter(from),
      movement: { target: tileToWorldCenter(blocked), path: [], speed: 20 },
      faction: { team: 'player', faction: 'infantry' },
    });
    const systems = orderSystems([makeMovementSystem()]);
    for (let i = 0; i < 400; i++) {
      runTick(state, systems);
      const t = worldToTile(state.store.get(id)!.components.position!);
      expect(`${t.tx},${t.ty}` === '16,10', `tick ${i}: standing on the wall`).toBe(false);
      expect(state.grid.isWalkable(t), `tick ${i}: standing on impassable`).toBe(true);
      if (!state.store.get(id)!.components.movement!.target) break;
    }
    const end = worldToTile(state.store.get(id)!.components.position!);
    expect(end).not.toEqual(blocked);
    expect(state.grid.isWalkable(end)).toBe(true);
  });
});
