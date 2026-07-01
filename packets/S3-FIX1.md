# Packet S3-FIX1 — WIRE S3 so it actually works, and TEST it

> **Read `AGENTS.md`, `BUILD_CONSTITUTION.md`, `PROGRESS.md`, `packets/S3.md` first.** The S3 back-end exists and
> compiles, but the feature is **unwired and untested** — the player can't deploy, build, or place anything, and
> there are NO S3 tests. This packet makes it functional and proves it. Edit only the files below.

## What's broken (fix exactly this)
The `deploy` and `place-structure` intents are DEFINED but **never emitted**; `setPlacementMode` is **never
called**; `onMouseUp` always emits `select` even in placement mode; and the build-queue in `construction.ts` is
**never fed** (there's no queue intent). Result: nothing in S3 can be triggered. Also both required tests are
missing.

## The flow to implement (keep it SIMPLE — instant placement with a one-time cost)
Drop the drip-build-queue timing for now (deferred). Placement deducts the structure's cost **once**, on place.
1. **Deploy:** pressing **`D`** emits `{type:'deploy'}` → the existing command handler turns a player MCV into a
   Construction Yard. (Already implemented in `command.ts` — just wire the key.)
2. **Enter placement:** pressing **`B`** calls `input.setPlacementMode('power_node')` (only if a ConYard exists) —
   the placement ghost already renders VALID/INVALID + reason.
3. **Place:** while in placement mode, a **left-click** emits `{type:'place-structure', structureId, tile}` (NOT a
   select) using `screenToTile` for the tile, then exits placement mode. Right-click or **`Escape`** cancels
   placement. In `command.ts`'s `place-structure` handler, on a VALID placement **deduct `structure.cost` from the
   ConYard's `economy.credits`** (add an `INSUFFICIENT CREDITS` reason to `validatePlacement` when the nearest
   ConYard can't afford it) — instant, no drip.
4. **Power** already works via the `power` system (supply ≥ demand → `powered`). A placed Power Node adds supply.
5. **Concrete:** on-slab spawns at `onSlabHpFraction` HP, off-slab at `offSlabHpFraction` (this belongs in the
   place-structure spawn — set the building's `health` from the structure def × the slab fraction).

You MAY edit: `src/view/input.ts` (key/click wiring + emit deploy/place-structure), `src/sim/systems/command.ts`
(cost deduction + INSUFFICIENT CREDITS in `validatePlacement`; on/off-slab HP on spawn), `src/view/hud.ts` (a hint
line: `D deploy · B build Power Node`), `tests/unit/construction.test.ts` (create), `tests/liveness/s3.spec.ts`
(create). Do NOT touch the immutable contract layer; do NOT re-export `TILE_SHIFT` (use `worldToTile`); do NOT
re-add a duplicate `makeCommandQueue` (it lives in `input.ts`). The `construction.ts` drip-queue can stay unused
for now (or delete it if it's dead) — don't wire it.

## Tests (REQUIRED — the slice is not done without them)
- `tests/unit/construction.test.ts`: `validatePlacement` returns each reason for the right condition (invalid
  terrain / blocked tile / outside build radius / insufficient credits) and `{valid:true}` on a good tile; placing
  a structure deducts its cost once and sets on-slab HP > off-slab HP; the `power` system sets `powered` false when
  demand > supply and true when supply ≥ demand. (Push intents through a queue + `runTick`, like `command.test.ts`.)
- `tests/liveness/s3.spec.ts` (model on `s2.spec.ts`, offset clicks by `canvas.boundingBox()`): press `D` → a
  ConYard exists (add a `window.__debugBuildingCount()` or reuse a hook); press `B`, click a valid tile near the
  ConYard → a Power Node exists and credits dropped; enter placement again and hover an invalid tile → the
  one-reason label shows; assert `window.__debugPower().powered`. **S0/S1/S2 gates must still pass.**

## Acceptance (paste real output)
`pnpm run verify` green (incl. the new `construction.test.ts`) AND `pnpm run test:live` green (S3 works on screen +
S0/S1/S2 still pass) + one commit + update `PROGRESS.md` + **CALL `kanban_complete`**.
