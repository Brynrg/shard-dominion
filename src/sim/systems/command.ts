// ── Command system: drains input intents → sim state changes ──────────────────
// Runs FIRST in SYSTEM_ORDER (before movement, harvest, …). Intents arrive already
// in WORLD space (the view converted them), so this system is screen-blind: no
// camera, no DOM. Confirmation markers are exposed on the returned object for the
// renderer to draw — they are NOT stashed on SimState.
import type { SimState } from '../state.js';
import { teamTier } from '../tech.js';
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

export function makeCommandSystem(queue: { drain(): CommandIntent[] }, structures: StructureDef[], heroIds: readonly string[] = ['warden', 'vane']): CommandSystem {
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
        // FG-7: which side is issuing this intent (multiplayer seats tag theirs).
        const actor: 'player' | 'enemy' = intent.team ?? 'player';
        const foe: 'player' | 'enemy' = actor === 'player' ? 'enemy' : 'player';
        switch (intent.type) {
          case 'select': {
            if (intent.worldRect) {
              // Selection is SEAT-SCOPED (FG-7): a side can only (de)select its own
              // entities, so two players' selections never trample each other.
              const { minWx, minWy, maxWx, maxWy } = intent.worldRect;
              for (const e of state.store.all()) {
                const pos = e.components.position;
                if (!pos || e.components.faction?.team !== actor) continue;
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
                if (!pos || e.components.faction?.team !== actor) continue; // own side only (FG-7)
                const d = Math.hypot(pos.wx - intent.target.wx, pos.wy - intent.target.wy);
                if (d < closestDist) {
                  closestDist = d;
                  closest = e;
                }
              }
              for (const e of state.store.all()) {
                if (e.components.selection && e.components.faction?.team === actor) e.components.selection.selected = false;
              }
              if (closest) closest.components.selection = { selected: true };
            }
            break;
          }

          case 'deselect': {
            for (const e of state.store.all()) {
              if (e.components.selection && e.components.faction?.team === actor) e.components.selection.selected = false;
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
              if (e.components.faction?.team !== foe) continue;
              const pos = e.components.position;
              if (!pos || (e.components.health && e.components.health.hp <= 0)) continue;
              const d = Math.hypot(pos.wx - intent.target.wx, pos.wy - intent.target.wy);
              if (d < ed) { ed = d; enemy = e; }
            }
            const key = `${intent.tile.tx},${intent.tile.ty}`;
            const isShard = state.grid.terrainAt(intent.tile) === 'SHARD' || (state.shardDensity.get(key) ?? 0) > 0;

            for (const e of state.store.all()) {
              if (!e.components.selection?.selected) continue;
              if (e.components.faction?.team !== actor) continue;
              if (e.components.building) {
                // Rally point (FG-1): ground-order on a selected PRODUCER building sets
                // where its freshly-built units gather. Buildings still never move.
                if (e.components.production && !enemy && !isShard) {
                  e.components.production = { ...e.components.production, rally: intent.target };
                }
                continue;
              }
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

          case 'attack-move': {
            // Advance to the point, HOLDING to fight anything combatTargeting acquires
            // en route (movement skips stepping while attackMove && combat.targetId).
            for (const e of state.store.all()) {
              if (!e.components.selection?.selected) continue;
              if (e.components.faction?.team !== actor) continue;
              if (e.components.building) continue;
              if (!e.components.combat) continue; // only armed units attack-move
              if (!e.components.movement) e.components.movement = { target: null, path: [], speed: 10 };
              e.components.movement.target = intent.target;
              e.components.movement.pathGoal = null; // force a fresh path
              e.components.movement.attackMove = true;
              e.components.combat.targetId = null;   // re-acquire nearest en route
              if (e.components.harvest) e.components.harvest.state = 'IDLE';
            }
            markers.push({ target: intent.target, remaining: MARKER_LIFETIME });
            break;
          }

          case 'stop': {
            // Halt: drop movement orders, paths, attack-move and combat targets.
            for (const e of state.store.all()) {
              if (!e.components.selection?.selected) continue;
              if (e.components.faction?.team !== actor) continue;
              if (e.components.building) continue;
              if (e.components.movement) {
                e.components.movement = { ...e.components.movement, target: null, path: [], pathGoal: null, attackMove: false };
              }
              if (e.components.combat) e.components.combat.targetId = null;
              if (e.components.harvest) e.components.harvest.state = 'IDLE';
            }
            break;
          }

          case 'select-type': {
            // Double-click: select every player unit of the kind under the cursor.
            let kind: string | null = null;
            let kd = TILE_SUBUNITS * 0.9;
            for (const e of state.store.all()) {
              if (e.components.faction?.team !== actor || e.components.building) continue;
              const pos = e.components.position;
              if (!pos) continue;
              const d = Math.hypot(pos.wx - intent.target.wx, pos.wy - intent.target.wy);
              if (d < kd) { kd = d; kind = e.components.faction.faction; }
            }
            for (const e of state.store.all()) {
              const isMatch = kind !== null &&
                e.components.faction?.team === actor &&
                e.components.faction?.faction === kind &&
                !e.components.building;
              if (isMatch) e.components.selection = { selected: true };
              else if (e.components.selection?.selected && e.components.faction?.team === actor) e.components.selection = { selected: false };
            }
            break;
          }

          case 'deploy': {
            // Deploy MCV to Construction Yard
            const conYardDef = structures.find(s => s.id === 'construction_yard');
            const conYardHp = conYardDef?.hp ?? 2000;
            for (const e of state.store.all()) {
              const faction = e.components.faction;
              if (faction?.faction === 'mcv' && faction.team === actor) {
                e.components.faction = { team: actor, faction: 'construction_yard' };
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
            // Tech gate (XP-1): T2/T3 structures need the HQ tier. Sim-authoritative.
            if ((structure.tier ?? 1) > teamTier(state, actor)) break;

            const result = validatePlacement(state, structure, intent.tile);
            if (!result.valid) break;

            // Charge the player's bank; reject the build if it can't be afforded.
            const bank = state.store.all().find(e =>
              e.components.faction?.team === actor && e.components.economy)?.components.economy;
            const cost = structure.cost ?? 0;
            if (cost > 0) {
              if (!bank || bank.credits < cost) break;
              bank.credits -= cost;
            }

            // Spawn the structure at the tile centre (contract fn, no inline math).
            // Per-kind components (FG-2): barracks trains combat units; a built
            // Refinery is a dock + storage + harvester producer with NO free
            // harvester and NO starting credits (the de-bundled RFC decision);
            // a Defense Turret is a building that fights (combat, no movement).
            const tileCenter = tileToWorldCenter(intent.tile);
            const extras: Record<string, unknown> = {};
            if (structure.id === 'barracks' || structure.id === 'war_factory') {
              extras.production = { queue: [], progress: 0 };
            } else if (structure.id === 'refinery') {
              extras.production = { queue: [], progress: 0, current: null };
              extras.economy = { credits: 0, refineryStorage: 0, maxStorage: 1500 };
            } else if (structure.id === 'defense_turret') {
              extras.combat = { weaponId: 'raider_cannon', cooldownRemaining: 0, targetId: null };
            }
            state.store.create({
              position: tileCenter,
              building: { onSlab: false, buildProgress: 100, powered: true, ...(structure.blocksPath ? { blocksPath: true } : {}) },
              faction: { team: actor, faction: intent.structureId },
              power: { powerSupply: structure.powerSupply, powerDemand: structure.powerDemand, powered: true },
              health: { hp: structure.hp, maxHp: structure.hp },
              armor: { armorClass: 'BUILDING' },
              ...extras,
            });
            markers.push({ target: tileCenter, remaining: MARKER_LIFETIME });
            break;
          }

          case 'repair': {
            // Toggle repair on the selected damaged player buildings (FG-2).
            for (const e of state.store.all()) {
              if (!e.components.selection?.selected) continue;
              if (e.components.faction?.team !== actor) continue;
              const b = e.components.building; const h = e.components.health;
              if (!b || !h) continue;
              if (h.hp >= h.maxHp) { b.repairing = false; continue; }
              b.repairing = !b.repairing;
            }
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
          case 'upgrade-hq': {
            // Advance the actor's Construction Yard one tier (charged up-front,
            // ticked by the construction system). One upgrade at a time.
            const yard = state.store.all().find(e =>
              e.components.faction?.team === actor &&
              e.components.faction?.faction === 'construction_yard' && e.components.tech);
            const techC = yard?.components.tech;
            if (!yard || !techC || techC.upgradingTo != null || techC.tier >= 3) break;
            const yardDef = structures.find(st => st.id === 'construction_yard');
            const step = yardDef?.tierUpgrades?.find(u => u.toTier === techC.tier + 1);
            if (!step) break;
            const bank = state.store.all().find(e =>
              e.components.faction?.team === actor && e.components.economy)?.components.economy;
            const cellPrice = step.cells ?? 0;          // XP-2: T3 charges Cells
            if (!bank || bank.credits < step.cost || (bank.cells ?? 0) < cellPrice) break;
            bank.credits -= step.cost;
            if (cellPrice > 0) bank.cells = (bank.cells ?? 0) - cellPrice;
            yard.components.tech = { tier: techC.tier, upgradingTo: step.toTier, ticksLeft: Math.max(1, Math.round(step.seconds * 20)) };
            break;
          }
          case 'train': {
            // Hero cap (FG-5): ONE living Warden at a time (also not while queued).
            if (heroIds.includes(intent.unitId)) { // XP-3: ONE living/queued hero per side
              const heroId = intent.unitId;
              const heroExists = state.store.all().some(e =>
                (e.components.faction?.team === actor && e.components.faction?.faction === heroId && (e.components.health?.hp ?? 0) > 0) ||
                (e.components.faction?.team === actor && e.components.production &&
                  (e.components.production.queue.includes(heroId) || e.components.production.current === heroId)));
              if (heroExists) break;
            }
            // Route by unit type (FG-3): Harvesters → Refinery, vehicles → War
            // Factory, foot troops → Barracks. Find the matching player producer.
            const producerFaction =
              intent.unitId === 'harvester' ? 'refinery' :
              (intent.unitId === 'scout_vehicle' || intent.unitId === 'assault_tank') ? 'war_factory' :
              'barracks';
            const producer = state.store.all().find(e =>
              e.components.faction?.team === actor &&
              e.components.faction?.faction === producerFaction &&
              e.components.production);
            if (producer && producer.components.production) {
              const p = producer.components.production;
              producer.components.production = { ...p, queue: [...p.queue, intent.unitId] };
            }
            break;
          }
        }
      }
    },
  };
}
