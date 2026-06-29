// ── CONTRACT: the ONE map path, seeded ───────────────────────────────────────
// `generateMap(seed)` is the only function that produces terrain. Its output is
// written once into sim state and never shadowed by a second `tiles[]`. Same
// seed → same map (deterministic via the seeded PRNG). This is a minimal but
// real generator; richer generation is a later slice, but the CONTRACT (one
// path, seeded, reproducible) is pinned now.
import { makeRng } from './rng.js';
import { makeTerrainGrid, type TerrainGrid, type TileType } from './grid.js';

export interface MapConfig {
  readonly seed: number;
  readonly width: number;
  readonly height: number;
}

export function generateMap(cfg: MapConfig): TerrainGrid {
  const { seed, width, height } = cfg;
  const rng = makeRng(seed);
  const grid = makeTerrainGrid(width, height, 'SAND');

  // Scatter deterministic terrain: rock outcrops (buildable hard ground),
  // deep-sand pockets (worm country), and shard fields (the economy).
  const scatter = (type: TileType, count: number, clusterRadius: number): void => {
    for (let i = 0; i < count; i++) {
      const cx = rng.nextInt(width);
      const cy = rng.nextInt(height);
      const r = rng.nextInt(clusterRadius) + 1;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy <= r * r) grid.set({ tx: cx + dx, ty: cy + dy }, type);
        }
      }
    }
  };

  scatter('ROCK', Math.max(2, (width * height) / 800), 2);
  scatter('DEEP_SAND', Math.max(2, (width * height) / 1200), 3);
  scatter('SHARD', Math.max(2, (width * height) / 1500), 2);

  return grid;
}
