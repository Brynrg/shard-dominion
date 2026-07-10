// ── Movement system: A* path-following + unit separation (FG-1) ────────────────
// Reads state only; does NOT construct anything (lint will stop you).
//
// Path-following: when an entity has a movement target, a tile-level A* path is
// computed ONCE (per order — recomputed only when the target changes) and followed
// waypoint by waypoint; the final leg goes to the exact world target. Unreachable
// targets fall back to the old straight-line step (previous behaviour), so nothing
// deadlocks. Deterministic throughout (pathfind.ts is RNG-free, stable-tied).
//
// Separation: after stepping, overlapping UNITS are pushed apart along their
// centre line (half each) so armies stop collapsing into one perfectly-stacked
// point. Deterministic: pairwise in store order, coincident pairs broken by id
// order. Buildings never move; harvesters mid-HARVEST/DOCK are left alone so the
// dock/mine radius checks can't be disturbed.
import type { SimState } from '../state.js';
import type { Entity } from '../components.js';
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

export function makeMovementSystem(): { name: 'movement'; run(state: SimState): void } {
  const wallTiles = makeWallCache(); // TP-4: per-system, never shared across sims
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

        // (Re)plan: no path for THIS target yet → run A* tile-to-tile. The final
        // waypoint is replaced with the exact world target so arrival is precise.
        if (!samePos(movement.pathGoal, movement.target)) {
          // Air (XP-5): flyers travel as the crow does — no A*, no walls.
          const tilePath = movement.flying
            ? [worldToTile(movement.target)]
            : findPath(state.grid, worldToTile(pos), worldToTile(movement.target), wallTiles(state, e.components.faction?.team ?? 'neutral'));
          const waypoints = tilePath === null
            ? [] // unreachable → empty path = straight-line fallback below
            : tilePath.map(t => tileToWorldCenter(t));
          if (waypoints.length > 0) waypoints[waypoints.length - 1] = movement.target;
          else if (tilePath !== null) waypoints.push(movement.target); // same tile → direct leg
          e.components.movement = { ...movement, path: waypoints, pathGoal: movement.target };
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
        // Current waypoint: head of the path, or the raw target (unreachable fallback).
        const wp = m.path.length > 0 ? m.path[0]! : m.target!;
        const dx = wp.wx - pos.wx;
        const dy = wp.wy - pos.wy;
        const distSq = dx * dx + dy * dy;

        if (distSq <= m.speed * m.speed) {
          if (m.path.length > 1) {
            // Reached an intermediate waypoint → advance along the path.
            e.components.position = world(wp.wx, wp.wy);
            e.components.movement = { ...m, path: m.path.slice(1) };
          } else {
            // Final waypoint (or direct target) → arrive and clear the order.
            e.components.position = world(wp.wx, wp.wy);
            e.components.movement = { ...m, target: null, path: [], pathGoal: null };
          }
          continue;
        }

        const dist = Math.sqrt(distSq);
        e.components.position = world(
          pos.wx + (dx / dist) * m.speed,
          pos.wy + (dy / dist) * m.speed,
        );
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
          // Each side moves half the overlap — but never INTO an unwalkable tile.
          const na = world(pa.wx - ux * push, pa.wy - uy * push);
          const nb = world(pb.wx + ux * push, pb.wy + uy * push);
          if (state.grid.isWalkable(worldToTile(na))) a.components.position = na;
          if (state.grid.isWalkable(worldToTile(nb))) b.components.position = nb;
        }
      }
    },
  };
}
