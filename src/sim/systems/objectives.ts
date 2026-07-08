// ── Objectives system: mission win/lose evaluation (campaign) ─────────────────
// Sim-pure & deterministic (reads state + state.tick; no DOM, Date, Math.random).
// Generalizes victory.ts's single "destroy all" rule into typed mission objectives.
// It does NOT cull dead entities (victory.ts owns culling) — it only EVALUATES, and
// treats hp<=0 as not-living so it is robust to cull timing.
//
// A mission passes `objectives` (primary ones must all complete to WIN) and `failures`
// (any one firing = LOSE). The result is exposed for the HUD/objective tracker.
//
// NAMING (locked in CAMPAIGN_DESIGN.md §10 review): an entity's *kind* is its type
// string ('barracks','refinery',…) — the ECS stores it in `faction.faction`, which is
// confusingly named, so the mission schema uses `kind`. Every objective may carry a
// stable authoring `id` (for the UI/triggers/rewards later).
import type { SimState } from '../state.js';
import { SIM_TICK_RATE } from '../loop.js';
import { tileToWorldCenter, TILE_SUBUNITS } from '../coords.js';

export type Team = 'player' | 'enemy';
export interface Region { tx: number; ty: number; r: number } // radius r in TILES

export type Objective =
  | { type: 'destroy'; id?: string; team: Team; kind?: string; primary?: boolean; text: string }
  | { type: 'eliminate'; id?: string; team: Team; primary?: boolean; text: string }
  | { type: 'survive'; id?: string; seconds: number; primary?: boolean; text: string }
  | { type: 'hold'; id?: string; team: Team; region: Region; seconds: number; primary?: boolean; text: string }
  | { type: 'accumulate'; id?: string; team: Team; credits: number; primary?: boolean; text: string }
  | { type: 'build'; id?: string; team: Team; kind: string; primary?: boolean; text: string }
  | { type: 'reach'; id?: string; team: Team; region: Region; primary?: boolean; text: string };

export type Failure =
  | { type: 'defend'; team: Team; kind?: string }   // fires if the matched entity (having existed) is gone
  | { type: 'defeated'; team: Team };               // fires if team has no producers AND no combat units

export interface ObjectiveStatus { id?: string; text: string; primary: boolean; complete: boolean }
export interface ObjectivesResult { objectives: ObjectiveStatus[]; won: boolean; lost: boolean }
// The system's canonical name is the reserved 'mission' slot in SYSTEM_ORDER (runs early,
// right after command) — evaluation lags actual deaths by one tick, which is immaterial
// for win/lose and keeps the pinned loop contract untouched.
export interface ObjectivesSystem { name: 'mission'; run(state: SimState): void; result: ObjectivesResult }

// A living entity matching (team, kind?) — hp<=0 counts as dead (cull-timing safe).
function anyLiving(state: SimState, team: Team, kind?: string): boolean {
  for (const e of state.store.all()) {
    const f = e.components.faction;
    if (!f || f.team !== team) continue;
    if (kind && f.faction !== kind) continue;
    const h = e.components.health;
    if (h && h.hp <= 0) continue;
    return true;
  }
  return false;
}

// Whether a (team, kind?) entity has EVER been present (existence, ignoring hp).
function anyExists(state: SimState, team: Team, kind?: string): boolean {
  for (const e of state.store.all()) {
    const f = e.components.faction;
    if (!f || f.team !== team) continue;
    if (kind && f.faction !== kind) continue;
    return true;
  }
  return false;
}

function teamCredits(state: SimState, team: Team): number {
  let c = 0;
  for (const e of state.store.all()) {
    if (e.components.faction?.team === team && e.components.economy) c += e.components.economy.credits;
  }
  return c;
}

function teamHasProducerOrArmy(state: SimState, team: Team): boolean {
  for (const e of state.store.all()) {
    if (e.components.faction?.team !== team) continue;
    if (e.components.production) return true;
    if (e.components.combat && (e.components.health?.hp ?? 0) > 0) return true;
  }
  return false;
}

// A living team UNIT (has movement or combat) inside the region (world distance ≤ r tiles).
function teamUnitInRegion(state: SimState, team: Team, region: Region): boolean {
  const c = tileToWorldCenter({ tx: region.tx, ty: region.ty });
  const rWorld = region.r * TILE_SUBUNITS;
  for (const e of state.store.all()) {
    const f = e.components.faction; const p = e.components.position;
    if (!f || f.team !== team || !p) continue;
    if (!e.components.movement && !e.components.combat) continue; // a UNIT, not a static field/marker
    if ((e.components.health?.hp ?? 1) <= 0) continue;
    if (Math.hypot(p.wx - c.wx, p.wy - c.wy) <= rWorld) return true;
  }
  return false;
}

export function makeObjectivesSystem(objectives: readonly Objective[], failures: readonly Failure[] = []): ObjectivesSystem {
  // Latches for momentary / cumulative conditions (deterministic closure state).
  const everSeen = new Map<number, boolean>();   // destroy/defend: target has existed
  const everReached = new Map<number, boolean>(); // reach: region entered
  const holdTicks = new Map<number, number>();    // hold: consecutive in-region ticks
  const result: ObjectivesResult = { objectives: [], won: false, lost: false };

  function completed(o: Objective, i: number, state: SimState): boolean {
    switch (o.type) {
      case 'destroy': {
        if (anyExists(state, o.team, o.kind)) everSeen.set(i, true);
        return (everSeen.get(i) ?? false) && !anyLiving(state, o.team, o.kind);
      }
      case 'eliminate':
        return !teamHasProducerOrArmy(state, o.team);
      case 'survive':
        return state.tick >= Math.round(o.seconds * SIM_TICK_RATE);
      case 'accumulate':
        return teamCredits(state, o.team) >= o.credits;
      case 'build':
        return anyLiving(state, o.team, o.kind);
      case 'reach': {
        if (teamUnitInRegion(state, o.team, o.region)) everReached.set(i, true);
        return everReached.get(i) ?? false;
      }
      case 'hold': {
        const t = teamUnitInRegion(state, o.team, o.region) ? (holdTicks.get(i) ?? 0) + 1 : 0;
        holdTicks.set(i, t);
        return t >= Math.round(o.seconds * SIM_TICK_RATE);
      }
    }
  }

  function failed(f: Failure, i: number, state: SimState): boolean {
    switch (f.type) {
      case 'defend': {
        // Fires once the (previously-seen) defended entity is gone.
        if (anyLiving(state, f.team, f.kind)) { everSeen.set(-1 - i, true); return false; }
        return everSeen.get(-1 - i) ?? false;
      }
      case 'defeated':
        return !teamHasProducerOrArmy(state, f.team);
    }
  }

  return {
    name: 'mission' as const,
    result,
    run(state: SimState): void {
      if (result.won || result.lost) return; // decision is sticky
      const statuses: ObjectiveStatus[] = objectives.map((o, i) => ({
        id: o.id, text: o.text, primary: o.primary ?? true, complete: completed(o, i, state),
      }));
      result.objectives = statuses;
      // Lose takes priority over win if both resolve on the same tick.
      const lost = failures.some((f, i) => failed(f, i, state));
      if (lost) { result.lost = true; return; }
      const primaries = statuses.filter(s => s.primary);
      result.won = primaries.length > 0 && primaries.every(s => s.complete);
    },
  };
}
