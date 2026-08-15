// ── Deterministic open-ground formation slots ─────────────────────────────────
// Pure sim helper: no DOM, no wall-clock, no RNG. Slot identity is a function of
// (sorted entity ids, cohort centroid, destination) so replays and lockstep
// hashes stay identical. Destinations are ordinary WorldPos values stored on
// movement.target / orderQueue — no hidden formation state.
import type { EntityId } from './ids.js';
import type { WorldPos } from './coords.js';
import { TILE_SUBUNITS, world } from './coords.js';

export interface FormationMember {
  readonly id: EntityId;
  readonly pos: WorldPos;
  readonly flying: boolean;
}

/** Spacing between adjacent slot centres — one tile, derived from the coord contract. */
const SLOT_SPACING = TILE_SUBUNITS;

/**
 * Distinct world-space destinations for an open-ground move / attack-move.
 * Flying and ground units are separate cohorts. A cohort of one keeps `destination`
 * exactly. Cohorts of two or more receive a compact square-like grid centred on
 * `destination` and oriented along the centroid→destination travel direction.
 */
export function formationTargets(
  members: readonly FormationMember[],
  destination: WorldPos,
): Map<EntityId, WorldPos> {
  const out = new Map<EntityId, WorldPos>();
  const ground: FormationMember[] = [];
  const air: FormationMember[] = [];
  for (const m of members) (m.flying ? air : ground).push(m);
  assignCohort(ground, destination, out);
  assignCohort(air, destination, out);
  return out;
}

function assignCohort(
  cohort: FormationMember[],
  dest: WorldPos,
  out: Map<EntityId, WorldPos>,
): void {
  if (cohort.length === 0) return;
  cohort.sort((a, b) => a.id - b.id);
  if (cohort.length === 1) {
    out.set(cohort[0]!.id, dest);
    return;
  }

  let cx = 0, cy = 0;
  for (const m of cohort) { cx += m.pos.wx; cy += m.pos.wy; }
  cx /= cohort.length;
  cy /= cohort.length;

  let fx = dest.wx - cx, fy = dest.wy - cy;
  const flen = Math.hypot(fx, fy);
  // Degenerate travel (already at the click): face east — a stable default.
  if (flen < 1) { fx = 1; fy = 0; }
  else { fx /= flen; fy /= flen; }
  const rx = -fy, ry = fx; // right-hand axis

  const slots = slotOffsets(cohort.length);
  const used = new Set<string>();
  for (let i = 0; i < cohort.length; i++) {
    const s = slots[i]!;
    let wx = dest.wx + Math.round(rx * s.col * SLOT_SPACING + fx * s.row * SLOT_SPACING);
    let wy = dest.wy + Math.round(ry * s.col * SLOT_SPACING + fy * s.row * SLOT_SPACING);
    let key = `${wx},${wy}`;
    // Rounding a rotated grid can theoretically collide; nudge along +right.
    let nudge = 0;
    while (used.has(key)) {
      nudge += 1;
      wx = dest.wx + Math.round(rx * (s.col + nudge) * SLOT_SPACING + fx * s.row * SLOT_SPACING);
      wy = dest.wy + Math.round(ry * (s.col + nudge) * SLOT_SPACING + fy * s.row * SLOT_SPACING);
      key = `${wx},${wy}`;
    }
    used.add(key);
    out.set(cohort[i]!.id, world(wx, wy));
  }
}

/** Compact square-like cell offsets centred on (0,0), row-major, last row centred. */
export function slotOffsets(n: number): { col: number; row: number }[] {
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const out: { col: number; row: number }[] = [];
  let placed = 0;
  for (let r = 0; r < rows && placed < n; r++) {
    const remaining = n - placed;
    const colsThisRow = r === rows - 1 ? remaining : cols;
    const col0 = (cols - colsThisRow) / 2;
    for (let c = 0; c < colsThisRow; c++) {
      out.push({
        col: col0 + c - (cols - 1) / 2,
        row: r - (rows - 1) / 2,
      });
      placed += 1;
    }
  }
  return out;
}
