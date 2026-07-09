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
import { SIM_TICK_RATE } from '../loop.js';
import { modHp, modSpeed, FACTIONS, type TeamFactions } from '../factions.js';

export interface TriggerWhen {
  /** Fire at N seconds of match time. */
  timeSeconds?: number;
  /** Fire when a team's banked credits reach N. */
  credits?: { team: 'player' | 'enemy'; gte: number };
  /** Fire when the objective with this id completes. */
  objectiveComplete?: string;
}
export interface SpawnUnit { type: string; tx: number; ty: number }
export type TriggerAction =
  | { type: 'message'; speaker?: string; text: string }
  | { type: 'spawn'; team: 'player' | 'enemy'; units: SpawnUnit[]; attackMoveTo?: { tx: number; ty: number } }
  | { type: 'grantCredits'; team: 'player' | 'enemy'; amount: number }
  | { type: 'reveal'; region?: { tx: number; ty: number; r: number } }; // v1 no-op

export interface MissionTrigger { id: string; when: TriggerWhen; actions: TriggerAction[] }

export interface MissionMessage { speaker: string; text: string; expiresAtTick: number }

export interface TriggerRunner {
  /** Fired-message queue for the view (comm panel); pruned by tick. */
  readonly messages: MissionMessage[];
  run(state: SimState, isObjectiveComplete: (id: string) => boolean): void;
}

const MESSAGE_SECONDS = 8;

export function makeTriggerRunner(triggers: readonly MissionTrigger[], units: readonly UnitDef[], factions?: TeamFactions): TriggerRunner {
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
          const isHarvester = def.id === 'harvester';
          const target = a.attackMoveTo ? tileToWorldCenter(a.attackMoveTo) : null;
          const fm = factionFor(a.team);
          state.store.create({
            position: tileToWorldCenter({ tx: su.tx, ty: su.ty }),
            health: { hp: modHp(def.hp, fm), maxHp: modHp(def.hp, fm) },
            armor: { armorClass: def.armorClass },
            movement: { target, path: [], speed: modSpeed(def.speed, fm), attackMove: target != null },
            faction: { team: a.team, faction: def.id },
            ...(isHarvester
              ? { harvest: { state: 'SEEK' as const, targetTile: null, targetRefinery: null, cargo: 0 } }
              : { combat: { weaponId: def.weaponId, cooldownRemaining: 0, targetId: null } }),
          });
        }
        break;
      }
      case 'grantCredits': {
        const bank = state.store.all().find(e => e.components.faction?.team === a.team && e.components.economy)?.components.economy;
        if (bank) bank.credits = Math.min(bank.maxStorage, bank.credits + a.amount);
        break;
      }
      case 'reveal':
        break; // v1: accepted in data, not yet surfaced (fog integration later)
    }
  }

  return {
    messages,
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
          (w.objectiveComplete != null && isObjectiveComplete(w.objectiveComplete));
        if (!due) continue;
        fired.add(t.id);
        for (const a of t.actions) act(state, a);
      }
    },
  };
}
