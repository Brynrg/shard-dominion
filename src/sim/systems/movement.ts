// ── Movement system: A* path-following + unit separation (FG-1) ────────────────
// Reads state only; does NOT construct anything (lint will stop you).
//
// Path-following: when an entity has a movement target, a tile-level A* path is
// computed ONCE (per order — recomputed when the target changes OR the next
// waypoint is no longer walkable/unblocked) and followed waypoint by waypoint.
// Unreachable ground targets STOP in place — they never fall back to a straight
// line through walls. Exact-world arrival is used only when the requested tile
// itself is valid and reachable. Flyers still fly as the crow does.
//
// Separation: after stepping, overlapping UNITS are pushed apart along their
// centre line (half each). Proposed positions must pass terrain walkability AND
// the team-specific dynamic blocker set, so crowding beside a wall cannot shove
// a unit into it. Deterministic: pairwise in store order, coincident pairs
// broken by id order. Buildings never move; harvesters mid-HARVEST/DOCK are
// left alone so the dock/mine radius checks can't be disturbed.
import type { SimState } from '../state.js';
import type { Entity } from '../components.js';
import type { WorldPos } from '../coords.js';
import { world, worldToTile, tileToWorldCenter, TILE_SUBUNITS } from '../coords.js';
import { findPath } from '../pathfind.js';

// Walls (XP-1): tiles occupied by living path-blocking buildings. Computed at most
// once per tick. TP-4: cache lives INSIDE the factory closure — module-level state
// leaked between simulations stepped at the same tick (audit finding).
function makeWallCache() {
  let wallCacheTick = -1;
  const wallCacheByTeam = new Map<string, Set<string>>();
  return function wallTiles(state: SimState, team: string): Set<string> {
  if (state.tick !== wallCacheTick) {
    wallCacheTick = state.tick;
    wallCacheByTeam.clear();
    for (const t of ['player', 'enemy', 'neutral']) wallCacheByTeam.set(t, new Set());
    for (const e of state.store.all()) {
      if (!e.components.building?.blocksPath) continue;
      if ((e.components.health?.hp ?? 1) <= 0) continue;
      const p = e.components.position;
      if (!p) continue;
      const key = `${worldToTile(p).tx},${worldToTile(p).ty}`;
      const ownerTeam = e.components.faction?.team ?? 'neutral';
      const teamPass = e.components.building.teamPass === true;
      for (const t of ['player', 'enemy', 'neutral']) {
        // Gates (XP-4): the owner's units path THROUGH their own gates.
        if (teamPass && t === ownerTeam) continue;
        wallCacheByTeam.get(t)!.add(key);
      }
    }
  }
    return wallCacheByTeam.get(team) ?? wallCacheByTeam.get('neutral')!;
  };
}

const SEPARATION_DIST = Math.floor(TILE_SUBUNITS * 0.45); // min unit spacing (world units)

function samePos(a: { wx: number; wy: number } | null | undefined, b: { wx: number; wy: number } | null): boolean {
  return !!a && !!b && a.wx === b.wx && a.wy === b.wy;
}

function tileKey(t: { tx: number; ty: number }): string {
  return `${t.tx},${t.ty}`;
}

export function makeMovementSystem(): { name: 'movement'; run(state: SimState): void } {
  const wallTiles = makeWallCache(); // TP-4: per-system, never shared across sims

  function blockedFor(state: SimState, t: { tx: number; ty: number }, team: string): boolean {
    return !state.grid.isWalkable(t) || wallTiles(state, team).has(tileKey(t));
  }

  /** Build a waypoint list for `target`, or null if the ground unit cannot reach it. */
  function planPath(state: SimState, e: Entity, pos: WorldPos, target: WorldPos): WorldPos[] | null {
    const movement = e.components.movement!;
    if (movement.flying) return [target];
    const team = e.components.faction?.team ?? 'neutral';
    const blocked = wallTiles(state, team);
    const from = worldToTile(pos);
    const to = worldToTile(target);
    const tilePath = findPath(state.grid, from, to, blocked);
    if (tilePath === null) return null;
    const goalPassable = !blockedFor(state, to, team);
    if (tilePath.length === 0) {
      // Already on the (possibly adjusted) goal tile.
      if (goalPassable && from.tx === to.tx && from.ty === to.ty) return [target];
      return [];
    }
    const waypoints = tilePath.map(t => tileToWorldCenter(t));
    const last = tilePath[tilePath.length - 1]!;
    // Exact-world arrival ONLY when the requested tile itself is valid and is
    // the A* endpoint. A blocked/adjusted goal keeps the walkable tile centre.
    if (goalPassable && last.tx === to.tx && last.ty === to.ty) {
      waypoints[waypoints.length - 1] = target;
    }
    return waypoints;
  }

  function stopMoving(e: Entity): void {
    const m = e.components.movement;
    if (!m) return;
    e.components.movement = { ...m, target: null, path: [], pathGoal: null };
  }

  return {
    name: 'movement' as const,
    run(state: SimState): void {
      // ── 1) Step every moving entity along its path ────────────────────────
      for (const e of state.store.all()) {
        const pos = e.components.position;
        const movement = e.components.movement;
        if (!pos || !movement || !movement.target || movement.speed <= 0) continue;

        // Attack-move: HOLD to fight while a target is acquired (combatTargeting
        // clears targetId when it dies/leaves range → the advance resumes).
        if (movement.attackMove && e.components.combat?.targetId != null) continue;

        const team = e.components.faction?.team ?? 'neutral';
        const flying = movement.flying === true;

        // Next waypoint no longer standable → discard the cache and replan.
        let needsPlan = !samePos(movement.pathGoal, movement.target);
        if (!needsPlan && !flying && movement.path.length > 0) {
          if (blockedFor(state, worldToTile(movement.path[0]!), team)) needsPlan = true;
        }

        if (needsPlan) {
          const waypoints = planPath(state, e, pos, movement.target);
          if (waypoints === null) {
            // Unreachable: stop on the current (valid) tile. Never tunnel.
            stopMoving(e);
            continue;
          }
          if (waypoints.length === 0) {
            // Already as close as A* can get (adjusted goal == here).
            const m = e.components.movement!;
            if (m.orderQueue && m.orderQueue.length > 0) {
              const [next, ...rest] = m.orderQueue;
              e.components.movement = {
                ...m, target: world(next!.wx, next!.wy), path: [], pathGoal: null,
                attackMove: next!.attackMove ?? false, orderQueue: rest,
              };
            } else {
              stopMoving(e);
            }
            continue;
          }
          e.components.movement = { ...e.components.movement!, path: waypoints, pathGoal: movement.target };
        }

        const m = e.components.movement!;
        // Boarding (XP-4): adjacent to the target container → step inside (the unit
        // becomes a stored snapshot; the entity is removed).
        if (m.boardTargetId != null) {
          const box = state.store.get(m.boardTargetId);
          const boxPos = box?.components.position;
          const store = box?.components.container;
          if (!box || !boxPos || !store || (box.components.health?.hp ?? 0) <= 0) {
            m.boardTargetId = null;
          } else if (Math.hypot(boxPos.wx - pos.wx, boxPos.wy - pos.wy) <= TILE_SUBUNITS * 1.4) {
            if (store.stored.length < store.capacity) {
              store.stored.push({ kind: e.components.faction?.faction ?? 'infantry', hp: e.components.health?.hp ?? 20 });
              // A garrisoned bunker fights (one rifle regardless of count, v1).
              if (box.components.building && !box.components.combat) {
                box.components.combat = { weaponId: 'rifle', cooldownRemaining: 0, targetId: null };
              }
              state.store.remove(e.id);
              continue;
            }
            m.boardTargetId = null; // full — stand down
          }
        }

        if (m.path.length === 0) {
          stopMoving(e);
          continue;
        }
        const wp = m.path[0]!;
        const dx = wp.wx - pos.wx;
        const dy = wp.wy - pos.wy;
        const distSq = dx * dx + dy * dy;

        if (distSq <= m.speed * m.speed) {
          if (m.path.length > 1) {
            // Reached an intermediate waypoint → advance along the path.
            e.components.position = world(wp.wx, wp.wy);
            e.components.movement = { ...m, path: m.path.slice(1) };
          } else if (m.orderQueue && m.orderQueue.length > 0) {
            // Final waypoint, but shift-queued orders remain (v0.51) → the next
            // waypoint becomes the live target, carrying its attack-move flag.
            e.components.position = world(wp.wx, wp.wy);
            const [next, ...rest] = m.orderQueue;
            e.components.movement = {
              ...m, target: world(next!.wx, next!.wy), path: [], pathGoal: null,
              attackMove: next!.attackMove ?? false, orderQueue: rest,
            };
          } else {
            // Final waypoint → arrive and clear the order.
            e.components.movement = { ...m, target: null, path: [], pathGoal: null };
            e.components.position = world(wp.wx, wp.wy);
          }
          continue;
        }

        const dist = Math.sqrt(distSq);
        const stepped = world(
          pos.wx + (dx / dist) * m.speed,
          pos.wy + (dy / dist) * m.speed,
        );
        // Ground units must not step onto a newly-blocked tile mid-leg.
        if (!flying && blockedFor(state, worldToTile(stepped), team)) {
          const replanned = planPath(state, e, pos, m.target!);
          if (replanned === null || replanned.length === 0) {
            stopMoving(e);
          } else {
            e.components.movement = { ...m, path: replanned, pathGoal: m.target };
          }
          continue;
        }
        e.components.position = stepped;
      }

      // ── 2) Separation: push overlapping units apart (deterministic) ────────
      const movers: Entity[] = [];
      for (const e of state.store.all()) {
        if (!e.components.movement || !e.components.position) continue;
        const hs = e.components.harvest?.state;
        if (hs === 'HARVEST' || hs === 'DOCK') continue; // don't disturb mining/docking
        movers.push(e);
      }
      for (let i = 0; i < movers.length; i++) {
        for (let j = i + 1; j < movers.length; j++) {
          const a = movers[i]!, b = movers[j]!;
          const pa = a.components.position!, pb = b.components.position!;
          let dx = pb.wx - pa.wx, dy = pb.wy - pa.wy;
          const distSq = dx * dx + dy * dy;
          if (distSq >= SEPARATION_DIST * SEPARATION_DIST) continue;
          let dist = Math.sqrt(distSq);
          if (dist < 1) { // coincident: break the tie by id order along +x
            dx = a.id < b.id ? -1 : 1; dy = 0; dist = 1;
          }
          const push = (SEPARATION_DIST - dist) / 2;
          const ux = dx / dist, uy = dy / dist;
          const na = world(pa.wx - ux * push, pa.wy - uy * push);
          const nb = world(pb.wx + ux * push, pb.wy + uy * push);
          const aFly = a.components.movement?.flying === true;
          const bFly = b.components.movement?.flying === true;
          const aTeam = a.components.faction?.team ?? 'neutral';
          const bTeam = b.components.faction?.team ?? 'neutral';
          if (aFly || !blockedFor(state, worldToTile(na), aTeam)) a.components.position = na;
          if (bFly || !blockedFor(state, worldToTile(nb), bTeam)) b.components.position = nb;
        }
      }
    },
  };
}
