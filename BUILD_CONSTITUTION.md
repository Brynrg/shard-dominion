# Shard Dominion — Build Constitution

You are building *Shard Dominion* (an IP-clean, late-90s Westwood-style web RTS) **one vertical slice at a
time**, against a foundation that is already written, compiled, and tested. Read this every packet. It is short
on purpose.

## The stack (fixed)
TypeScript · Canvas2D · Vite · Vitest · zod · ESLint · single package · pnpm.
Commands: `pnpm run typecheck` · `pnpm run lint` · `pnpm run test` · `pnpm run verify` (all three) · `pnpm run dev` · `pnpm run build`.

## The immutable contract layer — DO NOT MODIFY
These files are the rails. They are pinned, compiled, and covered by contract tests. You **import** them; you
**never edit** them. If you think one is wrong, STOP and say so in `PROGRESS.md` — do not change it.
```
src/sim/coords.ts        three coordinate spaces (WORLD/TILE/SCREEN); all conversion goes through here
src/sim/ids.ts           branded EntityId / Tick
src/sim/components.ts    the ONE entity shape: entity.components.<key>
src/sim/store.ts         EntityStore — create(components)→id; ascending-id iteration
src/sim/grid.ts          the ONE spatial index (terrain + occupancy)
src/sim/map.ts           generateMap(seed) — the one, seeded map path
src/sim/rng.ts           the ONLY randomness in the sim (seeded mulberry32)
src/sim/hash.ts          FNV-1a state hash (determinism)
src/sim/state.ts         SimState + makeSimState + stateHash
src/sim/loop.ts          fixed-timestep accumulator + SYSTEM_ORDER + runTick
src/sim/combat-types.ts  WEAPON_TYPES / ARMOR_CLASSES
src/loaders/schemas.ts   zod schemas (units/buildings/weapons/graphics/audio/onboarding)
src/loaders/loader.ts    the single data ingestion point (fail-fast + cross-ref)
data/weapons.json        the locked damage matrix + weapon values
```

## Two guardrails — a violation is a RED BUILD, not a warning
1. **Sim purity** (`src/sim/**`): no DOM, no `Date`/wall-clock, no `Math.random`, no timers. Randomness comes
   from `state.rng`; time is `state.tick`. The renderer + rAF loop live in `src/view`.
2. **No second spatial index / no core reconstruction** (`src/sim/systems/**`): a system reads `state.grid` /
   `state.store`. It may NOT import `makeGridManager`, `makeTerrainGrid`, `generateMap`, `makeEntityStore`, or
   `makeSimState`. There is exactly one grid and one store per sim, and `makeSimState` owns them.

## How you work — every packet
1. **Read `PROGRESS.md` first.** It is the source of truth between slices (your context window is not).
2. **Do only the one slice in the packet.** Touch only the files in its allowlist. Use the named contract
   imports it gives you. Do not invent scope; do not "improve" adjacent systems.
3. **Make the smallest correct change.** Reuse existing patterns. Surgical diffs.
4. **Verify before you claim done:** `pnpm run verify` must be green, and (from the slice that adds a renderer
   on) the slice's **liveness gate** must pass against the *deployed* bundle (`vite build && vite preview`) with
   a saved screenshot. Vitest alone is not "alive". Paste the real command output — never assert success.
5. **One slice → one (or few) conventional commit(s).** Then **update `PROGRESS.md`** (end-of-slice flush:
   what's done, what's next, last verify output, any blocked question).
6. **Then STOP.** A slice boundary is a mechanical halt: do not start the next slice. The operator reviews and
   hands you the next packet. (CI enforces this — the next packet is gated on an approval token.)

## Anti-patterns (these have sunk prior builds)
- A blank screen with green tests → the liveness gate exists *because* of this. Render every frame.
- Designing a "better" foundation → it's already designed and pinned. Wire against it.
- Per-frame object churn / tile-teleport movement → render reads state; interpolate `prev→current`.
- A second grid, a second loop, a magic-literal balance number in the sim → all three are red builds or contract-test failures.
