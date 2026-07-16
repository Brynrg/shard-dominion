// ── Command system: drains input intents → sim state changes ──────────────────
// Runs FIRST in SYSTEM_ORDER (before movement, harvest, …). Intents arrive already
// in WORLD space (the view converted them), so this system is screen-blind: no
// camera, no DOM. Confirmation markers are exposed on the returned object for the
// renderer to draw — they are NOT stashed on SimState.
import type { SimState } from '../state.js';
import { teamTier } from '../tech.js';
import { structureComponents } from '../factory.js';
import { teamCredits, teamCells, spendCredits, spendCells } from '../ledger.js';
import { teamLedger } from './research.js';
import { SIM_TICK_RATE } from '../loop.js';
import type { Refinement } from '../../loaders/refinements.js';
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
  team: 'player' | 'enemy' = 'player',
): PlacementResult {
  // TP-3: validate the FULL footprint (the audit found anchor-only checks letting
  // 2×2 buildings overlap terrain, entities, and the map edge).
  const w = structure.footprint?.w ?? 1;
  const h = structure.footprint?.h ?? 1;
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const t = { tx: tile.tx + dx, ty: tile.ty + dy };
      if (t.tx < 0 || t.ty < 0 || t.tx >= state.grid.width || t.ty >= state.grid.height) {
        return { valid: false, reason: 'OFF THE MAP' };
      }
      if (state.grid.terrainAt(t) === 'IMPASSABLE') {
        return { valid: false, reason: 'INVALID TERRAIN' };
      }
      for (const e of state.store.all()) {
        const pos = e.components.position;
        if (!pos) continue;
        const et = worldToTile(pos);
        if (et.tx === t.tx && et.ty === t.ty) return { valid: false, reason: 'BLOCKED' };
      }
    }
  }

  // Build radius comes from an OWN-team ConYard (TP-3: the audit found any team's
  // yard granting radius).
  for (const e of state.store.all()) {
    const faction = e.components.faction;
    if (faction?.faction !== 'construction_yard' || faction.team !== team) continue;
    if ((e.components.health?.hp ?? 1) <= 0) continue; // absent health = alive
    const pos = e.components.position;
    if (!pos) continue;
    const ct = worldToTile(pos);
    if (Math.abs(ct.tx - tile.tx) + Math.abs(ct.ty - tile.ty) <= 10) return { valid: true };
  }
  return { valid: false, reason: 'OUTSIDE BUILD RADIUS' };
}

export interface CommandSystem {
  readonly name: 'command';
  run(state: SimState): void;
  /** Live confirmation markers, for the renderer. */
  readonly markers: ConfirmationMarker[];
  /** Control groups, SEAT-SCOPED (FG-7): keyed `${team}:${groupNumber}` so two
   *  multiplayer seats' group slots never collide. */
  readonly groups: Map<string, EntityId[]>;
}

const MARKER_LIFETIME = 10 as const; // ~0.5s at 20Hz

export function makeCommandSystem(queue: { drain(): CommandIntent[] }, structures: StructureDef[], heroIds: readonly string[] = ['warden', 'vane'], refinements: readonly Refinement[] = []): CommandSystem {
  const markers: ConfirmationMarker[] = [];
  const groups = new Map<string, EntityId[]>();
  // Idle-harvester cycling cursor per seat (like the groups map, this closure
  // state is rebuilt identically by replaying the same command log).
  const idleCursor = new Map<string, number>();
  // XP-7 Faction Strike: pending orbital splashes { at, ticksLeft } (deterministic).
  const strikes: { wx: number; wy: number; ticksLeft: number }[] = [];
  const STRIKE_COST_CELLS = 5;
  const ORDER_QUEUE_CAP = 8; // shift-queued waypoints per unit (v0.51)
  const STRIKE_DELAY = 60;      // 3s of warning
  const STRIKE_RADIUS = 2.5 * TILE_SUBUNITS;
  const STRIKE_DAMAGE = 250;

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

      // Resolve pending strikes (before new intents — deterministic order).
      for (let i = strikes.length - 1; i >= 0; i--) {
        const st = strikes[i]!;
        st.ticksLeft -= 1;
        if (st.ticksLeft > 0) continue;
        for (const e of state.store.all()) {
          const p = e.components.position; const h = e.components.health;
          if (!p || !h) continue;
          const d = Math.hypot(p.wx - st.wx, p.wy - st.wy);
          if (d <= STRIKE_RADIUS) h.hp -= STRIKE_DAMAGE * (1 - 0.5 * (d / STRIKE_RADIUS));
        }
        strikes.splice(i, 1);
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
              // Military-first (v0.51, beyond-WC3 QoL): when the box holds BOTH
              // combat units and support (harvesters/buildings), grab only the
              // fighters — boxing your army near the base never steals workers.
              const { minWx, minWy, maxWx, maxWy } = intent.worldRect;
              const inRect = (pos: { wx: number; wy: number }): boolean =>
                pos.wx >= minWx && pos.wx <= maxWx && pos.wy >= minWy && pos.wy <= maxWy;
              let hasMilitary = false;
              for (const e of state.store.all()) {
                const pos = e.components.position;
                if (!pos || e.components.faction?.team !== actor) continue;
                if (inRect(pos) && e.components.combat && !e.components.building && (e.components.health?.hp ?? 1) > 0) {
                  hasMilitary = true;
                  break;
                }
              }
              for (const e of state.store.all()) {
                const pos = e.components.position;
                if (!pos || e.components.faction?.team !== actor) continue;
                const military = !!e.components.combat && !e.components.building;
                const inside = inRect(pos) && (!hasMilitary || military);
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
            // Garrison (XP-4): right-click an OWN container (bunker/APC) → board it.
            let container: ReturnType<typeof state.store.all>[number] | null = null;
            let cd0 = TILE_SUBUNITS * 0.9;
            for (const e of state.store.all()) {
              if (e.components.faction?.team !== actor || !e.components.container) continue;
              const pos = e.components.position;
              if (!pos || (e.components.health && e.components.health.hp <= 0)) continue;
              const d = Math.hypot(pos.wx - intent.target.wx, pos.wy - intent.target.wy);
              if (d < cd0) { cd0 = d; container = e; }
            }

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
              if (container && !e.components.building && e.components.faction?.faction === 'infantry') {
                // Walk to the container; the movement system boards on arrival.
                if (!e.components.movement) e.components.movement = { target: null, path: [], speed: 10 };
                e.components.movement.target = container.components.position!;
                e.components.movement.boardTargetId = container.id;
                markers.push({ target: container.components.position!, remaining: MARKER_LIFETIME });
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
                const mv = e.components.movement;
                if (intent.queued && mv.target) {
                  // Shift-queue (v0.51): append a waypoint; the unit keeps its
                  // current leg. Capped so a held key can't grow state unbounded.
                  mv.orderQueue = mv.orderQueue ?? [];
                  if (mv.orderQueue.length < ORDER_QUEUE_CAP) {
                    mv.orderQueue.push({ wx: intent.target.wx, wy: intent.target.wy });
                  }
                } else {
                  mv.target = intent.target;
                  mv.orderQueue = []; // a plain order replaces the whole queue
                  mv.attackMove = false;
                }
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
              const mv = e.components.movement;
              if (intent.queued && mv.target) {
                mv.orderQueue = mv.orderQueue ?? [];
                if (mv.orderQueue.length < ORDER_QUEUE_CAP) {
                  mv.orderQueue.push({ wx: intent.target.wx, wy: intent.target.wy, attackMove: true });
                }
              } else {
                mv.target = intent.target;
                mv.pathGoal = null; // force a fresh path
                mv.attackMove = true;
                mv.orderQueue = [];
                e.components.combat.targetId = null;   // re-acquire nearest en route
              }
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
                e.components.movement = { ...e.components.movement, target: null, path: [], pathGoal: null, attackMove: false, orderQueue: [] };
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

            const result = validatePlacement(state, structure, intent.tile, actor);
            if (!result.valid) break;

            // TP-2: charge the TEAM LEDGER (spend across all owned banks).
            const cost = structure.cost ?? 0;
            if (cost > 0 && !spendCredits(state, actor, cost)) break;

            // Spawn the structure at the tile centre (contract fn, no inline math).
            // Per-kind components (FG-2): barracks trains combat units; a built
            // Refinery is a dock + storage + harvester producer with NO free
            // harvester and NO starting credits (the de-bundled RFC decision);
            // a Defense Turret is a building that fights (combat, no movement).
            const tileCenter = tileToWorldCenter(intent.tile);
            // CANONICAL factory (v0.42): player placement builds the exact same
            // structure the missions seed and the AI founds.
            state.store.create({
              position: tileCenter,
              // TP-3: player builds START as construction sites (progress 0) and
              // become operational when the construction system finishes them.
              ...structureComponents(intent.structureId, actor, structures, { buildProgress: 0 }),
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
            // Only the acting seat's own selected entities enter its group slot.
            const selectedIds: EntityId[] = [];
            for (const e of state.store.all()) {
              if (e.components.selection?.selected && e.components.faction?.team === actor) {
                selectedIds.push(e.id);
              }
            }
            groups.set(`${actor}:${intent.group}`, selectedIds);
            break;
          }

          case 'recall-group': {
            // Deselect the acting seat's own selection only (FG-7: never trample
            // the other seat's selection).
            for (const e of state.store.all()) {
              if (e.components.selection && e.components.faction?.team === actor) {
                e.components.selection.selected = false;
              }
            }
            // Recall the stored group (skip dead/removed entities)
            const stored = groups.get(`${actor}:${intent.group}`);
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

          case 'select-army': {
            // Q: select every living combat unit the seat owns (not buildings,
            // not harvesters) — the "grab the army" key.
            for (const e of state.store.all()) {
              if (e.components.faction?.team !== actor) continue;
              const combatant = !!e.components.combat && !e.components.building && (e.components.health?.hp ?? 1) > 0;
              if (combatant) e.components.selection = { selected: true };
              else if (e.components.selection) e.components.selection.selected = false;
            }
            break;
          }

          case 'select-idle-harvester': {
            // I: the WC3 idle-worker button — cycle through the seat's harvesters
            // whose FSM is IDLE (not mining/returning/docking). A manually-parked
            // harvester still walking counts: it's economically idle either way.
            // Deterministic: entity ids ascend, the cursor lives in the same
            // replay-rebuilt closure as groups.
            const idle: EntityId[] = [];
            for (const e of state.store.all()) {
              if (e.components.faction?.team !== actor) continue;
              const h = e.components.harvest;
              if (!h || h.state !== 'IDLE') continue;
              if ((e.components.health?.hp ?? 1) <= 0) continue;
              idle.push(e.id);
            }
            if (idle.length === 0) break; // nothing idle → keep the current selection
            const cursor = idleCursor.get(actor) ?? 0;
            const pick = idle[cursor % idle.length]!;
            idleCursor.set(actor, (cursor + 1) % idle.length);
            for (const e of state.store.all()) {
              if (e.components.selection && e.components.faction?.team === actor) e.components.selection.selected = false;
            }
            const picked = state.store.get(pick);
            if (picked) picked.components.selection = { selected: true };
            break;
          }

          case 'select-hero': {
            // O: select the seat's hero (if alive); no-op when there is none so a
            // mispress never throws away the current selection.
            let hero: ReturnType<typeof state.store.get> | undefined;
            for (const e of state.store.all()) {
              if (e.components.faction?.team !== actor) continue;
              if (!heroIds.includes(e.components.faction.faction)) continue;
              if ((e.components.health?.hp ?? 1) <= 0) continue;
              hero = e;
              break;
            }
            if (!hero) break;
            for (const e of state.store.all()) {
              if (e.components.selection && e.components.faction?.team === actor) e.components.selection.selected = false;
            }
            hero.components.selection = { selected: true };
            break;
          }
          case 'strike': {
            // XP-7: T3 + 5 Cells → a 3s-telegraphed orbital splash. The long-lived
            // marker doubles as the warning reticle for BOTH players.
            if (teamTier(state, actor) < 3) break;
            if (!spendCells(state, actor, STRIKE_COST_CELLS)) break; // TP-2 ledger
            strikes.push({ wx: intent.target.wx, wy: intent.target.wy, ticksLeft: STRIKE_DELAY });
            markers.push({ target: intent.target, remaining: STRIKE_DELAY });
            break;
          }
          case 'stance': {
            // XP-4: cycle aggressive → defensive → hold on the selection.
            const order = ['aggressive', 'defensive', 'hold'] as const;
            for (const e of state.store.all()) {
              if (!e.components.selection?.selected || e.components.faction?.team !== actor) continue;
              const c = e.components.combat;
              if (!c || e.components.building) continue;
              const cur = c.stance ?? 'aggressive';
              c.stance = order[(order.indexOf(cur) + 1) % 3];
            }
            break;
          }
          case 'unload': {
            // XP-4: spill a selected container's passengers onto adjacent tiles.
            for (const e of state.store.all()) {
              if (!e.components.selection?.selected || e.components.faction?.team !== actor) continue;
              const box = e.components.container; const pos = e.components.position;
              if (!box || !pos || box.stored.length === 0) continue;
              const t = worldToTile(pos);
              let i = 0;
              for (const passenger of box.stored) {
                const ring = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]][i % 8]!;
                const spot = { tx: t.tx + ring[0]!, ty: t.ty + ring[1]! };
                state.store.create({
                  position: tileToWorldCenter(spot),
                  health: { hp: passenger.hp, maxHp: 20 },
                  armor: { armorClass: 'LIGHT' },
                  movement: { target: null, path: [], speed: 12 },
                  combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
                  faction: { team: actor, faction: passenger.kind },
                });
                i += 1;
              }
              e.components.container = { ...box, stored: [] };
              // An emptied bunker stops fighting.
              if (e.components.building && e.components.combat) delete e.components.combat;
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
            const cellPrice = step.cells ?? 0;          // XP-2: T3 charges Cells
            if (teamCredits(state, actor) < step.cost || teamCells(state, actor) < cellPrice) break;
            spendCredits(state, actor, step.cost);      // TP-2 ledger
            if (cellPrice > 0) spendCells(state, actor, cellPrice);
            yard.components.tech = { tier: techC.tier, upgradingTo: step.toTier, ticksLeft: Math.max(1, Math.round(step.seconds * 20)) };
            break;
          }
          case 'research': {
            // Economy depth: research a team-wide Refinement at a powered Processing
            // Plant. One at a time; no re-research; charged credits + Cells up front.
            const ref = refinements.find(r => r.id === intent.refinementId);
            if (!ref) break;
            const led = teamLedger(state, actor);
            if (led.researching || led.done.includes(ref.id)) break;
            const hasPlant = state.store.all().some(e =>
              e.components.faction?.team === actor &&
              e.components.faction?.faction === 'processing_plant' &&
              (e.components.health?.hp ?? 1) > 0 &&
              e.components.building?.powered !== false);
            if (!hasPlant) break;
            const cellPrice = ref.cells ?? 0;
            if (teamCredits(state, actor) < ref.cost || teamCells(state, actor) < cellPrice) break;
            spendCredits(state, actor, ref.cost);
            if (cellPrice > 0) spendCells(state, actor, cellPrice);
            led.researching = ref.id;
            led.ticksLeft = Math.max(1, Math.round(ref.timeSeconds * SIM_TICK_RATE));
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
              intent.unitId === 'gunship' ? 'skypad' :
              (intent.unitId === 'scout_vehicle' || intent.unitId === 'assault_tank' || intent.unitId === 'longbow' || intent.unitId === 'skimmer_apc') ? 'war_factory' :
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
