// ── Mission triggers: deterministic mid-mission events (FG-4 / campaign CP-2) ───
// NOT a scripting engine — the four RFC-blessed actions only:
//   message      → queued for the view (comm panel); sim state untouched.
//   spawn        → create units for a team; they attack-move at a point if given.
//   grantCredits → add to a team's bank (mission drama only; AI never uses this).
//   reveal       → accepted in data, NO-OP in v1 (fog integration is a later slice).
// Conditions read ONLY sim state + tick (no wall-clock, no RNG); every trigger
// fires at most once. Composed into the 'mission' SYSTEM_ORDER slot by
// objectives.ts, so the pinned loop contract is untouched.
import type { SimState } from '../state.js';
import type { UnitDef } from '../../loaders/units.js';
import { tileToWorldCenter } from '../coords.js';
import { grantCredits } from '../ledger.js';
import { unitComponents } from '../factory.js';
import { SIM_TICK_RATE } from '../loop.js';
import { FACTIONS, type TeamFactions } from '../factions.js';

export interface TriggerWhen {
  /** Fire at N seconds of match time. */
  timeSeconds?: number;
  /** Fire when a team's banked credits reach N. */
  credits?: { team: 'player' | 'enemy'; gte: number };
  /** Fire when the objective with this id completes. */
  objectiveComplete?: string;
  /** XP-6: fire when the mission's boot choice matches (evaluated from tick 1). */
  choice?: string;
}
export interface SpawnUnit { type: string; tx: number; ty: number }
export type TriggerAction =
  | { type: 'message'; speaker?: string; text: string }
  | { type: 'spawn'; team: 'player' | 'enemy' | 'neutral'; units: SpawnUnit[]; attackMoveTo?: { tx: number; ty: number } }
  | { type: 'grantCredits'; team: 'player' | 'enemy'; amount: number }
  | { type: 'reveal'; region?: { tx: number; ty: number; r: number } }; // v1 no-op

export interface MissionTrigger { id: string; when: TriggerWhen; actions: TriggerAction[] }

export interface MissionMessage { speaker: string; text: string; expiresAtTick: number }

export interface TriggerRunner {
  /** Fired-message queue for the view (comm panel); pruned by tick. */
  readonly messages: MissionMessage[];
  /** Dev kit (XP-1): trigger ids that have fired. */
  firedIds(): string[];
  run(state: SimState, isObjectiveComplete: (id: string) => boolean): void;
}

const MESSAGE_SECONDS = 8;

export function makeTriggerRunner(triggers: readonly MissionTrigger[], units: readonly UnitDef[], factions?: TeamFactions, bootChoice: string | null = null): TriggerRunner {
  const factionFor = (team: string) => (team === 'player' ? (factions?.player ?? FACTIONS.concord) : (factions?.enemy ?? FACTIONS.concord));
  const fired = new Set<string>();
  const messages: MissionMessage[] = [];

  function teamCredits(state: SimState, team: string): number {
    let c = 0;
    for (const e of state.store.all()) {
      if (e.components.faction?.team === team && e.components.economy) c += e.components.economy.credits;
    }
    return c;
  }

  function act(state: SimState, a: TriggerAction): void {
    switch (a.type) {
      case 'message':
        messages.push({ speaker: a.speaker ?? 'COMMAND', text: a.text, expiresAtTick: state.tick + MESSAGE_SECONDS * SIM_TICK_RATE });
        break;
      case 'spawn': {
        for (const su of a.units) {
          const def = units.find(u => u.id === su.type);
          if (!def) continue;
          const target = a.attackMoveTo ? tileToWorldCenter(a.attackMoveTo) : null;
          const fm = factionFor(a.team);
          // CANONICAL factory (v0.42): trigger waves get flight, ammo, stealth,
          // shields — no more ground-pathing "bombers" with infinite rockets.
          state.store.create({
            position: tileToWorldCenter({ tx: su.tx, ty: su.ty }),
            ...unitComponents(def, a.team, fm, { target, attackMove: target != null }),
          });
        }
        break;
      }
      case 'grantCredits': {
        // TP-2: scripted rewards BYPASS the storage cap (QA: M14's +800 was
        // silently eaten because the mission started exactly at cap).
        grantCredits(state, a.team as 'player' | 'enemy', a.amount, true);
        break;
      }
      case 'reveal':
        break; // v1: accepted in data, not yet surfaced (fog integration later)
    }
  }

  return {
    messages,
    /** Dev kit (XP-1): which trigger ids have fired (for the trigger preview hook). */
    firedIds: (): string[] => [...fired],
    run(state, isObjectiveComplete): void {
      // Prune expired messages (view reads live ones).
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i]!.expiresAtTick <= state.tick) messages.splice(i, 1);
      }
      for (const t of triggers) {
        if (fired.has(t.id)) continue;
        const w = t.when;
        const due =
          (w.timeSeconds != null && state.tick >= Math.round(w.timeSeconds * SIM_TICK_RATE)) ||
          (w.credits != null && teamCredits(state, w.credits.team) >= w.credits.gte) ||
          (w.objectiveComplete != null && isObjectiveComplete(w.objectiveComplete)) ||
          (w.choice != null && w.choice === bootChoice);
        if (!due) continue;
        fired.add(t.id);
        for (const a of t.actions) act(state, a);
      }
    },
  };
}
