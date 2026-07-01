// ── Command system: drains input intents → sim state changes ──────────────────
// Runs FIRST in SYSTEM_ORDER (before movement, harvest, …). Intents arrive already
// in WORLD space (the view converted them), so this system is screen-blind: no
// camera, no DOM. Confirmation markers are exposed on the returned object for the
// renderer to draw — they are NOT stashed on SimState.
import type { SimState } from '../state.js';
import type { CommandIntent } from '../../view/input.js';
import { TILE_SUBUNITS, tileToWorldCenter, worldToTile } from '../coords.js';
import type { StructureDef } from '../../loaders/structures.js';

/** Confirmation marker: a short-lived visual at a target location (view reads this). */
export interface ConfirmationMarker {
  target: { wx: number; wy: number };
  remaining: number; // ticks left of its ~0.5s life
}

/** Placement validation result. */
export interface PlacementResult {
  valid: boolean;
  reason?: string;
}

export function validatePlacement(
  state: SimState,
  structure: StructureDef,
  tile: { tx: number; ty: number },
): PlacementResult {
  // Check terrain is buildable (not impassable)
  const terrain = state.grid.terrainAt(tile);
  if (terrain === 'IMPASSABLE') {
    return { valid: false, reason: 'INVALID TERRAIN' };
  }

  // Check if tile is blocked by another entity
  for (const e of state.store.all()) {
    const pos = e.components.position;
    if (!pos) continue;
    const entityTile = worldToTile(pos);
    if (entityTile.tx === tile.tx && entityTile.ty === tile.ty) {
      return { valid: false, reason: 'BLOCKED' };
    }
  }

  // Check build radius from a ConYard (simplified: any ConYard within 10 tiles)
  let hasConYardRadius = false;
  for (const e of state.store.all()) {
    const faction = e.components.faction;
    if (faction?.faction === 'construction_yard') {
      const pos = e.components.position;
      if (pos) {
        const conYardTile = worldToTile(pos);
        const dist = Math.abs(conYardTile.tx - tile.tx) + Math.abs(conYardTile.ty - tile.ty);
        if (dist <= 10) {
          hasConYardRadius = true;
          break;
        }
      }
    }
  }

  if (!hasConYardRadius) {
    return { valid: false, reason: 'OUTSIDE BUILD RADIUS' };
  }

  // Check credits (simplified: assume we have enough if we're placing)
  // Full credit check happens in construction system

  return { valid: true };
}

export interface CommandSystem {
  readonly name: 'command';
  run(state: SimState): void;
  /** Live confirmation markers, for the renderer. */
  readonly markers: ConfirmationMarker[];
}

const MARKER_LIFETIME = 10 as const; // ~0.5s at 20Hz

export function makeCommandSystem(queue: { drain(): CommandIntent[] }, structures: StructureDef[]): CommandSystem {
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

          case 'deploy': {
            // Deploy MCV to Construction Yard
            for (const e of state.store.all()) {
              const faction = e.components.faction;
              if (faction?.faction === 'mcv') {
                e.components.faction = { team: 'player', faction: 'construction_yard' };
                e.components.building = { onSlab: true, buildProgress: 100, powered: true };
                e.components.construction = { queue: [], progress: 0, currentStructureId: null };
                e.components.power = { powerSupply: 0, powerDemand: 0, powered: true };
                markers.push({ target: e.components.position!, remaining: MARKER_LIFETIME });
                break;
              }
            }
            break;
          }

          case 'place-structure': {
            const structure = structures.find((s) => s.id === intent.structureId);
            if (!structure) break;

            const result = validatePlacement(state, structure, intent.tile);
            if (result.valid) {
              // Spawn the structure at the tile centre (contract fn, no inline math).
              const tileCenter = tileToWorldCenter(intent.tile);
              state.store.create({
                position: tileCenter,
                building: { onSlab: false, buildProgress: 100, powered: false },
                faction: { team: 'player', faction: intent.structureId },
                power: {
                  powerSupply: structure.powerSupply,
                  powerDemand: structure.powerDemand,
                  powered: false,
                },
              });
              markers.push({ target: tileCenter, remaining: MARKER_LIFETIME });
            }
            break;
          }
        }
      }
    },
  };
}
