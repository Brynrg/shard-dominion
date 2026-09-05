// ── Mission triggers: deterministic mid-mission events (FG-4 / campaign CP-2) ───
// W2 widened this from four conditions/four actions into a small WC3-class beat
// vocabulary. Conditions (ORed): timeSeconds · credits · objectiveComplete · choice ·
// unitEnters · destroyed · hpBelow · triggerFired, plus the delaySeconds MODIFIER.
// Actions: message · spawn · grantCredits · addObjective · completeObjective ·
// removeUnits · reveal (REAL — fog.ts reads activeReveals()) · panCamera (a VIEW
// request drained by main.ts; the camera never lives in the sim).
// Conditions read ONLY sim state + tick (no wall-clock, no RNG); every trigger
// fires at most once. Composed into the 'mission' SYSTEM_ORDER slot by
// objectives.ts, so the pinned loop contract is untouched.
import type { SimState } from '../state.js';
import type { EntityId } from '../ids.js';
import type { UnitDef } from '../../loaders/units.js';
import { tileToWorldCenter, TILE_SUBUNITS } from '../coords.js';
import { grantCredits } from '../ledger.js';
import { unitComponents } from '../factory.js';
import { SIM_TICK_RATE } from '../loop.js';
import { FACTIONS, type TeamFactions } from '../factions.js';
import type { Objective } from './objectives.js';

export type Team = 'player' | 'enemy';
export interface Region { tx: number; ty: number; r: number }   // r in TILES

export function anyLiving(state: SimState, team: Team, kind?: string): boolean {
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

export function anyExists(state: SimState, team: Team, kind?: string): boolean {
  for (const e of state.store.all()) {
    const f = e.components.faction;
    if (!f || f.team !== team) continue;
    if (kind && f.faction !== kind) continue;
    return true;
  }
  return false;
}

export function teamUnitInRegion(state: SimState, team: Team, region: Region): boolean {
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

export interface TriggerWhen {
  /** Fire at N seconds of match time. */
  timeSeconds?: number;
  /** Fire when a team's banked credits reach N. */
  credits?: { team: 'player' | 'enemy'; gte: number };
  /** Fire when the objective with this id completes. */
  objectiveComplete?: string;
  /** XP-6: fire when the mission's boot choice matches (evaluated from tick 1). */
  choice?: string;
  /** Fire when a living team unit is inside the region. */
  unitEnters?: { team: Team; region: Region };
  /** Latch: fire when a (team, kind) entity has ever existed and is now all dead. */
  destroyed?: { team: Team; kind: string };
  /** Fire when some living (team, kind) entity has hp/maxHp <= fraction. */
  hpBelow?: { team: Team; kind: string; fraction: number };
  /** Fire when the trigger with this id has already fired. */
  triggerFired?: string;
  /** MODIFIER: when the OR of the other conditions first turns true at tick T0, fire at T0 + round(delaySeconds*SIM_TICK_RATE). */
  delaySeconds?: number;
}
export interface SpawnUnit { type: string; tx: number; ty: number }
export type TriggerAction =
  | { type: 'message'; speaker?: string; text: string; seconds?: number }
  | { type: 'spawn'; team: 'player' | 'enemy' | 'neutral'; units: SpawnUnit[]; attackMoveTo?: { tx: number; ty: number } }
  | { type: 'grantCredits'; team: 'player' | 'enemy'; amount: number }
  | { type: 'addObjective'; objective: Objective }
  | { type: 'completeObjective'; id: string }
  | { type: 'removeUnits'; team: Team | 'neutral'; kind?: string; region?: Region }
  | { type: 'reveal'; region: Region; seconds?: number }
  | { type: 'panCamera'; tx: number; ty: number };

export interface MissionTrigger { id: string; when: TriggerWhen; actions: TriggerAction[] }

export interface MissionMessage { speaker: string; text: string; expiresAtTick: number }

export interface TriggerHost {
  isObjectiveComplete(id: string): boolean;
  addObjective(o: Objective): void;
  forceComplete(id: string): void;
}

export interface TriggerRunner {
  readonly messages: MissionMessage[];
  readonly reveals: { region: Region; untilTick: number }[];
  readonly cameraRequests: { tx: number; ty: number; tick: number }[];
  firedIds(): string[];
  activeReveals(): readonly Region[];
  run(state: SimState, host: TriggerHost): void;
}

const MESSAGE_SECONDS = 8;

export function makeTriggerRunner(triggers: readonly MissionTrigger[], units: readonly UnitDef[], factions?: TeamFactions, bootChoice: string | null = null): TriggerRunner {
  const factionFor = (team: string) => (team === 'player' ? (factions?.player ?? FACTIONS.concord) : (factions?.enemy ?? FACTIONS.concord));
  const fired = new Set<string>();
  const messages: MissionMessage[] = [];
  const reveals: { region: Region; untilTick: number }[] = [];
  const cameraRequests: { tx: number; ty: number; tick: number }[] = [];
  const everSeen = new Map<string, boolean>();
  const delayStart = new Map<string, number>();

  function teamCredits(state: SimState, team: string): number {
    let c = 0;
    for (const e of state.store.all()) {
      if (e.components.faction?.team === team && e.components.economy) c += e.components.economy.credits;
    }
    return c;
  }

  function act(state: SimState, a: TriggerAction, host: TriggerHost): void {
    switch (a.type) {
      case 'message':
        messages.push({ speaker: a.speaker ?? 'COMMAND', text: a.text, expiresAtTick: state.tick + (a.seconds ?? MESSAGE_SECONDS) * SIM_TICK_RATE });
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
      case 'addObjective':
        host.addObjective(a.objective);
        break;
      case 'completeObjective':
        host.forceComplete(a.id);
        break;
      case 'removeUnits': {
        const ids: EntityId[] = [];
        for (const e of state.store.all()) {
          const f = e.components.faction;
          if (!f || f.team !== a.team) continue;
          if (a.kind && f.faction !== a.kind) continue;
          if (e.components.movement || e.components.combat) {
            if ((e.components.health?.hp ?? 1) <= 0) continue;
            if (a.region) {
              const p = e.components.position;
              if (!p) continue;
              const c = tileToWorldCenter({ tx: a.region.tx, ty: a.region.ty });
              const rWorld = a.region.r * TILE_SUBUNITS;
              if (Math.hypot(p.wx - c.wx, p.wy - c.wy) > rWorld) continue;
            }
            ids.push(e.id);
          }
        }
        for (const id of ids) state.store.remove(id);
        break;
      }
      case 'reveal':
        reveals.push({ region: a.region, untilTick: state.tick + Math.round((a.seconds ?? 15) * SIM_TICK_RATE) });
        break;
      case 'panCamera':
        cameraRequests.push({ tx: a.tx, ty: a.ty, tick: state.tick });
        break;
    }
  }

  return {
    messages,
    reveals,
    cameraRequests,
    /** Dev kit (XP-1): which trigger ids have fired (for the trigger preview hook). */
    firedIds: (): string[] => [...fired],
    activeReveals: (): readonly Region[] => reveals.map(r => r.region), // run() prunes expired entries
    run(state, host): void {
      // Prune expired messages (view reads live ones).
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i]!.expiresAtTick <= state.tick) messages.splice(i, 1);
      }
      // Prune expired reveals.
      for (let i = reveals.length - 1; i >= 0; i--) {
        if (reveals[i]!.untilTick <= state.tick) reveals.splice(i, 1);
      }
      for (const t of triggers) {
        if (fired.has(t.id)) continue;
        const w = t.when;
        // delaySeconds: once the base condition has turned true, only the clock matters.
        const started = delayStart.get(t.id);
        if (started != null) {
          if (state.tick < started + Math.round((w.delaySeconds ?? 0) * SIM_TICK_RATE)) continue;
          fired.add(t.id);
          for (const a of t.actions) act(state, a, host);
          continue;
        }
        const baseDue =
          (w.timeSeconds != null && state.tick >= Math.round(w.timeSeconds * SIM_TICK_RATE)) ||
          (w.credits != null && teamCredits(state, w.credits.team) >= w.credits.gte) ||
          (w.objectiveComplete != null && host.isObjectiveComplete(w.objectiveComplete)) ||
          (w.choice != null && w.choice === bootChoice) ||
          (w.unitEnters != null && teamUnitInRegion(state, w.unitEnters.team, w.unitEnters.region)) ||
          (w.destroyed != null && (everSeen.get(t.id) ?? false) && !anyLiving(state, w.destroyed.team, w.destroyed.kind)) ||
          (w.hpBelow != null && (() => {
            for (const e of state.store.all()) {
              const f = e.components.faction;
              if (!f || f.team !== w.hpBelow.team) continue;
              if (w.hpBelow.kind && f.faction !== w.hpBelow.kind) continue;
              const h = e.components.health;
              if (!h || h.hp <= 0) continue;
              if (h.maxHp > 0 && h.hp / h.maxHp <= w.hpBelow.fraction) return true;
            }
            return false;
          })()) ||
          (w.triggerFired != null && fired.has(w.triggerFired));
        if (w.destroyed != null && anyExists(state, w.destroyed.team, w.destroyed.kind)) {
          everSeen.set(t.id, true);
        }
        if (!baseDue) continue;
        if (w.delaySeconds != null) { delayStart.set(t.id, state.tick); continue; }
        fired.add(t.id);
        for (const a of t.actions) act(state, a, host);
      }
    },
  };
}
