# PROGRESS — Shard Dominion

> **REPO MOVED (2026-07-01):** canonical path is now `~/Code/games/shard-dominion` (was `~/projects/shard-dominion`).
> The operator relocated it as part of a file-system reorganization (games live under `~/Code/games`). The in-flight
> S4A-2 worker runs just found the old `/projects` path empty and blocked — no work lost; repo intact here. The empty
> stale dir was removed.


> The on-disk source of truth between slices. **Read this at the start of every packet; flush it at the end.**
> The plan lives in files (`../game-bakeoff/master-plan/MASTER_PLAN.md`); your window holds one slice.

## Current state

**PLAYABLE + LEGIBLE. S0→S6A + P0a/P0b/P0c + P1 complete.** `pnpm run verify`: **105 unit tests** ·
`pnpm run test:live`: **8 Playwright gates** (s0, s1, s2, s3, s5, s6a match, p0b train) — all green.

- **P1 visual-grammar pass (2026-07-02):** the "not even Dune-2000 level" fix — **view-only**
  (`renderer.ts` + `hud.ts`, zero sim/contract change). Units now draw as **oriented chassis
  silhouettes** (infantry torso+rifle/launcher, wedge vehicle w/ turret, chunky harvester, MCV crawler)
  with weapon tells + team stripe + contact shadows, facing their move/combat target. Terrain gets
  **deterministic per-tile texture** (sand grain, rock facets/cracks, dune ridges, glowing crystalline
  **shard flecks**) honoring all 3 fog states. Buildings are **grounded** (drop shadow + beveled body +
  type detail: refinery silos, barracks door, con-yard crane, power pylon). HUD is a framed **COMMAND
  panel** (credits ◈, power lamp, cargo/store bars, T/R build roster w/ affordability + live progress,
  hotkey legend). Done directly by Claude (aesthetic judgement + the builder can't see its output);
  verified via gate screenshots. **Deployed live v0.8.0.** Screenshots in `screenshots/`.

- **The full player loop now works:** harvest → bank credits → **T/R train infantry/rocket troopers from a
  barracks** → select/move (control groups) → RPS combat with fog → **destroy the enemy's units + producers to
  WIN** (P0a made buildings destructible). The AI does the same against you.
- **P0a destructible buildings (2026-07-02):** buildings get health + armor BUILDING; match is winnable. Fixed a
  victory regression (seen-tracking moved to a pre-cull existence scan so a first-tick kill still registers).
- **P0b player production (2026-07-02):** player Barracks seeded; **T = train infantry (100), R = train rocket
  trooper (200)**; HUD build hint; `__debugPlayerQueue` hook. Orchestrator finish-lined a readonly-queue type, an
  unused destructure, and 3 test-timing bugs (production drains the queue same-tick; wrong credit math; rocket
  needs 80 ticks not 65). Verified on screen (p0b gate: pressing T grows the player force).
- **P0c sustaining economy (2026-07-02):** replaced token demo seeding with a real field (natural shard 300 +
  a 3×3 home field at 800) — a single harvester banks 500→1900 in 30s then refills toward the 2000 cap. Fixed two
  fragile S2 gates the faster harvester exposed (move-test Y tolerance; box-select now targets the stationary base).
- **🌐 REDEPLOYED (2026-07-02): the PLAYABLE build is live at speedrungames.net/games/shard-dominion/** (v0.7.0,
  sourceCommit updated; manifest restored after an rm -rf dropped it). Verified live (95KB bundle 200, train caption).
- **AWAITING: operator play-test round 2** — the full loop now exists (train an army, fund it, destroy the enemy
  base to win). Then P1: §11.1 visual-grammar pass (the art complaint).
- **(done) P0c: sustaining economy** — shard fields are currently token demo density (~30s of income); give the
  player real, larger/regenerating fields so a full match is fundable. THEN redeploy to speedrungames.net +
  operator play-test round 2. THEN the §11.1 visual-grammar pass (the art complaint).
- **Not yet:** real sprites (S7 art pipeline), AI expand/rebuild (S6B), First Match Guidance (§5.9).

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
- **S3 build history (2026-07-01):** Built by alex-builder across the S3 packet + S3-FIX1 (both blocked at protocol-violation; retries capped at 2,
  so ~38 + ~11 min instead of the old 5-retry churn). The AGENTS.md investment helped TIME but did NOT prevent:
  a pinned-file edit (`coords.ts` TILE_SHIFT export — orchestrator reverted), inline `>> TILE_SHIFT` tile math
  (→ `worldToTile`), a duplicate `makeCommandQueue`, an unwired feature (deploy/place intents defined but never
  emitted), and BOTH tests skipped. S3-FIX1 wired the input but still skipped the tests. Orchestrator finish-lined:
  contract-cleaned, wired `input.setSimState`, fixed the placement-ghost-follows-cursor bug, added the
  `__debugBuildingCount`/`__debugConYardScreenPos` locators, and **authored both S3 tests** (verification is the
  orchestrator's job). See memory `project_local_builder_patterns`.
- **S4A-2 damage system (2026-07-01):** `src/sim/systems/damage.ts` (damage resolution: weapon.damage ×
  matrix[type][armorClass], cooldown tick, range check in WORLD units), additive `ArmorComponent` to
  `components.ts`, `tests/unit/combat.test.ts` (5 tests: damage multiplier, cooldown decrement, out-of-range
  no damage, cooldown reset, NONE armor fallback). All gates green (`pnpm run verify`: typecheck ✓, lint ✓,
  test ✓). The damage system runs in SYSTEM_ORDER after `combatTargeting` (so targets are set) and before
  `agitation`. Range check uses `Math.hypot` on WORLD positions converted via `TILE_SUBUNITS`. Cooldown
  conversion: seconds × `SIM_TICK_RATE` (20 Hz). No inline pixel math beyond the contract constant.

## Last verify (the S6A-2 gate)
```
pnpm run verify    → typecheck ✓  lint ✓  test ✓   (18 files, 96 tests; +6 ai tests: queue when affordable, no queue when poor, no attack below armySize, attack at armySize, no retarget of fighting units, end-to-end with production)
pnpm run test:live → 6 passed (12s)  — S3: D deploys ConYard, B+click places a Power Node → Supply 100, POWERED;
                     S0 motion + S1 economy + S2 selection + S4A combat + S5-1 fog + S6A-2 ai gates still green.
```

## Next steps (queued)
- **S6A-3** (`packets/S6A-3.md`): wire AI system into main.ts (add ai system to orderSystems, wire into game loop).

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
