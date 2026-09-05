# Packet W2a — mission trigger vocabulary: new conditions, new actions, REAL reveal, camera pan

> Orchestrated build (branch `feat/wc3-parity`). Read `AGENTS.md` §1 (sim/view boundary) and §4.
> Today `when` has 4 conditions and there are 4 actions, and `reveal` is a no-op. This packet
> widens both so missions can script WC3-class beats. The sim stays pure: no DOM, no Date, no
> Math.random, no view state on `SimState`. Anything the VIEW must act on (camera pan) is exposed
> on the system's returned object, exactly like `messages` already is.

## Files you emit (complete files, every existing export preserved)
1. `src/sim/systems/missionTriggers.ts`
2. `src/sim/systems/objectives.ts`
3. `src/sim/systems/fog.ts`
4. `src/loaders/missions.ts`

## 1. New trigger CONDITIONS (`TriggerWhen`, OR-combined with the existing four; a trigger still fires at most once)
```ts
unitEnters?: { team: 'player' | 'enemy'; region: { tx: number; ty: number; r: number } };
  // a LIVING unit (has movement or combat, no building component, hp>0) of `team` is inside the region (world distance ≤ r tiles)
destroyed?: { team: 'player' | 'enemy'; kind: string };
  // latch: an entity of (team,kind) has EXISTED at some tick, and now none is living — same rule as the `destroy` objective
hpBelow?: { team: 'player' | 'enemy'; kind: string; fraction: number };
  // some living (team,kind) entity has health.hp / health.maxHp <= fraction
triggerFired?: string;
  // the trigger with that id has already fired (chaining). Evaluate against the fired-set as it stands when this trigger is checked (array order — deterministic).
delaySeconds?: number;
  // MODIFIER, not a condition: when the OR of the other conditions first becomes true at tick T0, the trigger fires at
  // T0 + round(delaySeconds * SIM_TICK_RATE) instead (record T0 in a Map<id, tick>; the condition is NOT re-checked at fire time).
  // Lets `{ choice: 'seal', delaySeconds: 75 }` mean "75s into the mission on the SEAL branch".
```
Reuse the existing helpers in objectives.ts where sensible (`teamUnitInRegion`, `anyLiving`, `anyExists`) — EXPORT them from objectives.ts and import into missionTriggers.ts, OR move them into missionTriggers.ts and import from there; avoid a circular import (objectives.ts already imports missionTriggers.ts, so put shared helpers in missionTriggers.ts and have objectives.ts import them).

## 2. New trigger ACTIONS (`TriggerAction` union)
```ts
| { type: 'message'; speaker?: string; text: string; seconds?: number }       // seconds = on-screen duration, default 8 (existing MESSAGE_SECONDS)
| { type: 'addObjective'; objective: Objective }                              // append to the LIVE objective list (see §3)
| { type: 'completeObjective'; id: string }                                   // force an objective complete (scripted beat)
| { type: 'removeUnits'; team: 'player' | 'enemy' | 'neutral'; kind?: string; region?: Region }
     // state.store.remove(id) every LIVING non-building entity matching team (+kind, +inside region). Collect ids first, then remove.
| { type: 'reveal'; region: Region; seconds?: number }                        // NOW REAL: see §4. default seconds = 15
| { type: 'panCamera'; tx: number; ty: number }                               // VIEW request: push {tx,ty,tick} onto `cameraRequests` (see §5)
```
`Region` = `{ tx, ty, r }` (existing). Keep `spawn` and `grantCredits` exactly as they are.

## 3. objectives.ts — live objective list
- Keep the constructor signature `makeObjectivesSystem(objectives, failures, triggers, units, factions, bootChoice)`.
- Copy `objectives` into a mutable local array `live: Objective[]`. `addObjective` appends to it (via a callback the trigger runner receives). Latch maps are keyed by index — appended objectives get new indices, which is fine.
- `completeObjective` marks an id in a `forced: Set<string>`; `completed()` returns true for forced ids.
- `result.objectives` is rebuilt from `live` each tick (so the HUD shows added objectives).
- The trigger runner needs: `isObjectiveComplete(id)` (existing), `addObjective(o)`, `forceComplete(id)`. Pass them in a small `TriggerHost` interface: `{ isObjectiveComplete(id): boolean; addObjective(o: Objective): void; forceComplete(id: string): void }`.

## 4. fog.ts — reveal support
- `makeFogSystem(viewerTeam, extraVisible?: () => readonly { tx: number; ty: number; r: number }[])`.
- Each tick after unit vision, for every region from `extraVisible()`, add every tile with `(tx-cx)²+(ty-cy)² ≤ r²` (clamped to the grid) to BOTH `visible` and `explored`.
- missionTriggers.ts keeps `reveals: { region: Region; untilTick: number }[]` on the runner, pruned when `untilTick <= state.tick`; the ObjectivesSystem re-exports it as `activeReveals(): readonly Region[]` (regions whose untilTick > current tick — store the last tick seen in `run`). main.ts (orchestrator) wires `makeFogSystem(team, () => objectivesSystem.activeReveals())`.

## 5. Camera requests (view boundary)
- `TriggerRunner.cameraRequests: { tx: number; ty: number; tick: number }[]` — pushed by `panCamera`, drained by the view (the orchestrator wires `main.ts`; you only expose the array on the ObjectivesSystem as `cameraRequests`).

## 6. Loader (`src/loaders/missions.ts`)
Extend the zod `when` object and the `actions` discriminated union to match §1–§2 exactly. `addObjective.objective` uses the existing `ObjectiveSchema`. `message` gains optional `seconds` (positive number). `reveal` becomes `{ type: 'reveal', region: Region, seconds?: positive }` (region now REQUIRED). `removeUnits.team` allows `'neutral'`. Keep the `_ObjectiveSync` / `_FailureSync` type guards.

## Constraints
- `noUncheckedIndexedAccess` on; no `any`; no unused imports; `SIM_TICK_RATE` from `../loop.js` for seconds→ticks; never `Math.random`/`Date`.
- Every trigger fires at most once; conditions are ORed exactly like today.
- Keep all existing behaviour and exports (`MissionMessage`, `MissionTrigger`, `TriggerRunner`, `firedIds`, `messages`, `ObjectivesSystem`, `Objective`, `Failure`, `Region`, `Team`).

## Output format (STRICT)
```
=== FILE: <repo-relative path> ===
<complete file content>
=== END ===
```
Four blocks, no prose outside them.
