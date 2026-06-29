# `src/sim/systems/` — the slices live here

Each gameplay system (movement, harvest, construction, production, power, combat,
projectile, fog, agitation, planet, ai) is a `SimSystem` (`loop.ts`) added in its
slice. Systems **receive `SimState`** and read `state.store` / `state.grid` /
`state.rng`. They run in the canonical `SYSTEM_ORDER`.

**Hard rules (lint-enforced — a violation is a red build):**
- A system may NOT import `makeGridManager`, `makeTerrainGrid`, `generateMap`,
  `makeEntityStore`, or `makeSimState` (no-second-spatial-index / no core
  reconstruction). Use what `SimState` hands you.
- A system may NOT use `Math.random`, `Date`, wall-clock, DOM, or timers
  (sim-purity guardrail). Randomness comes from `state.rng`; time is `state.tick`.
