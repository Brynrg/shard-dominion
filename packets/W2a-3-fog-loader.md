# Packet W2a-3 — `src/sim/systems/fog.ts` + `src/loaders/missions.ts` (part 3 of the trigger-vocabulary slice)

> Emit TWO complete files. Parts 1–2 landed the new trigger conditions/actions in
> `src/sim/systems/missionTriggers.ts` (context file — the `TriggerWhen` / `TriggerAction` types there are
> the source of truth; the zod schema must accept exactly those shapes). Sim-pure; no `any`; no unused imports.

## A. `src/sim/systems/fog.ts`
- Signature becomes `makeFogSystem(viewerTeam: 'player' | 'enemy' = 'player', extraVisible?: () => readonly { tx: number; ty: number; r: number }[])`.
- After the per-unit vision pass, for each region from `extraVisible?.() ?? []`: every tile with
  `(tx - region.tx)² + (ty - region.ty)² <= r²` inside the grid is added to BOTH `visible` and `explored`.
- Everything else unchanged (`FogSystem` interface, `VISION_TILES`, sets exposed on the returned object).

## B. `src/loaders/missions.ts`
Extend the trigger schema to match missionTriggers.ts:
- `when`: add `unitEnters: { team: Team, region: Region }`, `destroyed: { team: Team, kind: string }`,
  `hpBelow: { team: Team, kind: string, fraction: number (0<f<=1) }`, `triggerFired: string`, `delaySeconds: positive number` — all optional, alongside the existing `timeSeconds/credits/objectiveComplete/choice`.
- `actions` discriminated union: `message` gains optional `seconds` (positive); ADD
  `addObjective { objective: ObjectiveSchema }`, `completeObjective { id }`,
  `removeUnits { team: 'player'|'enemy'|'neutral', kind?: string, region?: Region }`,
  `panCamera { tx: int, ty: int }`; CHANGE `reveal` to `{ region: Region (REQUIRED), seconds?: positive }`.
  Keep `spawn` and `grantCredits` exactly as they are.
- Keep every other schema field, the `loadMission` error format, and the `_ObjectiveSync` / `_FailureSync` guards.
- The loader output for `triggers` must be assignable to `MissionTrigger[]` from missionTriggers.ts — add a third guard:
  `export type _TriggerSync = AssertAssignable<MissionTrigger, Mission['triggers'][number]>;` (import the type from `'../sim/systems/missionTriggers.js'`).

## Output format (STRICT)
```
=== FILE: src/sim/systems/fog.ts ===
…
=== END ===
=== FILE: src/loaders/missions.ts ===
…
=== END ===
```
