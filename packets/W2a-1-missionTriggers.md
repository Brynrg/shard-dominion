# Packet W2a-1 — `src/sim/systems/missionTriggers.ts` only (part 1 of the trigger-vocabulary slice)

> Emit ONE complete file: `src/sim/systems/missionTriggers.ts`. Keep every existing export
> (`TriggerWhen`, `SpawnUnit`, `TriggerAction`, `MissionTrigger`, `MissionMessage`, `TriggerRunner`,
> `makeTriggerRunner`) and all existing behaviour (message/spawn/grantCredits; fire-once; OR conditions).
> Sim-pure: no DOM/Date/Math.random. `noUncheckedIndexedAccess` on; no `any`; no unused imports.

## Shared helpers (move them HERE from objectives.ts and EXPORT them — objectives.ts will import them in part 2)
```ts
export type Team = 'player' | 'enemy';
export interface Region { tx: number; ty: number; r: number }   // r in TILES
export function anyLiving(state: SimState, team: Team, kind?: string): boolean   // hp<=0 counts dead
export function anyExists(state: SimState, team: Team, kind?: string): boolean   // ever present, ignoring hp
export function teamUnitInRegion(state: SimState, team: Team, region: Region): boolean // living UNIT (movement||combat, no building) within r tiles (world distance via tileToWorldCenter + TILE_SUBUNITS)
```
(Their current bodies are in the objectives.ts context file — copy them verbatim.)

## New CONDITIONS on `TriggerWhen` (OR-combined with the existing four)
```ts
unitEnters?: { team: Team; region: Region };          // teamUnitInRegion(...)
destroyed?: { team: Team; kind: string };             // latch: anyExists seen at some tick AND now !anyLiving (keep a Map<triggerId, boolean> everSeen)
hpBelow?: { team: Team; kind: string; fraction: number }; // some living (team,kind) entity has hp/maxHp <= fraction
triggerFired?: string;                                // that trigger id is already in the fired set (array order — deterministic)
delaySeconds?: number;                                // MODIFIER: when the OR of the other conditions first turns true at tick T0 (store in Map<id, tick>), fire at T0 + round(delaySeconds*SIM_TICK_RATE); do NOT re-check the condition at fire time
```

## New ACTIONS on `TriggerAction` (keep spawn + grantCredits unchanged)
```ts
| { type: 'message'; speaker?: string; text: string; seconds?: number }   // seconds = on-screen duration, default 8
| { type: 'addObjective'; objective: Objective }     // host.addObjective(o)   (Objective type: import type { Objective } from './objectives.js' — TYPE-ONLY import is fine)
| { type: 'completeObjective'; id: string }          // host.forceComplete(id)
| { type: 'removeUnits'; team: Team | 'neutral'; kind?: string; region?: Region }  // collect ids of LIVING non-building matches first, then state.store.remove(id) each
| { type: 'reveal'; region: Region; seconds?: number }  // push { region, untilTick: state.tick + round((seconds ?? 15) * SIM_TICK_RATE) } onto `reveals`
| { type: 'panCamera'; tx: number; ty: number }      // push { tx, ty, tick: state.tick } onto `cameraRequests` (a VIEW request — the view drains it)
```

## Runner interface
```ts
export interface TriggerHost {
  isObjectiveComplete(id: string): boolean;
  addObjective(o: Objective): void;
  forceComplete(id: string): void;
}
export interface TriggerRunner {
  readonly messages: MissionMessage[];
  readonly reveals: { region: Region; untilTick: number }[];      // pruned in run() when untilTick <= state.tick
  readonly cameraRequests: { tx: number; ty: number; tick: number }[];
  firedIds(): string[];
  activeReveals(): readonly Region[];                              // regions of the un-pruned entries
  run(state: SimState, host: TriggerHost): void;                   // signature CHANGES: host object instead of the bare callback
}
```
`makeTriggerRunner(triggers, units, factions?, bootChoice = null)` — same constructor signature as today.

## Output format (STRICT)
```
=== FILE: src/sim/systems/missionTriggers.ts ===
…complete file…
=== END ===
```
