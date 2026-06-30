// ── Movement system: minimal entity mover for S0 ──────────────────────────────
// Reads state only; does NOT construct anything (lint will stop you).
import type { SimState } from '../state.js';
import { world } from '../coords.js';

export function makeMovementSystem(): { name: 'movement'; run(state: SimState): void } {
  return {
    name: 'movement' as const,
    run(state: SimState): void {
      for (const e of state.store.all()) {
        const pos = e.components.position;
        const movement = e.components.movement;
        if (!pos || !movement || !movement.target || movement.speed <= 0) continue;

        const target = movement.target;
        const dx = target.wx - pos.wx;
        const dy = target.wy - pos.wy;
        const distSq = dx * dx + dy * dy;

        // If we're close enough, snap to target
        if (distSq <= movement.speed * movement.speed) {
          e.components.position = target;
          e.components.movement = { ...movement, target: null };
          continue;
        }

        // Move toward target by speed units this tick
        const dist = Math.sqrt(distSq);
        const stepX = (dx / dist) * movement.speed;
        const stepY = (dy / dist) * movement.speed;
        e.components.position = world(pos.wx + stepX, pos.wy + stepY);
      }
    },
  };
}
