// ── CONTRACT: the THREE coordinate spaces (conversion-only; no inline math) ──
// Every position in the sim is WORLD. Terrain/path/fog/placement read TILE.
// Only the renderer touches SCREEN. All conversion goes through THIS file —
// no system computes a tile index from a world value inline. This single rule
// makes the pixel-vs-tile bug class (which broke fog/harvest/pathfinding in
// the prior builds) structurally impossible.

/** 1/256-tile fixed point. WORLD positions are integers in these subunits. */
export const TILE_SUBUNITS = 256 as const;
/** Screen pixels per tile at zoom 1. */
export const TILE_SIZE_PX = 32 as const;
/** log2(TILE_SUBUNITS); WORLD→TILE is a right shift by this. */
const TILE_SHIFT = 8 as const;

/** WORLD — integer fixed-point; the canonical space for all entity positions. */
export interface WorldPos {
  readonly wx: number;
  readonly wy: number;
}
/** TILE — integer tile indices; terrain, pathfinding, fog, placement. */
export interface TilePos {
  readonly tx: number;
  readonly ty: number;
}
/** SCREEN — pixels; render only. */
export interface ScreenPos {
  readonly sx: number;
  readonly sy: number;
}
/** Camera origin (WORLD units) + zoom. */
export interface Camera {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

export const world = (wx: number, wy: number): WorldPos => ({ wx, wy });
export const tile = (tx: number, ty: number): TilePos => ({ tx, ty });

/** WORLD → TILE. Positions are non-negative; `>> TILE_SHIFT` = floor-divide by 256. */
export function worldToTile(p: WorldPos): TilePos {
  return { tx: p.wx >> TILE_SHIFT, ty: p.wy >> TILE_SHIFT };
}

/** TILE → WORLD at the tile's centre (the canonical "go to this tile" target). */
export function tileToWorldCenter(t: TilePos): WorldPos {
  const half = TILE_SUBUNITS >> 1;
  return { wx: t.tx * TILE_SUBUNITS + half, wy: t.ty * TILE_SUBUNITS + half };
}

const WORLD_PER_PX = TILE_SUBUNITS / TILE_SIZE_PX; // world units per screen px @ zoom 1

/** WORLD → SCREEN relative to the camera (renderer adds any viewport offset). */
export function worldToScreen(p: WorldPos, cam: Camera): ScreenPos {
  return {
    sx: ((p.wx - cam.x) / WORLD_PER_PX) * cam.zoom,
    sy: ((p.wy - cam.y) / WORLD_PER_PX) * cam.zoom,
  };
}

/** SCREEN → WORLD (inverse of worldToScreen). */
export function screenToWorld(p: ScreenPos, cam: Camera): WorldPos {
  return {
    wx: Math.round((p.sx / cam.zoom) * WORLD_PER_PX + cam.x),
    wy: Math.round((p.sy / cam.zoom) * WORLD_PER_PX + cam.y),
  };
}

/** SCREEN → TILE (convenience; still routed through the contract). */
export function screenToTile(p: ScreenPos, cam: Camera): TilePos {
  return worldToTile(screenToWorld(p, cam));
}
