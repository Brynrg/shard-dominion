# AGENTS.md — Shard Dominion builder rules (READ BEFORE EVERY SLICE)

Distilled from the orchestrator's rework of slices S0–S2. **Every item below is a fix that had to be made
by hand because the builder didn't follow it.** Follow these and your slice ships without a rework round.
This file is also the portable pattern log — the same rules apply to any TS + Canvas2D + ECS sim build.

## 1. The sim/view boundary — THE most-violated rule
- `src/sim/**` is a **pure, deterministic** simulation: no DOM, no `Date`/wall-clock, no `Math.random`, and
  **no screen/view concepts** (no camera, no pixels, no selection rectangles). Only `src/view/**` may touch the
  screen, DOM, wall-clock, and rAF.
- **NEVER put view state on `SimState`** (camera, screen rects, render markers). **NEVER** reach across the
  boundary with `(state as any).foo`. If a sim system produces data the view needs (e.g. confirmation markers),
  **expose it on the system's returned object** and pass that to the view — do not stash it on `state`.
- **The camera lives in the view.** Camera panning is a view action applied straight to the view camera — it is
  **never** a sim command and never touches `SimState`.
- **All coordinate conversion goes through `src/sim/coords.ts`** (`screenToWorld` / `worldToScreen` /
  `screenToTile` / `worldToTile`). No inline pixel↔tile math anywhere. The **view converts screen→WORLD before
  queuing an intent**, so sim systems (e.g. the `command` system) work purely in world space and stay screen-blind.
- **One owner per concern.** One input handler (`src/view/input.ts`), one game loop (the contract
  `runTick`/`accumulate` from `loop.ts`), one spatial index. Do **not** duplicate mouse handlers in the renderer
  and do **not** reimplement the fixed-timestep loop — call the contract functions.

## 2. The immutable contract layer
- Never edit `src/sim/{coords,ids,store,grid,map,loop,rng,hash,state,combat-types}.ts`,
  `src/loaders/{schemas,loader}.ts`, or `data/weapons.json`. If one seems wrong, say so in `PROGRESS.md` — don't
  change it.
- **Additive exception:** you MAY add a new **optional component interface** to `components.ts` and add its field
  to the `Components` bag (the ECS needs component types there). You may NOT change existing component shapes, and
  you may NOT add non-ECS fields to `state.ts` (e.g. camera — that's a view concept; see §1).
- Register systems via `orderSystems([...])` so the pinned `SYSTEM_ORDER` holds (e.g. `harvest` runs after
  `movement`, `command` runs first). Never hand-order or hand-roll the tick.

## 3. Numbers & rates
- **Per-second rate → per-tick = `rate / SIM_TICK_RATE`** (import `SIM_TICK_RATE` from `loop.js`; the sim is
  **20 Hz**). Never hardcode `60` or guess the tick rate. (S1 shipped `dockRate / 60` → 3× too slow.)
- No magic numbers in systems. Read balance/config from a `data/*.json` behind a zod schema. If you need a new
  data file, add a **new** loader module (e.g. `src/loaders/economyConstants.ts`) — don't edit the pinned
  `schemas.ts`/`loader.ts`.

## 4. TypeScript / build hygiene (each of these has caused a typecheck/lint failure)
- ESM project: **no `__dirname`** — use `path.dirname(fileURLToPath(import.meta.url))`. JSON imports need
  `with { type: 'json' }`.
- `noUncheckedIndexedAccess` is ON: `arr[i]` is possibly `undefined` — guard with `?.` / `??` / `!`.
- **No `any`** (lint blocks it). Import the real types: `Entity`, `EntityId`, the component interfaces,
  `SimSystem` (NOT `System`).
- Get **relative import paths** right: a system in `src/sim/systems/` importing `src/loaders/` is
  `../../loaders/…` (two levels). Verify it resolves.
- Remove unused imports/vars/params. **Delete any debug/scratch files** before finishing (no `debug-*.ts`).

## 5. Tests & liveness gates — the gate must prove the slice's PROMISE
- **Model the liveness spec on the previous slice's spec** (`tests/liveness/s{n-1}.spec.ts`). It already has the
  correct ESM `__dirname`, `await page.goto('/')`, and the canvas-box click offset.
- The gate must assert the slice's **actual player-visible promise** (credits RISE, a ring RENDERS, the unit
  MOVED), not merely "some pixels exist." End every behavioral claim in a pixel/screenshot/debug-hook assertion.
- Unit tests assert **magnitude and correct semantics**, not just `> 0`. Give rate/drip mechanics **enough ticks
  to complete** (a 100 cr/s drip of 700 cargo needs ~140 deposit ticks, not 50).
- **Playwright clicks use VIEWPORT coords; debug hooks report CANVAS-relative coords** — offset every click by
  `const box = await canvas.boundingBox()` → `page.mouse.click(box.x + sx, box.y + sy)`.

## 6. Process
- Touch ONLY the files the packet's allowlist names. Make the smallest correct change.
- Before declaring done, **both** must be green (paste the real output): `pnpm run verify` (typecheck + lint +
  test) **and** `pnpm run test:live` (the liveness gate for this + prior slices).
- **Commit, then CALL `kanban_complete`.** Exiting without it wastes a full retry — this has happened on every
  slice so far. Don't.
