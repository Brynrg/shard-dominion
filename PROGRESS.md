# PROGRESS — Shard Dominion

> The on-disk source of truth between slices. **Read this at the start of every packet; flush it at the end.**
> The plan lives in files (`../game-bakeoff/master-plan/MASTER_PLAN.md`); your window holds one slice.

## Current state
- **Slice:** S0-foundation (the contract layer) — ✅ **DONE & VERIFIED** (authored by the orchestrator, not the builder).
- **Next packet:** `packets/S0.md` — wire the loop + canvas renderer + bootstrap so one harvester is *visibly
  moving*, and the S0 liveness gate is green against the deployed bundle.

## Done so far
- Repo scaffolded: TS + Canvas2D + Vite + Vitest + zod + ESLint, single package, pnpm. `pnpm run verify` green.
- **Immutable contract layer** written, compiled, and contract-tested (see `BUILD_CONSTITUTION.md` for the list):
  coords (3-space fixed-point), ids, components (one entity shape), store, grid (single spatial index), map
  (seeded), rng (mulberry32), hash (FNV-1a), state, loop (fixed-timestep + canonical SYSTEM_ORDER + **blocking
  determinism smoke**), combat-types, data schemas (units/buildings/weapons/**graphics/audio/onboarding**),
  loader (fail-fast + cross-ref), and locked `data/weapons.json` (matrix + values).
- **Both guardrails proven red-on-violation:** sim-purity (`Date`/`Math.random` in `src/sim`), and
  no-second-spatial-index (a system importing `makeGridManager`).

## Last verify (the S0 gate)
```
pnpm run verify  → typecheck ✓  lint ✓  test ✓   (7 files, 32 tests passing)
```

## Next steps (queued)
- **S0** (`packets/S0.md`): src/view renderer + rAF loop driving the sim + src/main.ts bootstrap + a minimal
  movement system + the S0 liveness gate. Gate: harvester screen position at t=1s ≠ t=3s; non-bg pixels > 5%.
- **S1** (`packets/S1.md`): harvester FSM economy + credits HUD + overflow readout.

## Open questions / blocked
- (none)

---
### Ledger protocol (do not delete)
At the **start** of a packet: read this whole file. At the **end** of a slice: update *Current state*, move the
finished item to *Done so far*, paste the real *Last verify* output, and record any *Open questions*. The
mechanical halt between slices is the moment this file is guaranteed written to disk.
