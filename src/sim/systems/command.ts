// ── Command system: drains input intents → sim state changes ──────────────────
// Runs FIRST in SYSTEM_ORDER (before movement, harvest, …). Intents arrive already
// in WORLD space (the view converted them), so this system is screen-blind: no
// camera, no DOM. Confirmation markers are exposed on the returned object for the
// renderer to draw — they are NOT stashed on SimState.
import type { SimState } from '../state.js';
import type { CommandIntent } from '../../view/input.js';
import { TILE_SUBUNITS } from '../coords.js';

/** Confirmation marker: a short-lived visual at a target location (view reads this). */
export interface ConfirmationMarker {
  target: { wx: number; wy: number };
  remaining: number; // ticks left of its ~0.5s life
}

export interface CommandSystem {
  readonly name: 'command';
  run(state: SimState): void;
  /** Live confirmation markers, for the renderer. */
  readonly markers: ConfirmationMarker[];
}

const MARKER_LIFETIME = 10 as const; // ~0.5s at 20Hz

export function makeCommandSystem(queue: { drain(): CommandIntent[] }): CommandSystem {
  const markers: ConfirmationMarker[] = [];

  return {
    name: 'command' as const,
    markers,
    run(state: SimState): void {
      // Age out markers from PRIOR ticks first, so a marker created by this tick's
      // move order still shows for its full lifetime.
      for (let i = markers.length - 1; i >= 0; i--) {
        const m = markers[i];
        if (!m) continue;
        m.remaining -= 1;
        if (m.remaining <= 0) markers.splice(i, 1);
      }

      for (const intent of queue.drain()) {
        switch (intent.type) {
          case 'select': {
            if (intent.worldRect) {
              const { minWx, minWy, maxWx, maxWy } = intent.worldRect;
              for (const e of state.store.all()) {
                const pos = e.components.position;
                if (!pos) continue;
                const inside = pos.wx >= minWx && pos.wx <= maxWx && pos.wy >= minWy && pos.wy <= maxWy;
                if (inside) {
                  e.components.selection = { selected: true };
                } else if (e.components.selection) {
                  e.components.selection.selected = false;
                }
              }
            } else if (intent.target) {
              // Single click → select the closest entity within a small hitbox, deselect the rest.
              let closest: ReturnType<typeof state.store.all>[number] | null = null;
              let closestDist = TILE_SUBUNITS * 0.75; // hitbox radius
              for (const e of state.store.all()) {
                const pos = e.components.position;
                if (!pos) continue;
                const d = Math.hypot(pos.wx - intent.target.wx, pos.wy - intent.target.wy);
                if (d < closestDist) {
                  closestDist = d;
                  closest = e;
                }
              }
              for (const e of state.store.all()) {
                if (e.components.selection) e.components.selection.selected = false;
              }
              if (closest) closest.components.selection = { selected: true };
            }
            break;
          }

          case 'deselect': {
            for (const e of state.store.all()) {
              if (e.components.selection) e.components.selection.selected = false;
            }
            break;
          }

          case 'move': {
            for (const e of state.store.all()) {
              if (!e.components.selection?.selected) continue;
              if (!e.components.movement) {
                e.components.movement = { target: null, path: [], speed: 10 };
              }
              e.components.movement.target = intent.target;
              // A manual move suspends the harvester FSM (S2: keep it simple; full
              // order/FSM arbitration is a later slice). IDLE makes the harvest
              // system leave this unit alone so it obeys the player's order.
              if (e.components.harvest) {
                e.components.harvest.state = 'IDLE';
                e.components.harvest.targetTile = null;
                e.components.harvest.targetRefinery = null;
              }
              markers.push({ target: intent.target, remaining: MARKER_LIFETIME });
            }
            break;
          }
        }
      }
    },
  };
}
