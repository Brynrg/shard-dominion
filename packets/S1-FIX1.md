# Packet S1-FIX1 — make the economy CORRECT (logic fixes on the existing S1 build)

> The S1 files exist and compile-fixes are partly done. This packet fixes the **game logic**, which is wrong.
> Read `PROGRESS.md`, `BUILD_CONSTITUTION.md`, `packets/S1.md`, then this. Edit only the S1 allowlist files
> (`src/sim/systems/harvest.ts`, `src/view/hud.ts`, `src/main.ts`, `tests/unit/economy.test.ts`,
> `tests/liveness/s1.spec.ts`, `data/economyConstants.json`). Do NOT touch the immutable contract layer
> (`src/sim/coords|ids|store|grid|map|loop|rng|hash|combat-types.ts`, `src/loaders/schemas.ts`,
> `src/loaders/loader.ts`, `data/weapons.json`). The additive fields already added to `components.ts`
> (EconomyComponent, HarvestComponent) and `state.ts` (shardDensity) are ACCEPTED — keep them, don't add more.

## Bug 1 — the FSM never advances (two missing transitions)
- `runSeek`: after it sets `movement.target` + `harvest.targetTile`, it must **transition `harvest.state = 'HARVEST'`**.
  (Right now it only leaves a comment, so the harvester seeks forever and never harvests.)
- `runReturn`: after it sets `movement.target` + `harvest.targetRefinery`, it must **transition `harvest.state = 'DOCK'`**.
  (Same bug — it never docks, so credits never rise.)
- Keep the existing arrival checks in `runHarvest` (at the tile? harvest : keep moving) and `runDock` (at the
  refinery? deposit : keep moving). The full cycle must run: SEEK→HARVEST→RETURN→DOCK→SEEK.

## Bug 2 — the economy model is WRONG (this is the important one)
The plan (§5.1 / `packets/S1.md`) economy is a **single credits pool**, fed by docking. Implement EXACTLY:
- `credits` (on the refinery's `economy` component) is the one resource pool, bounded `0 .. maxStorage` (maxStorage
  = `economyConstants.refineryStorageCapacity` = 2000).
- **DOCK converts cargo → credits at `dockRate` per second** (`dockRate`=100 → `100 / SIM_TICK_RATE` = **5 per tick**),
  **1 cargo = 1 credit** (identity). Drip it over ticks while docked; do NOT dump all cargo in one tick.
- **Overflow rule:** when adding credits would exceed `maxStorage`, the excess is **LOST** (cargo is consumed but
  credits stop at 2000). Track the lost amount and expose it for the HUD readout.
- DELETE the current wrong behavior: the separate `refineryStorage` accumulation AND the flat `+5 credits/tick`.
  (If you keep the `refineryStorage` field at all, mirror it to `credits` purely so the HUD "Storage" bar can read
  it — but the single source of truth is `credits` capped at `maxStorage`.)
- Harvesting drains tile density at `harvestRate` **per second** (`harvestRate`/`SIM_TICK_RATE` per tick), filling
  cargo (cap `cargoCapacity`=700), 1 density = 1 cargo.

## Bug 3 — the demo must visibly show a deposit inside the liveness window
At plan rates a full 700-cargo cycle is ~40 s, but the gate runs only seconds. In `src/main.ts` bootstrap, seed it
so a COMPLETE cycle is visible fast: put one **low-density shard tile (density ~60)** adjacent to the harvester,
with the refinery ~2–3 tiles away, so the harvester harvests the tile dry (~2–3 s), returns, docks, and **credits
visibly climb** within ~8 s. (Seed the rest of the shard field as before.)

## Bug 4 — strengthen the tests so they actually prove the economy (they currently don't)
- `tests/unit/economy.test.ts`: `makeHarvestSystem()` is called with **no argument** but it needs the loaded
  `EconomyConstants` — load `data/economyConstants.json` via `loadEconomyConstants` and pass it. Then make the
  assertions about **magnitude**, not just "> previous": a harvester that docks 700 cargo into an empty refinery
  must end with **credits ≈ start + 700** (1:1), and an overflow case (start credits 1900, deposit 700) must end at
  exactly **2000 with 600 lost**. Keep the cargo-rises / density-falls / no-dock-deadlock tests.
- `tests/liveness/s1.spec.ts`: add a `window.__debugEconomy()` hook (in `main.ts`) returning `{credits}`, and
  **assert credits at t≈end > credits at t≈start** (a real deposit happened on screen). Keep the S0 motion asserts.

## Type/lint cleanup
- `harvest.ts` uses `any` ~20 times — replace with the real contract types (`PositionComponent`,
  `MovementComponent`, `HarvestComponent`, `EntityId`, etc.). The imports are already fixed (EntityId imported,
  loader path corrected). No `any`.

## Acceptance (paste real output, then call kanban_complete)
- `pnpm run verify` green (typecheck + lint + the strengthened `economy.test.ts`).
- `pnpm run test:live` green — credits visibly rise on a deposit + S0 motion still passes; screenshots saved.
- One conventional commit; update `PROGRESS.md`; **call `kanban_complete`** (do not exit without it).
