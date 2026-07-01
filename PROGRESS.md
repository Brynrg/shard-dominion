# PROGRESS — Shard Dominion

> The on-disk source of truth between slices. **Read this at the start of every packet; flush it at the end.**
> The plan lives in files (`../game-bakeoff/master-plan/MASTER_PLAN.md`); your window holds one slice.

## Current state
- **Slice:** S3 "deploy & build" — ⏳ **IN PROGRESS (INCOMPLETE)**. The builder wrote the back-end
  (`construction`/`power` systems, `structures` loader+data, deploy/place-structure command handling, placement
  ghost + slab rendering, `__debugPower`) and it compiles + lints; **S0/S1/S2 gates still pass**. The orchestrator
  contract-cleaned it (reverted a pinned `coords.ts` edit that exported `TILE_SHIFT`; renderer now uses
  `worldToTile`; renderer reuses the single `validatePlacement`; removed a duplicate `makeCommandQueue`; lint).
  **BUT S3 is not functional or verified:** the `deploy`/`place-structure` intents are defined but **never emitted**
  (no input wiring — `onMouseUp` always selects, nothing enters placement mode or queues a build), and **both
  required tests are missing** (`construction.test.ts`, `s3.spec.ts`). → bounced as `packets/S3-FIX1.md`.
- **Next:** finish S3 via S3-FIX1 (input wiring + the two tests), verify, then S4A (combat).

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

## Last verify (the S2 gate)
```
pnpm run verify    → typecheck ✓  lint ✓  test ✓   (9 files, 45 tests; +6 command: select/move/deselect/markers)
pnpm run test:live → 4 passed (11s)  — S2: click-select ring, box-select, right-click move + confirmation marker;
                     S0 motion + S1 economy gates still green.  screenshots/s2-capture{1,2,3}.png
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
