# PROGRESS — Shard Dominion

> **REPO MOVED (2026-07-01):** canonical path is now `~/Code/games/shard-dominion` (was `~/projects/shard-dominion`).
> The operator relocated it as part of a file-system reorganization (games live under `~/Code/games`). The in-flight
> S4A-2 worker runs just found the old `/projects` path empty and blocked — no work lost; repo intact here. The empty
> stale dir was removed.


> The on-disk source of truth between slices. **Read this at the start of every packet; flush it at the end.**
> The plan lives in files (`../game-bakeoff/master-plan/MASTER_PLAN.md`); your window holds one slice.

## Current state

**SHIPPED PLAYABLE RTS — v0.25.0 live at speedrungames.net/games/shard-dominion/.** `pnpm run verify`:
**143 unit tests** · `pnpm run test:live`: **14 Playwright gates** — all green.

- **📖 v0.25.0 "STORY MODE" — CAMPAIGN CP-1 (2026-07-08):** the panel-reviewed campaign framework
  (`docs/CAMPAIGN_DESIGN.md`) — a **title menu** (Campaign / Skirmish) → **Mission 1 "First Light"**
  (briefing with Marshal Corr + Sera Vane → live objective banner → destroy the Emberhand watch-post →
  Victory/Defeat debrief → Next/Retry/Menu). The whole game is now **mission-driven**: `bootstrap()` seeds any
  match from a mission file via `src/sim/seedMission.ts` (skirmish.json reproduces the original valley, so all
  pre-existing gates pass unchanged); a Zod **mission loader** (`src/loaders/missions.ts`) + `validate:missions`
  gate; the **objective system** (`src/sim/systems/objectives.ts`) runs in the reserved `'mission'` SYSTEM_ORDER
  slot and is authoritative for win/lose (typed objectives destroy/eliminate/survive/hold/accumulate/build/reach
  + failures defend/defeated); `src/view/menu.ts` DOM overlays + `localStorage` progress (versioned, keyed by
  mission id); `'?mission=<id>'` deep-links any mission. 12 objective unit tests + 6 mission-validation tests +
  a `campaign` liveness gate. Skirmish preserved as the default mission. 143 unit + 14 liveness green.

- **🤖 v0.24.0 "THE OPPONENT" — REAL AI ECONOMY + GOAL-DRIVEN FSM (2026-07-07):** Phase 1 of the panel-
  reviewed economy overhaul (`docs/ECONOMY_DESIGN.md`). Root cause of the operator's "AI too weak / economy
  too fast / matches too short": the economy was a static allowance and **the AI had no economy** (a fixed
  600cr, no harvester → ~6 infantry ever). Fixes: (1) the enemy now runs a **real economy** — own harvester +
  home field → harvested income funds production. (2) `ai.ts` rewritten as a **goal-driven FSM** (Stabilize /
  Recover / Raid / Assault / Pressure / Develop; Expand latent until v0.25) with **reactive composition**
  (counters the player's mix) + **army-value assault thresholds** that escalate over time — sim-pure &
  deterministic (throttled on `state.tick`, no RNG). (3) Economy tuning (data): start 700→600, dockRate
  100→80, cargo 700→600, harvest fill ~1.4s→~5s (visible/raidable), harvester 400/8s→450/12s. (4) Harvesters
  gain health+armor and **flee when hit** (E6); the AI rebuilds a lost harvester at its refinery. (5)
  `shardDensity` folded into `stateHash` (determinism). (6) Per-team economy telemetry + AI-state debug hooks
  (E10, `__debugEconomyTeams`/`__debugAiState`). Rewrote ai/ai_waves unit suites for the FSM; new
  `ai_economy` liveness gate (AI harvests→funds an army→escalates, without instawinning). 125 unit + 13
  liveness green. **Read `HANDOFF.md` for how to
work + the deploy pipeline + open threads.** Feature set (v0.7→v0.23, newest entries below): Warcraft-style
build-up opening; **real Grok painted sprites + seamless terrain tiles**; **clickable C&C build sidebar** (live
progress fill + `×N` queue + context cursors); **edge-scroll + wheel-zoom + radar click-jump** camera (clamped);
right-click move/attack/mine; buildable **harvesters** (from the Refinery, turn one); mission briefing (goal-first
+ how-to); harvest/fire FX; wave-attacking AI; win by destroying the enemy base. **Open:** purple building-base
(Grok re-gen), balance pass (AI too weak / economy too fast / matches too short) — see HANDOFF.md §Open threads.

- **🏭 HARVESTER-FROM-REFINERY LIVE (2026-07-07, v0.23.0):** operator feedback — harvesters were gated behind the
  Barracks; make them C&C-accurate. Now the **Refinery produces harvesters from turn one** (it carries a
  `production` component seeded in `main.ts`); combat units still come from the Barracks. `command.ts`'s `train`
  handler routes by unit type (`harvester` → the player's `refinery` producer, else → `barracks`). HUD greys the
  Harvester button against the Refinery (always present), not the Barracks; per-button progress/queue now read the
  correct producer via a `getProducer(faction)` helper. New `__debugHarvesterCount` hook + `harvester_refinery`
  liveness gate (click Harvester turn-one with NO Barracks → one builds) + a `train`-routing unit test. 121 unit +
  12 liveness green.

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
- **🏜️ REAL TERRAIN TILES + ZOOM SCALING LIVE (2026-07-03, v0.20.0, commit 73699c7):** 9 seamless Grok ground
  tiles (sand ×2, deep_sand, dune, rock, impassable, shard full/mid/low; all tile perfectly — edge-diff ~1-3)
  imported 512→128px (138KB). spritebank.loadTerrain()/getTerrainTile() (sand variant by hash, Shard art by
  density); drawTerrain blits the real tile + fog-dim overlay, procedural fallback per-tile. **Zoom fix:** the
  wheel-zoom I added earlier sized tiles/sprites at a FIXED 32px → gaps when zoomed in. Now tile size + all
  size-based draws (sprites, slabs, rings, health bars, ghost, accents, harvester glow) scale by camera.zoom.
  Verified live: painted terrain renders seamlessly, zoom-in holds up, sprites stay proportional. 119 unit + 10
  liveness green. **Open cosmetic:** Grok's building sprites have a purple base platform that reads oddly on sand.
- **🕹️ C&C/RED-ALERT CONTROL INTERFACE LIVE (2026-07-03, v0.19.0, commit dd15587):** feedback 'make the control
  interface act more like C&C Red Alert'. (1) The BUILD panel is now a CLICKABLE SIDEBAR: Infantry/Rocket (click to
  train), Barracks/Power (click → placement → click map). Buttons show a hotkey chip + name + cost, hover-highlight,
  and grey out when unaffordable or missing a prerequisite (train needs a Barracks). Hotkeys still work. (2) Context
  CURSORS: crosshair over enemies, pointer over own units/buttons, cell in placement. HUD.buttonAt() + input swallow
  the button click; getHover drives the highlight. New hud.spec.ts gate (click Barracks → builds). 119 unit + 10
  liveness green.
- **🔧 NO-MOBILE-BUILDINGS + ACTION FX LIVE (2026-07-03, v0.18.0, commit 4eb1763):** feedback 'buildings look
  mobile; missing harvest/fire animations'. (1) BUG fix: the right-click move/order handler grafted a movement
  component onto ANY selected entity → selecting a building + right-click drove it off. Guard: order+move handlers
  skip entities with a building component (unit-tested). (2) Action FX (Grok sprites are single-frame → procedural):
  harvesters kick up purple Shard flecks while HARVESTing; firing units get a brighter muzzle flash + a tracer
  streak to target (new beam/spark particle kinds). 119 unit + 9 liveness green.
- **🔍 ZOOM/PAN + CLEAR GOAL LIVE (2026-07-03, v0.17.0, commit 9bd5948):** feedback 'hard to tell the point/
  how to play; want zoom+pan'. (1) Camera: mouse-WHEEL zoom-to-cursor (0.55–2.6) + MIDDLE-DRAG pan (arrows still
  pan) — contract transform already applies cam.zoom so input just mutates the live camera + screenToWorld stays
  correct; minimap viewport scales with zoom. (2) Briefing rewritten goal-first: a highlighted GOAL banner
  ('destroy the enemy base') + a 5-step HOW TO PLAY list + camera hint (dropped the controls table). (3) Objective
  always visible: red marker on the radar at the enemy base + an off-screen 'ENEMY BASE' pointer arrow (hidden when
  on-screen/after win). Verified live: zoom-out + radar objective marker render. 118 unit + 9 liveness green.
- **⚔️ WARCRAFT-STYLE OPENING + COMMANDS LIVE (2026-07-03, v0.16.0, commit da4f87c):** play feedback was
  'I can move units but can't direct them (no attack/harvest/build), and it starts mid-game'. Fixes: (1)
  RIGHT-CLICK is context-sensitive (new 'order' intent) — enemy=attack, Shard=send harvester to mine, ground=move;
  (2) build-up start: you begin with a Construction Yard + Refinery (hub) + 1 Harvester + 2 troops + 700cr, NO
  pre-built army (removed the seeded barracks + MCV); (3) buildable Barracks — B places one (charges 300cr, gets a
  production component so T/R work), N builds a Power Node; place-structure now charges credits; (4) reworked 5-step
  objectives (select→command→build barracks→train→attack) + Warcraft-style briefing; HUD hints updated. New
  order_build.test.ts (5); gates s3→'build a Barracks', p0b→'build then train'. 118 unit + 9 liveness green.
- **🖼️ REAL SPRITES LIVE (2026-07-03, v0.15.0, commit 82ba44e):** 14 Grok-generated painted sprites are in the
  game — vehicle/infantry/rocket_trooper (both teams), harvester/mcv/power_node (player), refinery/barracks (both
  teams), construction_yard (neutral). Pipeline: operator moved the folder out of the TCC-locked ~/Downloads into
  the repo → `scripts/import-art.mjs` mapped them in. **Two fixes during integration:** (1) macOS TCC blocks my
  terminal from reading ~/Downloads AND ~/Desktop entirely ('Operation not permitted') — the operator must move
  files into ~/Code for me to see them; (2) Grok vignetted the 'flat' magenta bg (corners pure #ff00ff, centre
  drifts), so exact-distance chroma-key left a pink halo → rewrote `chromaKeyOut` to key by COLOUR FAMILY (magenta
  = R+B high, G low), which removes every magenta shade while sparing blue/red/cyan/yellow. Downscaled 1024→256px
  (payload 5.7MB→0.6MB). Verified live in-browser: painted refinery/MCV/conyard/infantry/barracks render clean on
  the desert, no magenta. 113 unit + 9 liveness gates green.
- **🎨 IMAGE-GEN ASSET PATH LIVE (2026-07-03, v0.14.0, commit abb3409):** adapted the loader to what AI image
  tools actually produce (one clean top-down sprite, opaque bg) instead of precise facing atlases. `chromaKeyOut()`
  removes a flat key colour (#ff00ff) → transparent at load (edge feather); `drawReal` gains `rotateFrom` mode that
  rotates a single top-down sprite to the unit heading (buildings static). `scripts/import-art.mjs` maps a dropped
  folder of `assetId__team__state.(png|jpg)` → public/art + sidecars + manifest merge. Spec §0.5 = PATH A (image
  gen: single magenta-bg PNG facing up) vs PATH B (pre-rendered atlas). Verified live: magenta test sprite keyed
  clean + rotated to the harvester heading. **Grok delivered .jpg (no alpha) — rejected; gave the operator a
  corrected Grok prompt (single sprite, magenta bg, PNG).** 113 unit + 9 liveness gates green.
- **🎨 REAL-ASSET SPRITE LOADER LIVE (2026-07-03, v0.13.0, commit 7e6a6ec):** the pipeline for commissioned/
  generated art is built + shipped. `spritebank` loads delivered sheets from `public/art/manifest.json` + JSON
  sidecars; a real sheet OVERRIDES the procedural bake for its (assetId, team), everything else stays procedural
  → assets can land one at a time. Pure `facingToRow()` maps engine heading → sheet facing row (facing0/order
  aware, unit-tested); `drawReal()` slices the grid, places on the pivot, advances anim by fps. Drop-zone at
  `public/art/` (README + manifest.example.json; NO manifest.json yet → prod stays procedural). Spec at
  `docs/ART_ASSETS_SPEC.md`. **Verified live in-browser:** an injected test sheet swapped the MCV sprite (green
  arrow correctly pointed North for the idle unit) while all other units stayed procedural — proves install →
  facing → slice → pivot AND per-asset fallback. 113 unit + 9 liveness gates green. **Next:** operator delivers
  art to spec → I add manifest.json entries → sprites swap in automatically.
- **🛰️ S7-3 SPRITES + RADAR MINIMAP LIVE (2026-07-03, v0.12.0, commit ccff729):** verified in a foreground
  Chrome tab (localhost, identical bundle) — no console errors. **S7-3 (art):** richer baked sprites — vehicle
  gains an engine deck/louvres, turret hatch, side-skirts, barrel collar; harvester gains hazard stripes + scoop
  blade + exhaust stack; MCV gains fold-out panel seams + core vents; infantry gain backpack + shoulders. Bigger
  cells (U 40→44, BLDG 60→64). **Deeper RTS: radar minimap** (bottom-left) — baked terrain layer + live fog
  shading + team unit blips + camera-viewport rect; **LEFT-CLICK the radar recentres the camera** (verified: click
  NE → camera jumped, viewport rect moved). New View.minimapRect()/minimapJump(); input swallows radar clicks so
  they don't select/move on the field. 108 unit + 9 liveness gates green. **Honest note:** the promised PNG
  sprite-sheet load path was deferred in favour of visible sprite detail; true commissioned/generated bitmap art
  is still the only path to a dramatic art jump (procedural has plateaued).
- **🎨 S7-2 BAKED SPRITES + ⚔️ S6B AI WAVES LIVE (2026-07-03, v0.11.0, commit d5f201e):**
  **S7-2 (art):** new `src/view/spritebank.ts` pre-bakes every unit into 16 FIXED-LIT directional frames at 2×
  supersampling + buildings into lit bodies, then blits (the Westwood 'sprite' technique — consistent sun
  regardless of heading + crisper edges, vs rotating a vector whose shading spins with it). Renderer draws live
  animated accents (refinery exhaust, conyard crane+beacon, power pulse) + harvester ore-glow over baked bodies;
  FX + terrain-blending retained. Verified rendering on a foreground localhost tab (identical bundle), no console
  errors. **S6B (AI):** enemy now attacks in continuous ROLLING WAVES — accumulate fresh combat units, send each
  armySize batch at the player, never re-order committed units, prune the dead so the dispatched set can't leak.
  Sustained pressure vs the old one-shot muster. **Delegation note:** ai.ts drafted by the local Qwen coder
  (`hermes-ask code`) from a scaffolded packet; orchestrator reviewed + authored `tests/unit/ai_waves.test.ts`
  (3 wave tests). 108 unit + 9 liveness gates green; deploy verified by state. **Still open (S7-3, if wanted):**
  true hand-authored/rendered bitmap sprite-sheet ART needs commissioned/generated assets — beyond procedural.
- **🎨 S7-1 ART PASS + HUD-POLISH LIVE (2026-07-03, v0.10.0, commit 3d96a65):** driven-through & verified via
  Claude-in-Chrome on the live site. (A) HUD is now hidden while the briefing is up — the COMMAND panel no longer
  bleeds past the briefing frame. (B) Procedural high-fidelity render (view-only, IP-clean, zero external assets):
  units are tracked/shaded chassis (treads, turret+barrel, infantry helmets, harvester ore-glow, contact shadows,
  dark outlines); buildings are EXTRUDED (lit roof + dark front face, shaded silos, seams/rivets) with idle animation
  (refinery exhaust, conyard crane+beacon, power blink); terrain uses neighbour-aware EDGE BLENDING + ambient shadow
  from raised rock; combat FX = muzzle flashes on fire + debris explosions on death (view particle diff of sim
  transitions). Fixed a render-crash: rgb() now parses #rgb shorthand (was NaN-ing gradient colors). 105 unit + 9
  liveness gates green. **Honest gap:** this is procedural sprite-GEOMETRY at much higher fidelity — true bitmap
  sprite-sheet art (hand-drawn/rendered isometric) is a heavier S7-2 if the operator wants to commission assets.
- **🎮 ONBOARDING + INTERACTION FIX LIVE (2026-07-03, v0.9.0, commit bfc37c1):** addresses play-test feedback
  "I can see shapes moving but cannot interact, and there's no story/path to begin."
  (1) **Interaction bug FIXED** — `input.getMousePos` now scales CSS-pixel cursor coords into the canvas's 800×600
  backing store (`canvas.width/rect.width`). Before, any embed/scale (the portal) mis-mapped every click → selection
  silently failed → "can't interact." (2) **Mission briefing** (story + goal + controls) pauses the sim until the
  player clicks "TAKE COMMAND" — the dismiss-click also grabs keyboard focus (fixes iframe key capture). (3) **Staged
  first-match objectives** (select → move → train → attack) advance by observing what the player does (view-only, no
  contract/sim change). (4) Responsive, focusable canvas. New `src/view/onboarding.ts`. All 7 gates updated to
  take-command first; new `p1.spec.ts` proves briefing-pause → start → click-selects-a-unit. **105 unit + 9 liveness
  gates green.** Deploy verified by state (ready) not URL polling.
- **🌐 P1 VISUAL-GRAMMAR BUILD LIVE (2026-07-03):** speedrungames.net/games/shard-dominion/ now serves the P1
  bundle (index-D_7piw3Y.js, deploy e5081bb ready). **Deploy postmortem:** a hand-rewritten manifest.json (after an
  rm -rf dropped the original) omitted buildHash/buildTimestamp/lastUpdated → the prebuild registry validator failed
  every deploy for ~15h (exit 2), so the site silently kept serving the older P0 build. Lesson: never hand-write a
  game manifest (validator-required provenance fields); verify deploys by Netlify deploy-STATE (error vs ready), not
  by URL polling (a never-200 URL is indistinguishable from 'still building').
- **🌐 (2026-07-02): the PLAYABLE build was live at speedrungames.net/games/shard-dominion/** (v0.7.0,
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
