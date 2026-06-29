// ── CONTRACT: the ONE spatial index ──────────────────────────────────────────
// A single GridManager owns terrain + occupancy. No system keeps its own
// authoritative grid (the "two brains driving one car" failure that sank a
// prior build). Construction is guarded: a SECOND GridManager throws — making
// the duplicate-grid mistake a hard runtime error, not a silent divergence.
import type { TilePos } from './coords.js';
import type { EntityId } from './ids.js';

/** Six terrain types (per plan §8). Index in TILE_TYPES is the storage code. */
export const TILE_TYPES = ['SAND', 'ROCK', 'DUNE', 'DEEP_SAND', 'SHARD', 'IMPASSABLE'] as const;
export type TileType = (typeof TILE_TYPES)[number];

const TILE_CODE: Readonly<Record<TileType, number>> = Object.freeze(
  Object.fromEntries(TILE_TYPES.map((t, i) => [t, i])) as Record<TileType, number>,
);

/** Read-only terrain produced by the one map path (map.ts). */
export interface TerrainGrid {
  readonly width: number;
  readonly height: number;
  get(t: TilePos): TileType;
}

/** Mutable terrain used only by generateMap while building the grid. */
export interface MutableTerrainGrid extends TerrainGrid {
  set(t: TilePos, type: TileType): void;
}

export function makeTerrainGrid(width: number, height: number, fill: TileType = 'SAND'): MutableTerrainGrid {
  const codes = new Uint8Array(width * height).fill(TILE_CODE[fill]);
  const idx = (t: TilePos): number => t.ty * width + t.tx;
  return {
    width,
    height,
    get(t: TilePos): TileType {
      const code = codes[idx(t)];
      return TILE_TYPES[code ?? 0] ?? 'SAND';
    },
    set(t: TilePos, type: TileType): void {
      if (t.tx < 0 || t.ty < 0 || t.tx >= width || t.ty >= height) return;
      codes[idx(t)] = TILE_CODE[type];
    },
  };
}

const WALKABLE: Readonly<Record<TileType, boolean>> = Object.freeze({
  SAND: true,
  ROCK: true,
  DUNE: true,
  DEEP_SAND: true,
  SHARD: true,
  IMPASSABLE: false,
});

export interface GridManager {
  readonly width: number;
  readonly height: number;
  inBounds(t: TilePos): boolean;
  terrainAt(t: TilePos): TileType;
  isWalkable(t: TilePos): boolean;
  /** Occupancy: the single authoritative answer to "who is on this tile". */
  occupantAt(t: TilePos): EntityId | null;
  setOccupant(t: TilePos, id: EntityId | null): void;
}

// One spatial index PER SIM, owned by SimState (state.ts is the ONLY caller).
// "No second spatial index" is enforced by the ESLint `no-restricted-imports`
// rule scoped to src/sim/systems/** — a system that tries to construct a grid
// is a red build. Multi-sim (balance harness, replay) legitimately makes one
// grid each, so this is deliberately NOT a global singleton.
export function makeGridManager(terrain: TerrainGrid): GridManager {
  const { width, height } = terrain;
  const occ = new Int32Array(width * height).fill(0); // 0 = none; stores id otherwise
  const idx = (t: TilePos): number => t.ty * width + t.tx;
  const inBounds = (t: TilePos): boolean => t.tx >= 0 && t.ty >= 0 && t.tx < width && t.ty < height;

  return {
    width,
    height,
    inBounds,
    terrainAt: (t: TilePos): TileType => terrain.get(t),
    isWalkable: (t: TilePos): boolean => inBounds(t) && WALKABLE[terrain.get(t)],
    occupantAt: (t: TilePos): EntityId | null => {
      if (!inBounds(t)) return null;
      const v = occ[idx(t)] ?? 0;
      return v === 0 ? null : (v as EntityId);
    },
    setOccupant: (t: TilePos, id: EntityId | null): void => {
      if (!inBounds(t)) return;
      occ[idx(t)] = id ?? 0;
    },
  };
}
