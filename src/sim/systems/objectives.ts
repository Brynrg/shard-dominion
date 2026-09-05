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
import { makeDefeatTracker } from '../defeat.js';
import { SIM_TICK_RATE } from '../loop.js';
import { makeTriggerRunner, anyLiving, anyExists, teamUnitInRegion, type MissionTrigger, type MissionMessage, type Region, type Team, type TriggerHost } from './missionTriggers.js';
import type { UnitDef } from '../../loaders/units.js';
import type { TeamFactions } from '../factions.js';

export type { Region, Team, MissionTrigger, MissionMessage } from './missionTriggers.js';

export type Objective =
  | { type: 'destroy'; id?: string; team: Team; kind?: string; primary?: boolean; text: string; onlyIfChoice?: string }
  | { type: 'eliminate'; id?: string; team: Team; primary?: boolean; text: string; onlyIfChoice?: string }
  | { type: 'survive'; id?: string; seconds: number; primary?: boolean; text: string; onlyIfChoice?: string }
  | { type: 'hold'; id?: string; team: Team; region: Region; seconds: number; primary?: boolean; text: string; onlyIfChoice?: string }
  | { type: 'accumulate'; id?: string; team: Team; credits: number; primary?: boolean; text: string; onlyIfChoice?: string }
  | { type: 'build'; id?: string; team: Team; kind: string; primary?: boolean; text: string; onlyIfChoice?: string }
  | { type: 'buildCount'; id?: string; team: Team; kind: string; count: number; primary?: boolean; text: string; onlyIfChoice?: string }
  | { type: 'reach'; id?: string; team: Team; region: Region; primary?: boolean; text: string; onlyIfChoice?: string };

export type Failure =
  | { type: 'defend'; team: Team; kind?: string }   // fires if the matched entity (having existed) is gone
  | { type: 'defeated'; team: Team }                // fires if team has no producers AND no combat units
  | { type: 'timeLimit'; seconds: number };         // challenge speedruns: out of time = failed

export interface ObjectiveStatus { id?: string; text: string; primary: boolean; complete: boolean }
export interface ObjectivesResult { objectives: ObjectiveStatus[]; won: boolean; lost: boolean }

// The system's canonical name is the reserved 'mission' slot in SYSTEM_ORDER (runs early,
// right after command) — evaluation lags actual deaths by one tick, which is immaterial
// for win/lose and keeps the pinned loop contract untouched.
export interface ObjectivesSystem {
  name: 'mission';
  run(state: SimState): void;
  result: ObjectivesResult;
  /** Live trigger messages for the view (comm panel). */
  messages: MissionMessage[];
  /** Dev kit (XP-1): trigger ids that have fired. */
  firedTriggerIds(): string[];
  /** Active reveal regions (fog.ts reads this). */
  activeReveals(): readonly Region[];
  /** Camera pan requests (drained by main.ts). */
  cameraRequests: { tx: number; ty: number; tick: number }[];
}

function teamCredits(state: SimState, team: Team): number {
  let c = 0;
  for (const e of state.store.all()) {
    if (e.components.faction?.team === team && e.components.economy) c += e.components.economy.credits;
  }
  return c;
}

// Phase A4: `eliminate` and `defeated` both mean "this side is finished", and that
// is defined in exactly one place — src/sim/defeat.ts. Previously this file carried
// its own copy of the rule ("no producers AND no living combat units"), which is what
// forced the endgame map-sweep for the last stray unit.
const defeatTracker = makeDefeatTracker();
function teamIsFinished(state: SimState, team: Team): boolean {
  defeatTracker.observe(state);
  return defeatTracker.isDefeated(state, team);
}

export function makeObjectivesSystem(
  objectives: readonly Objective[],
  failures: readonly Failure[] = [],
  // FG-4: mission triggers run in the same reserved 'mission' slot, BEFORE the
  // objective evaluation (a spawn this tick is visible to objectives this tick).
  triggers: readonly MissionTrigger[] = [],
  units: readonly UnitDef[] = [],
  factions?: TeamFactions,
  bootChoice: string | null = null,
): ObjectivesSystem {
  const triggerRunner = makeTriggerRunner(triggers, units, factions, bootChoice);
  const completedIds = new Set<string>(); // last-known complete objective ids (for trigger conditions)
  const forced = new Set<string>(); // force-completed objective ids (via trigger actions)
  const live: Objective[] = [...objectives]; // live objective list (triggers can append)
  // Latches for momentary / cumulative conditions (deterministic closure state).
  const everSeen = new Map<number, boolean>();   // destroy/defend: target has existed
  const everReached = new Map<number, boolean>(); // reach: region entered
  const holdTicks = new Map<number, number>();    // hold: consecutive in-region ticks
  const result: ObjectivesResult = { objectives: [], won: false, lost: false };

  function completed(o: Objective, i: number, state: SimState): boolean {
    if (o.id && forced.has(o.id)) return true;
    switch (o.type) {
      case 'destroy': {
        if (anyExists(state, o.team, o.kind)) everSeen.set(i, true);
        return (everSeen.get(i) ?? false) && !anyLiving(state, o.team, o.kind);
      }
      case 'eliminate':
        return teamIsFinished(state, o.team);
      case 'survive':
        return state.tick >= Math.round(o.seconds * SIM_TICK_RATE);
      case 'accumulate':
        return teamCredits(state, o.team) >= o.credits;
      case 'build':
        return anyLiving(state, o.team, o.kind);
      case 'buildCount': {
        // Challenge constraint (e.g. "own 3 refineries at once").
        let n = 0;
        for (const e of state.store.all()) {
          const f = e.components.faction;
          if (f?.team !== o.team || f.faction !== o.kind) continue;
          if ((e.components.health?.hp ?? 1) <= 0) continue;
          n += 1;
        }
        return n >= o.count;
      }
      case 'reach': {
        if (teamUnitInRegion(state, o.team, o.region)) everReached.set(i, true);
        return everReached.get(i) ?? false;
      }
      case 'hold': {
        // TP-5: CONTESTED holds pause (the audit: M4/M9 "control" only required
        // standing nearby while the enemy did too). Own presence + no foe = timer
        // runs; contested = frozen; abandoned = reset.
        const foe = o.team === 'player' ? 'enemy' : 'player';
        const ours = teamUnitInRegion(state, o.team, o.region);
        const theirs = teamUnitInRegion(state, foe, o.region);
        const prev = holdTicks.get(i) ?? 0;
        const t = ours ? (theirs ? prev : prev + 1) : 0;
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
        return teamIsFinished(state, f.team);
      case 'timeLimit':
        return state.tick >= Math.round(f.seconds * SIM_TICK_RATE);
    }
  }

  const host: TriggerHost = {
    isObjectiveComplete: (id) => completedIds.has(id),
    addObjective: (o) => { live.push(o); },
    forceComplete: (id) => { forced.add(id); },
  };

  return {
    name: 'mission' as const,
    result,
    messages: triggerRunner.messages,
    cameraRequests: triggerRunner.cameraRequests,
    activeReveals: () => triggerRunner.activeReveals(),
    firedTriggerIds: triggerRunner.firedIds,
    run(state: SimState): void {
      if (result.won || result.lost) return; // decision is sticky
      triggerRunner.run(state, host);
      const statuses: ObjectiveStatus[] = live.map((o, i) => ({
        id: o.id, text: o.text, primary: o.primary ?? true, complete: completed(o, i, state),
      }));
      result.objectives = statuses;
      for (const st of statuses) if (st.id && st.complete) completedIds.add(st.id);
      // Lose takes priority over win if both resolve on the same tick.
      const lost = failures.some((f, i) => failed(f, i, state));
      if (lost) { result.lost = true; return; }
      const primaries = statuses.filter(s => s.primary);
      result.won = primaries.length > 0 && primaries.every(s => s.complete);
    },
  };
}
