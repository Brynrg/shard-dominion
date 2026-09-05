# Packet W2a-2 — `src/sim/systems/objectives.ts` only (part 2 of the trigger-vocabulary slice)

> Emit ONE complete file: `src/sim/systems/objectives.ts`. Part 1 already landed
> `src/sim/systems/missionTriggers.ts` (context file) which now EXPORTS the shared helpers
> `Team`, `Region`, `anyLiving`, `anyExists`, `teamUnitInRegion`, plus `TriggerHost` and a runner whose
> `run(state, host)` takes a host object. Sim-pure; `noUncheckedIndexedAccess`; no `any`; no unused imports.

## Requirements
1. **Import, don't duplicate**: `import { makeTriggerRunner, anyLiving, anyExists, teamUnitInRegion, type MissionTrigger, type MissionMessage, type Region, type Team, type TriggerHost } from './missionTriggers.js';` and `export type { Region, Team, MissionTrigger, MissionMessage } from './missionTriggers.js';` (keep every name that other files import from objectives.ts today: `Objective`, `Failure`, `ObjectiveStatus`, `ObjectivesResult`, `ObjectivesSystem`, `Team`, `Region`, `makeObjectivesSystem`, `MissionTrigger`, `MissionMessage`).
   NOTE the circular type reference: missionTriggers.ts does `import type { Objective } from './objectives.js'` — TYPE-only in both directions is fine; do NOT add a runtime import of objectives.ts inside missionTriggers.ts.
2. **Live objective list**: copy the constructor's `objectives` into `const live: Objective[] = [...objectives]`. `result.objectives` is rebuilt from `live` every tick. Keep the latch maps keyed by index (`everSeen`, `everReached`, `holdTicks`) — appended objectives get fresh indices.
3. **Forced completion**: `const forced = new Set<string>()`; `completed(o, i, state)` returns true first if `o.id && forced.has(o.id)`.
4. **Host** passed to the runner each tick:
   ```ts
   const host: TriggerHost = {
     isObjectiveComplete: (id) => completedIds.has(id),
     addObjective: (o) => { live.push(o); },
     forceComplete: (id) => { forced.add(id); },
   };
   ```
5. **ObjectivesSystem** gains: `activeReveals(): readonly Region[]` (delegates to the runner) and `cameraRequests: { tx: number; ty: number; tick: number }[]` (the runner's array, same object). Keep `messages`, `firedTriggerIds`, `result`, `name: 'mission'`.
6. Constructor signature unchanged: `makeObjectivesSystem(objectives, failures = [], triggers = [], units = [], factions?, bootChoice = null)`.
7. Keep the defeat tracker (`makeDefeatTracker`) usage, the contested-hold rule, lose-over-win priority, sticky decision — all existing behaviour.

## Output format (STRICT)
```
=== FILE: src/sim/systems/objectives.ts ===
…complete file…
=== END ===
```
