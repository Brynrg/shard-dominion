import { makeGridManager, makeTerrainGrid, TILE_TYPES } from './grid.js';
import { generateMap } from './map.js';
import { hashInts } from './hash.js';
import { asEntityId } from './ids.js';

describe('GridManager contract — the single spatial index (per sim)', () => {
  it('occupancy round-trips and bounds are safe', () => {
    const grid = makeGridManager(makeTerrainGrid(8, 8));
    const id = asEntityId(42);
    expect(grid.occupantAt({ tx: 3, ty: 3 })).toBeNull();
    grid.setOccupant({ tx: 3, ty: 3 }, id);
    expect(grid.occupantAt({ tx: 3, ty: 3 })).toBe(id);
    grid.setOccupant({ tx: 3, ty: 3 }, null);
    expect(grid.occupantAt({ tx: 3, ty: 3 })).toBeNull();
    expect(grid.occupantAt({ tx: -1, ty: 0 })).toBeNull();
    expect(grid.inBounds({ tx: 8, ty: 0 })).toBe(false);
  });

  it('two independent sims each own an isolated grid (multi-sim allowed)', () => {
    const a = makeGridManager(makeTerrainGrid(8, 8));
    const b = makeGridManager(makeTerrainGrid(8, 8));
    a.setOccupant({ tx: 1, ty: 1 }, asEntityId(7));
    expect(a.occupantAt({ tx: 1, ty: 1 })).toBe(asEntityId(7));
    expect(b.occupantAt({ tx: 1, ty: 1 })).toBeNull(); // isolated
  });

  it('IMPASSABLE is not walkable; SAND is', () => {
    const terrain = makeTerrainGrid(4, 4, 'SAND');
    terrain.set({ tx: 2, ty: 2 }, 'IMPASSABLE');
    const grid = makeGridManager(terrain);
    expect(grid.isWalkable({ tx: 0, ty: 0 })).toBe(true);
    expect(grid.isWalkable({ tx: 2, ty: 2 })).toBe(false);
  });
});

describe('generateMap contract — one seeded path, reproducible', () => {
  const hashOf = (seed: number): number => {
    const g = generateMap({ seed, width: 32, height: 32 });
    const codes: number[] = [];
    for (let ty = 0; ty < g.height; ty++) {
      for (let tx = 0; tx < g.width; tx++) codes.push(TILE_TYPES.indexOf(g.get({ tx, ty })));
    }
    return hashInts(codes);
  };

  it('same seed → identical map', () => {
    expect(hashOf(777)).toBe(hashOf(777));
  });
  it('different seed → different map', () => {
    expect(hashOf(1)).not.toBe(hashOf(2));
  });
});
