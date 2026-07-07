// ── Command system: drains input intents → sim state changes ──────────────────
// Runs FIRST in SYSTEM_ORDER (before movement, harvest, …). Intents arrive already
// in WORLD space (the view converted them), so this system is screen-blind: no
// camera, no DOM. Confirmation markers are exposed on the returned object for the
// renderer to draw — they are NOT stashed on SimState.
import type { SimState } from '../state.js';
import type { CommandIntent } from '../../view/input.js';
import { TILE_SUBUNITS, tileToWorldCenter, worldToTile } from '../coords.js';
import type { StructureDef } from '../../loaders/structures.js';
import type { EntityId } from '../ids.js';

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
  /** Control groups: Map<groupNumber, EntityId[]> */
  readonly groups: Map<number, EntityId[]>;
}

const MARKER_LIFETIME = 10 as const; // ~0.5s at 20Hz

export function makeCommandSystem(queue: { drain(): CommandIntent[] }, structures: StructureDef[]): CommandSystem {
  const markers: ConfirmationMarker[] = [];
  const groups = new Map<number, EntityId[]>();

  return {
    name: 'command' as const,
    markers,
    groups,
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
              if (e.components.building) continue; // buildings never move
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

          case 'order': {
            // Context-sensitive right-click. Resolve what's at the point:
            //   enemy entity → attack (drive in; combatTargeting auto-fires in range)
            //   Shard tile   → send the selected harvester to mine there
            //   open ground  → move
            let enemy: ReturnType<typeof state.store.all>[number] | null = null;
            let ed = TILE_SUBUNITS * 0.9;
            for (const e of state.store.all()) {
              if (e.components.faction?.team !== 'enemy') continue;
              const pos = e.components.position;
              if (!pos || (e.components.health && e.components.health.hp <= 0)) continue;
              const d = Math.hypot(pos.wx - intent.target.wx, pos.wy - intent.target.wy);
              if (d < ed) { ed = d; enemy = e; }
            }
            const key = `${intent.tile.tx},${intent.tile.ty}`;
            const isShard = state.grid.terrainAt(intent.tile) === 'SHARD' || (state.shardDensity.get(key) ?? 0) > 0;

            for (const e of state.store.all()) {
              if (!e.components.selection?.selected) continue;
              if (e.components.faction?.team !== 'player') continue;
              if (e.components.building) continue; // buildings don't move/attack — they stay put
              if (enemy && e.components.combat) {
                const epos = enemy.components.position!;
                if (!e.components.movement) e.components.movement = { target: null, path: [], speed: 10 };
                e.components.movement.target = { wx: epos.wx, wy: epos.wy };
                e.components.combat.targetId = enemy.id;
                if (e.components.harvest) e.components.harvest.state = 'IDLE';
              } else if (isShard && e.components.harvest) {
                e.components.harvest.state = 'SEEK';
                e.components.harvest.targetTile = { tx: intent.tile.tx, ty: intent.tile.ty };
                e.components.harvest.targetRefinery = null;
                if (e.components.movement) e.components.movement.target = null;
              } else {
                if (!e.components.movement) e.components.movement = { target: null, path: [], speed: 10 };
                e.components.movement.target = intent.target;
                if (e.components.harvest) {
                  e.components.harvest.state = 'IDLE';
                  e.components.harvest.targetTile = null;
                  e.components.harvest.targetRefinery = null;
                }
              }
            }
            markers.push({ target: intent.target, remaining: MARKER_LIFETIME });
            break;
          }

          case 'deploy': {
            // Deploy MCV to Construction Yard
            const conYardDef = structures.find(s => s.id === 'construction_yard');
            const conYardHp = conYardDef?.hp ?? 2000;
            for (const e of state.store.all()) {
              const faction = e.components.faction;
              if (faction?.faction === 'mcv') {
                e.components.faction = { team: 'player', faction: 'construction_yard' };
                e.components.building = { onSlab: true, buildProgress: 100, powered: true };
                e.components.construction = { queue: [], progress: 0, currentStructureId: null };
                e.components.power = { powerSupply: 0, powerDemand: 0, powered: true };
                e.components.health = { hp: conYardHp, maxHp: conYardHp };
                e.components.armor = { armorClass: 'BUILDING' };
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
            if (!result.valid) break;

            // Charge the player's bank; reject the build if it can't be afforded.
            const bank = state.store.all().find(e =>
              e.components.faction?.team === 'player' && e.components.economy)?.components.economy;
            const cost = structure.cost ?? 0;
            if (cost > 0) {
              if (!bank || bank.credits < cost) break;
              bank.credits -= cost;
            }

            // Spawn the structure at the tile centre (contract fn, no inline math).
            // Producer structures (barracks) get a production component so T/R work.
            const tileCenter = tileToWorldCenter(intent.tile);
            const isProducer = structure.id === 'barracks';
            state.store.create({
              position: tileCenter,
              building: { onSlab: false, buildProgress: 100, powered: true },
              faction: { team: 'player', faction: intent.structureId },
              power: { powerSupply: structure.powerSupply, powerDemand: structure.powerDemand, powered: true },
              health: { hp: structure.hp, maxHp: structure.hp },
              armor: { armorClass: 'BUILDING' },
              ...(isProducer ? { production: { queue: [], progress: 0 } } : {}),
            });
            markers.push({ target: tileCenter, remaining: MARKER_LIFETIME });
            break;
          }

          case 'assign-group': {
            const selectedIds: EntityId[] = [];
            for (const e of state.store.all()) {
              if (e.components.selection?.selected) {
                selectedIds.push(e.id);
              }
            }
            groups.set(intent.group, selectedIds);
            break;
          }

          case 'recall-group': {
            // Deselect all first
            for (const e of state.store.all()) {
              if (e.components.selection) {
                e.components.selection.selected = false;
              }
            }
            // Recall the stored group (skip dead/removed entities)
            const stored = groups.get(intent.group);
            if (stored) {
              for (const id of stored) {
                const e = state.store.get(id);
                if (e && e.components.selection) {
                  e.components.selection.selected = true;
                }
              }
            }
            break;
          }
          case 'train': {
            // Append to the player's barracks queue (first player entity with a production component)
            const barracks = state.store.all().find(e =>
              e.components.faction?.team === 'player' && e.components.production);
            if (barracks && barracks.components.production) {
              const p = barracks.components.production;
              barracks.components.production = { ...p, queue: [...p.queue, intent.unitId] };
            }
            break;
          }
        }
      }
    },
  };
}
