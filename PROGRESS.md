# PROGRESS — Shard Dominion

> ⚠️ **REPO MOVED (2026-07-01):** canonical path is now `~/Code/games/shard-dominion` (was `~/projects/shard-dominion`).
> The S4A-2 worker `mv`'d the repo here (following the machine `~/AGENTS.md` "games live in ~/Code" convention) and
> emptied `/projects` mid-build — recovered intact from this copy; empty stale dir removed; AGENTS.md §0 now forbids it.


> The on-disk source of truth between slices. **Read this at the start of every packet; flush it at the end.**
> The plan lives in files (`../game-bakeoff/master-plan/MASTER_PLAN.md`); your window holds one slice.

## Current state
- **Slice:** S3 "deploy & build" (core) — ✅ **DONE & VERIFIED**. Press **D** → the MCV becomes a Construction
  Yard; press **B** → placement mode for a Power Node; left-click a valid tile → it's placed and supplies power
  (HUD reads `POWER: OK · Supply 100 · Demand 0`). Placement validates VALID/INVALID with one reason. Gates green
  (`screenshots/s3-capture.png`).
- **DEFERRED from S3 (fold into a later slice, e.g. S3B or alongside S4):** placement is currently FREE (no cost
  deduction / `INSUFFICIENT CREDITS`), no on/off-slab HP variance, concrete-slab placement + staged power bands
  not wired, and `construction.ts`'s drip-build queue is dead code (never fed) — remove or wire it later.
- **Next packet:** `packets/S4A.md` — first combat (written + dispatched). ⏸️ **BARELY STARTED / LOOP PAUSED.**
  The builder produced ONLY the data model (`data/units.json` infantry+vehicle, `src/loaders/units.ts` schema)
  across 2 short runs then protocol-violated — NO combat systems (targeting/damage/victory), no wiring, no
  renderer, no tests. Loop paused for an operator decision (see the S0-S4A summary below + memory
  `project_local_builder_patterns`). The units data+loader are committed as a WIP checkpoint; S0-S3 all green.

## Done so far
- Repo scaffolded: TS + Canvas2D + Vite + Vitest + zod + ESLint, single package, pnpm. `pnpm run verify` green.
- **S0 alive (2026-06-30):** `src/view/{index,renderer}.ts` (canvas renderer + camera + rAF fixed-timestep
  driver + prev→current interpolation), `src/sim/systems/movement.ts` (minimal step-toward-target mover, sim-pure),
  `src/main.ts` (bootstrap: 1 refinery + 1 harvester w/ a movement target + `__debugHarvesterScreenPos` hook),
  `index.html`, `tests/liveness/s0.spec.ts` + `playwright.config.ts` (build+preview gate), `test:live` script,
  `@playwright/test` devDep. Contract layer untouched; guardrails held. Orchestrator finish-line fixes were
  mechanical only (CI-green): ESM `__dirname`, missing `page.goto('/')`, `noUncheckedIndexedAccess` guard,
  unused-symbol removal.
- **S0 contract-compliance pass (2026-06-30, operator-approved):** the two flagged deviations are now FIXED.
  The renderer drives the sim through the contract `accumulate()` + `runTick()` (was an inline reimplemented
  loop — a BUILD_CONSTITUTION §51-55 anti-pattern; also fixed a latent bug where multi-tick catch-up counted
  steps but only ran systems once, so the sim under-advanced on slow frames). `__debugHarvesterScreenPos` now
  reuses `worldToScreen` instead of a hand-rolled transform. SYSTEM_ORDER + determinism are now owned by the
  contract loop — the foundation S1's `harvest`-after-`movement` ordering depends on. Both gates still green.
- **Immutable contract layer** written, compiled, and contract-tested (see `BUILD_CONSTITUTION.md` for the list):
  coords (3-space fixed-point), ids, components (one entity shape), store, grid (single spatial index), map
  (seeded), rng (mulberry32), hash (FNV-1a), state, loop (fixed-timestep + canonical SYSTEM_ORDER + **blocking
  determinism smoke**), combat-types, data schemas (units/buildings/weapons/**graphics/audio/onboarding**),
  loader (fail-fast + cross-ref), and locked `data/weapons.json` (matrix + values).
- **Both guardrails proven red-on-violation:** sim-purity (`Date`/`Math.random` in `src/sim`), and
  no-second-spatial-index (a system importing `makeGridManager`).
- **S1 economy visible (2026-06-30):** `src/sim/systems/harvest.ts` (harvester FSM SEEK→HARVEST→RETURN→DOCK),
  `src/view/hud.ts` (credits + cargo + storage bars, overflow warning), `src/loaders/economyConstants.ts` + zod
  schema + `data/economyConstants.json` (harvest 25, cap 700, dock 100/s, store 2000 — a NEW loader file, the
  pinned `schemas.ts`/`loader.ts` untouched), `tests/unit/economy.test.ts` (7 FSM tests incl. magnitude +
  overflow), `tests/liveness/s1.spec.ts`. Additive-only edits to pinned `components.ts` (EconomyComponent,
  HarvestComponent) + `state.ts` (`shardDensity` map) — accepted as necessary ECS growth (the bag is additive;
  see BUILD_CONSTITUTION note). **History:** built by alex-builder across two rounds; round-1 had 2 missing FSM
  transitions + a wrong economy model, bounced as `packets/S1-FIX1.md`; round-2 nailed the design + the magnitude
  tests but left finish-line defects (dock drip `/60`→should be `/SIM_TICK_RATE`, an overflow deadlock, a
  self-defeating demo seed, an unwired gate assertion, drip-vs-window test mismatch) which the orchestrator
  finish-lined. Economy semantics: single credits pool, docking drips cargo→credits at 100 cr/s (1:1), capped at
  2000, overflow LOST. (Harvest fill rate is per-tick/provisional for a snappy demo; final balance is S6D's job.)
- **Known minor follow-ups (non-blocking):** shard density isn't rendered as visual depletion yet (mechanic is
  unit-tested + HUD-readable, not tile-colored); `shardDensity` isn't in `stateHash` yet (a determinism gap that
  matters at S5, not now).
- **S2 select & command (2026-06-30):** `src/view/input.ts` (mouse/keyboard → WORLD-space intents via the contract
  coord fns; the view owns the camera), `src/sim/systems/command.ts` (the `command` SimSystem — first in
  SYSTEM_ORDER — drains intents, applies selection/move, owns confirmation markers), renderer extended (selection
  rings, dashed box, fading move markers), additive `SelectionComponent` + `HarvestComponent.state` gained `IDLE`.
  `tests/unit/command.test.ts` (6) + `tests/liveness/s2.spec.ts` (click-select, box-select, move+marker).
  **History:** built by alex-builder (blocked at 5 protocol-violations, as usual). The build had an **architecture
  violation** the orchestrator corrected: camera (a screen concept) was put on the pinned `SimState` and read via
  `(state as any)`, and the renderer duplicated input handling. Fix: camera is now VIEW-ONLY (pan applied straight
  to the view camera, never a sim command); input converts screen→world before queuing so the command system is
  screen-blind; markers are exposed on the command system (not stashed on state); renderer's duplicate handlers
  removed; syntax error + a marker double-decrement fixed; Playwright clicks offset by the canvas box. The sim/view
  boundary is clean again — no `as any`, no camera on the sim contract.

## S3 build history (2026-07-01)
- Built by alex-builder across the S3 packet + S3-FIX1 (both blocked at protocol-violation; retries capped at 2,
  so ~38 + ~11 min instead of the old 5-retry churn). The AGENTS.md investment helped TIME but did NOT prevent:
  a pinned-file edit (`coords.ts` TILE_SHIFT export — orchestrator reverted), inline `>> TILE_SHIFT` tile math
  (→ `worldToTile`), a duplicate `makeCommandQueue`, an unwired feature (deploy/place intents defined but never
  emitted), and BOTH tests skipped. S3-FIX1 wired the input but still skipped the tests. Orchestrator finish-lined:
  contract-cleaned, wired `input.setSimState`, fixed the placement-ghost-follows-cursor bug, added the
  `__debugBuildingCount`/`__debugConYardScreenPos` locators, and **authored both S3 tests** (verification is the
  orchestrator's job). See memory `project_local_builder_patterns`.

## Last verify (the S3 gate)
```
pnpm run verify    → typecheck ✓  lint ✓  test ✓   (10 files, 50 tests; +5 construction: placement reasons + power)
pnpm run test:live → 5 passed (11s)  — S3: D deploys ConYard, B+click places a Power Node → Supply 100, POWERED;
                     S0 motion + S1 economy + S2 selection gates still green.  screenshots/s3-capture.png
```

## Next steps (queued)
- **S1** (`packets/S1.md`): harvester FSM economy + credits HUD + overflow readout.

## Open questions / blocked
- **RESOLVED (2026-06-30): the tool-call blocker.** Root cause was NOT mlx_lm version (0.31.3 is latest) and NOT
  a timeout. The model's own `tokenizer_config.json` had `"tool_parser_type": "json_tools"`, but Qwen3-Coder-Next
  emits XML-style tool calls (`<tool_call>\n<function=name>\n<parameter=x>…</parameter></function></tool_call>`).
  The `json_tools` parser does `json.loads()` on that → JSONDecodeError → mlx_lm silently drops the call →
  `finish_reason: tool_calls` with an empty array (server.py:82-87). Fix: changed `tool_parser_type` →
  `"qwen3_coder"` (the matching parser already ships in mlx_lm/tool_parsers/) and kickstarted the coder. Verified:
  the probe now returns `read_file {"path":"sample.ts"}`, and an end-to-end kanban worker task (alex-builder)
  read a file, wrote summary.md, and called kanban_complete. Backup: tokenizer_config.json.bak.json_tools in the
  model dir. (Implication: the bake-off Axis-2 verdict's caveat stands — the local Qwen could not tool-call
  before this fix, so those agentic edits came via the glm-4.5-air fallback, not the local coder.)
- Timeout: SORTED (config hardened to request 1200s / stale 600s, self-contained; verified 0 recurrence).

---
### Ledger protocol (do not delete)
At the **start** of a packet: read this whole file. At the **end** of a slice: update *Current state*, move the
finished item to *Done so far*, paste the real *Last verify* output, and record any *Open questions*. The
mechanical halt between slices is the moment this file is guaranteed written to disk.
