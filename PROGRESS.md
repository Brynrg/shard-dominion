# PROGRESS — Shard Dominion

> The on-disk source of truth between slices. **Read this at the start of every packet; flush it at the end.**
> The plan lives in files (`../game-bakeoff/master-plan/MASTER_PLAN.md`); your window holds one slice.

## Current state
- **Slice:** S0 "blank→alive" — ✅ **DONE & VERIFIED** (built by alex-builder; finished-line by the orchestrator).
  The deployed bundle renders the map and one harvester that visibly moves; the S0 Playwright liveness gate is
  green with saved before/after screenshots (`screenshots/s0-capture{1,2}.png`).
- **Next packet:** `packets/S1.md` — harvester FSM economy + credits HUD + overflow readout.

## Done so far
- Repo scaffolded: TS + Canvas2D + Vite + Vitest + zod + ESLint, single package, pnpm. `pnpm run verify` green.
- **S0 alive (2026-06-30):** `src/view/{index,renderer}.ts` (canvas renderer + camera + rAF fixed-timestep
  driver + prev→current interpolation), `src/sim/systems/movement.ts` (minimal step-toward-target mover, sim-pure),
  `src/main.ts` (bootstrap: 1 refinery + 1 harvester w/ a movement target + `__debugHarvesterScreenPos` hook),
  `index.html`, `tests/liveness/s0.spec.ts` + `playwright.config.ts` (build+preview gate), `test:live` script,
  `@playwright/test` devDep. Contract layer untouched; guardrails held. Orchestrator finish-line fixes were
  mechanical only (CI-green): ESM `__dirname`, missing `page.goto('/')`, `noUncheckedIndexedAccess` guard,
  unused-symbol removal. **Flagged for review (NOT fixed — builder's lane):** the renderer reimplements the tick
  loop inline instead of using the contract `runTick`/`accumulate`; `__debugHarvesterScreenPos` hand-rolls the
  world→screen transform instead of reusing `worldToScreen`.
- **Immutable contract layer** written, compiled, and contract-tested (see `BUILD_CONSTITUTION.md` for the list):
  coords (3-space fixed-point), ids, components (one entity shape), store, grid (single spatial index), map
  (seeded), rng (mulberry32), hash (FNV-1a), state, loop (fixed-timestep + canonical SYSTEM_ORDER + **blocking
  determinism smoke**), combat-types, data schemas (units/buildings/weapons/**graphics/audio/onboarding**),
  loader (fail-fast + cross-ref), and locked `data/weapons.json` (matrix + values).
- **Both guardrails proven red-on-violation:** sim-purity (`Date`/`Math.random` in `src/sim`), and
  no-second-spatial-index (a system importing `makeGridManager`).

## Last verify (the S0 gate)
```
pnpm run verify    → typecheck ✓  lint ✓  test ✓   (7 files, 32 tests passing)
pnpm run test:live → 1 passed (7.2s)  — canvas exists, non-bg pixels > 5%, harvester moved >5px t≈1s→t≈3s
                     screenshots/s0-capture1.png (harvester right-of-center) + s0-capture2.png (moved left)
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
