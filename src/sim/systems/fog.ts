// ── Fog system: compute visible + explored tile sets from player units' vision ──
// Sim-pure (state only; no DOM/Date/Math.random). Exposes visible/explored sets
// on the returned object (NOT on SimState) — like the command system exposes markers.
import type { SimState } from '../state.js';
import { worldToTile } from '../coords.js';

const VISION_TILES = 6 as const;

export interface FogSystem {
  name: 'fog';
  run(state: SimState): void;
  /** Tile keys "tx,ty" currently visible (recomputed each tick). */
  readonly visible: Set<string>;
  /** Tile keys "tx,ty" ever seen (accumulates). */
  readonly explored: Set<string>;
}

export function makeFogSystem(viewerTeam: 'player' | 'enemy' = 'player'): FogSystem {
  const visible = new Set<string>();
  const explored = new Set<string>();

  return {
    name: 'fog' as const,
    visible,
    explored,
    run(state: SimState): void {
      visible.clear();

      for (const e of state.store.all()) {
        const faction = e.components.faction;
        if (!faction || faction.team !== viewerTeam) continue;

        const pos = e.components.position;
        if (!pos) continue;

        const t = worldToTile(pos);
        const minTx = Math.max(0, t.tx - VISION_TILES);
        const maxTx = Math.min(state.grid.width - 1, t.tx + VISION_TILES);
        const minTy = Math.max(0, t.ty - VISION_TILES);
        const maxTy = Math.min(state.grid.height - 1, t.ty + VISION_TILES);

        for (let ty = minTy; ty <= maxTy; ty++) {
          for (let tx = minTx; tx <= maxTx; tx++) {
            const dx = tx - t.tx;
            const dy = ty - t.ty;
            const distSq = dx * dx + dy * dy;

            // Add to explored if within bounding box (ever seen)
            explored.add(`${tx},${ty}`);

            // Add to visible only if within circular radius
            if (distSq <= VISION_TILES * VISION_TILES) {
              visible.add(`${tx},${ty}`);
            }
          }
        }
      }
    },
  };
}
