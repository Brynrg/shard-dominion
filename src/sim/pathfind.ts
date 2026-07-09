// ── Pathfinding: deterministic A* over the tile grid (FG-1) ────────────────────
// Sim-pure: integer costs, no RNG, stable tie-breaking → same inputs, same path,
// every run (multiplayer/replay-safe by construction). 8-directional with
// no corner cutting (a diagonal requires BOTH orthogonal neighbours walkable).
//
// Scale note: maps are 32×32–64×64 (≤4096 tiles); a simple array-heap A* is far
// below the per-tick budget, and paths are computed once per ORDER, not per tick.
import type { TilePos } from './coords.js';
import type { GridManager } from './grid.js';

const ORTH_COST = 10;
const DIAG_COST = 14; // ≈ 10·√2

// Neighbour order is FIXED (part of determinism): N, E, S, W, NE, SE, SW, NW.
const DIRS: readonly { dx: number; dy: number; cost: number }[] = [
  { dx: 0, dy: -1, cost: ORTH_COST }, { dx: 1, dy: 0, cost: ORTH_COST },
  { dx: 0, dy: 1, cost: ORTH_COST }, { dx: -1, dy: 0, cost: ORTH_COST },
  { dx: 1, dy: -1, cost: DIAG_COST }, { dx: 1, dy: 1, cost: DIAG_COST },
  { dx: -1, dy: 1, cost: DIAG_COST }, { dx: -1, dy: -1, cost: DIAG_COST },
];

/** Octile-distance heuristic in the same integer cost units (admissible). */
function heuristic(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
  return ORTH_COST * (dx + dy) + (DIAG_COST - 2 * ORTH_COST) * Math.min(dx, dy);
}

/** If `goal` is unwalkable, ring-search (deterministic order) for the nearest
 *  walkable tile within `maxR`; returns null if none. */
export function nearestWalkable(grid: GridManager, goal: TilePos, blocked?: ReadonlySet<string>, maxR = 6): TilePos | null {
  const passable = (t: TilePos): boolean => grid.isWalkable(t) && !(blocked?.has(`${t.tx},${t.ty}`) ?? false);
  if (passable(goal)) return goal;
  for (let r = 1; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; // ring only
        const t = { tx: goal.tx + dx, ty: goal.ty + dy };
        if (passable(t)) return t;
      }
    }
  }
  return null;
}

/**
 * A* from `from` to `to` (goal auto-adjusted to the nearest walkable tile).
 * Returns the waypoint list EXCLUDING the start tile, or null when unreachable.
 * An empty array means "already there".
 */
export function findPath(grid: GridManager, from: TilePos, to: TilePos, blocked?: ReadonlySet<string>): TilePos[] | null {
  const passable = (t: TilePos): boolean => grid.isWalkable(t) && !(blocked?.has(`${t.tx},${t.ty}`) ?? false);
  const goal = nearestWalkable(grid, to, blocked);
  if (!goal) return null;
  const start = passable(from) ? from : nearestWalkable(grid, from, blocked);
  if (!start) return null;
  if (start.tx === goal.tx && start.ty === goal.ty) return [];

  const W = grid.width, H = grid.height, N = W * H;
  const idx = (tx: number, ty: number): number => ty * W + tx;
  const g = new Int32Array(N).fill(-1);      // best cost-so-far (-1 = unvisited)
  const parent = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);

  // Open list as a plain array-heap keyed by (f, then h, then index) — all ints,
  // ties broken identically on every machine.
  interface Node { i: number; f: number; h: number }
  const open: Node[] = [];
  const less = (a: Node, b: Node): boolean =>
    a.f !== b.f ? a.f < b.f : (a.h !== b.h ? a.h < b.h : a.i < b.i);
  const push = (n: Node): void => {
    open.push(n);
    let c = open.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (less(open[c]!, open[p]!)) { const t = open[c]!; open[c] = open[p]!; open[p] = t; c = p; }
      else break;
    }
  };
  const pop = (): Node => {
    const top = open[0]!;
    const last = open.pop()!;
    if (open.length > 0) {
      open[0] = last;
      let c = 0;
      for (;;) {
        const l = 2 * c + 1, r = l + 1;
        let m = c;
        if (l < open.length && less(open[l]!, open[m]!)) m = l;
        if (r < open.length && less(open[r]!, open[m]!)) m = r;
        if (m === c) break;
        const t = open[c]!; open[c] = open[m]!; open[m] = t; c = m;
      }
    }
    return top;
  };

  const si = idx(start.tx, start.ty), gi = idx(goal.tx, goal.ty);
  g[si] = 0;
  push({ i: si, f: heuristic(start.tx, start.ty, goal.tx, goal.ty), h: 0 });

  while (open.length > 0) {
    const cur = pop();
    if (closed[cur.i]) continue;
    closed[cur.i] = 1;
    if (cur.i === gi) break;
    const cx = cur.i % W, cy = (cur.i / W) | 0;
    for (const d of DIRS) {
      const nx = cx + d.dx, ny = cy + d.dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const t = { tx: nx, ty: ny };
      if (!passable(t)) continue;
      // No corner cutting: a diagonal needs both orthogonal neighbours open.
      if (d.cost === DIAG_COST &&
          (!passable({ tx: cx + d.dx, ty: cy }) || !passable({ tx: cx, ty: cy + d.dy }))) continue;
      const ni = idx(nx, ny);
      if (closed[ni]) continue;
      const ng = g[cur.i]! + d.cost;
      if (g[ni] === -1 || ng < g[ni]!) {
        g[ni] = ng;
        parent[ni] = cur.i;
        const h = heuristic(nx, ny, goal.tx, goal.ty);
        push({ i: ni, f: ng + h, h });
      }
    }
  }

  if (!closed[gi]) return null; // unreachable
  // Reconstruct goal→start, then reverse; drop the start tile.
  const out: TilePos[] = [];
  for (let i = gi; i !== si; i = parent[i]!) out.push({ tx: i % W, ty: (i / W) | 0 });
  out.reverse();
  return out;
}
