# Shard Dominion — Session Handoff

> Paste into a fresh Claude Code session, or read cold. Orientation + current state + how to work.
> Deep per-slice history lives in `PROGRESS.md`; read it too. (Old bake-off-era handoff → `HANDOFF.bakeoff-era.md`.)

## What this is
**Shard Dominion** — an IP-clean, late-1990s Westwood-style (C&C / Red Alert / Dune 2000) web RTS.
- **Repo:** `~/Code/games/shard-dominion` (TypeScript + Canvas2D + Vite + Vitest + zod + ESLint, single pnpm pkg).
- **Live:** https://speedrungames.net/games/shard-dominion/ — currently **v0.52.0** (deployed +
  hash-verified 2026-07-16; v0.49 balance+controls · v0.50 a11y · v0.51 beyond-WC3 depth ·
  v0.52 EVA/Sell all live).
- **SHIP-QUALITY PROGRAM (2026-07-12, `docs/SHIP_QUALITY_PLAN.md`):** operator goal = a fully-
  realized, polished game in its OWN identity (WC3 = the execution/polish bar, NOT a feature
  clone). Done so far: complete code-drawn art (v0.43); **complete 3-act, 17-mission campaign**
  (v0.44) — M7 "The Turn" (the Warden's defection) + full Act III (M15→M16→M17) branching on the
  Seal/Harness choice via a new `inheritsChoice` flag (campaign choice persists under a stable
  key; the "finale" credits-roll is now data-driven = the campaign mission with `next:null`).
  **Economy depth (v0.45):** a **TECH tab** of team-wide **Refinements** researched at a
  Processing Plant (`data/refinements.json`; `src/loaders/refinements.ts`;
  `src/sim/systems/research.ts`; state on `SimState.refinements` + in `stateHash`; a
  `research` command intent + SYSTEM_ORDER slot; effects applied point-of-use in
  damage/harvest/planetEvent). Deep Extraction / Munitions Doctrine / Composite Plating /
  Resonance Dampers (the last softens the living-planet hunt — identity-tied). **Hero
  Ascendancy (v0.46):** the Warden/Vane grow with veterancy (rank 1/2/3 @ 3/8/15 kills →
  +25% HP/rank healed-on-ascension, aura +15%→+30% & radius 4→7, r3 mends allies);
  `src/sim/systems/hero.ts` + shared `veterancyRank()`. **AI research (v0.47):** the AI
  now researches Refinements too (balance harness still 6/6). **Shardborn true faction
  (v0.48):** living-crystal regen (`src/sim/systems/regen.ts`) + Chorus kinship (the planet
  never hunts resonance-kin sides — planetEvent takes teamFactions). All 3 factions now
  mechanically distinct. **Every named goal pillar is shipped** (art · 17-mission 3-act
  branching story · research economy · ascending hero · 3 distinct factions · AI parity).
  **Balance FIXED (v0.49):** a new multi-seed win-rate harness (`BALANCE_WINRATE=1 npx vitest
  run tests/balance/winrate.test.ts`, 30 games × 5 seeds) showed Shardborn at 15% and 0/10 as
  defender; the empirical finding is that ANY speed deficit is fatal in AI-vs-AI (fights happen
  on the faster side's terms), so Shardborn identity moved to toughness ×1.35 + regen 8/s +
  kinship at par cost/speed → win rates now concord 45 / emberhand 55 / shardborn 50, and the
  sweep is the full 3×3 matrix (9/9, P-seat symmetric). **Controls (v0.49):** groups 1–9
  (seat-scoped — fixed an MP selection-trample bug), double-tap recall centres the camera,
  Q = army, I = idle-harvester cycle, O = hero; documented in HUD legend + briefing.
  **Accessibility (v0.50):** aria-live announcer + colorblind team-shape markers (pause-menu
  toggle, persisted) — `tests/liveness/a11y.spec.ts`.
  **Beyond-WC3 depth (v0.51):** shift-queued waypoint orders (dashed route rendered) +
  military-first box select; STATUS.md now carries an evidence-backed "exceeds WC3"
  scorecard (unlimited selection vs the 12-cap, global train keys, universal double-tap
  centring, a11y, measured 45-55% faction balance, any-tick deterministic saves).
  **Westwood feedback layer (v0.52, research-driven):** a deep-research pass over the official
  RA/Dune 2000 manuals + EA's GPL'd RA source produced the EVA announcer (text flash +
  speechSynthesis voice, pause-menu toggle), refused-build-click feedback (buzz + reason), and
  the sidebar SELL flow (50% refund; refund granted AFTER removal — the ConYard is a bank).
  REMAINING (honest): a real 2-HUMAN MP field test (operator-side — the relay + lockstep are
  machine-verified but never carried a live 2-player match).
- **Your role now:** you (Claude) **build it directly** and verify. (Earlier plan was to delegate slices to a
  local Qwen builder; in practice Claude builds and only occasionally hands a tightly-scaffolded sub-task to
  `hermes-ask code` — e.g. the S6B AI waves. Default to building it yourself + verifying.)

## Current state — see STATUS.md (the product truth table)
Start with a Construction Yard + Refinery + 1 Harvester + 2 troops + 700cr → harvester auto-mines Shard →
**build a Barracks (B)** → **train Infantry/Rocket/Harvester (T/R/H)** → **right-click** to move/attack/mine →
destroy the enemy base (marked on radar + off-screen arrow) to win. The AI reinforces + attacks in waves.
Shipped: real Grok **painted sprites** (units+buildings) + **seamless terrain tiles**; **clickable C&C build
sidebar** with live progress fill + `×N` queue + context cursors; **edge-scroll + wheel-zoom + radar click-jump**
camera (clamped to map); mission briefing (goal-first + how-to). **STORY MODE (v0.25.0):** a **title menu**
(Campaign / Skirmish) → **Mission 1 "First Light"** (briefing → objective banner → destroy the watch-post →
Victory/Defeat debrief → Next/Retry/Menu); the whole game is now **mission-driven** (`data/missions/*.json` +
`seedFromMission`; skirmish = the default mission). **FG-1 "game feel" SHIPPED (v0.26–v0.27):**
**sound** (procedural WebAudio SFX + generative music), **pause/game-speed** (P/Esc menu, 0.5–2×), **A***
**pathfinding** (impassable mesas; deterministic; `src/sim/pathfind.ts`) + **unit separation**, **attack-move
(A) / stop (S) / rally points / dbl-click select-type**, **death decals**, and a **600-tick full-stack
determinism harness** (`tests/unit/determinism.test.ts` — the lockstep-MP substrate; keep it green).
**187 unit tests + 22 Playwright gates green.** **FG-7 MULTIPLAYER SHIPPED (v0.33): 1v1 lockstep — run `node server/relay.mjs` (LAN/tailnet), both players open `?mp=1&room=<name>&relay=ws://<host>:8787`. THE FULL-GAME PLAN (FG-1→FG-7) IS COMPLETE.** **FG-6 SHIPPED (v0.32):** 3 factions (data mods + palettes), Badlands map, difficulty select, save/continue via the command log. **FG-5 SHIPPED (v0.31):** Riftmaw creeps + capturable derricks + veterancy chevrons + the Warden hero (E). **FG-4 campaign SHIPPED (v0.30):** trigger system + mission select + rewards + missions 2-6 (full 6-mission arc, m6 ends on the Riftmaw hook). **FG-2 map economy SHIPPED (v0.28):** buildable Refinery (F) + Defense Turret (G) + repair (🔧) + per-team power w/ shortage penalties + flank/centre fields + distance-discounted harvesting + AI Expand.

## How to work
- **Architecture:** `src/sim/**` is the PURE deterministic core (no DOM/Date/Math.random — ESLint red-builds it;
  `coords.ts`/`loop.ts`/`components.ts`/`store.ts`/etc. are the immutable contract — ADD components, don't rewrite
  the shape). `src/view/**` = `renderer.ts` (draw + camera + rAF loop), `hud.ts` (sidebar), `input.ts` (mouse/keys
  → command intents), `spritebank.ts` (real-asset + terrain loader, chroma-key, zoom scaling), `onboarding.ts`
  (briefing + objectives). `src/sim/systems/**` = command, movement, harvest, production, construction, power,
  combatTargeting, damage, ai, victory, fog. `data/*.json` + `src/loaders/**` = tunables.
- **Verify (non-negotiable):** `pnpm run verify` (typecheck + lint + 187 unit tests) AND `pnpm run test:live`
  (19 Playwright gates — the real-browser proof of interaction; add a gate for any new mechanic).
- **Visual check:** claude-in-chrome on `localhost:5199` (preview_start "shard-dominion") or the preview MCP.
  **GOTCHA: a backgrounded Chrome tab throttles rAF → the sim FREEZES** (credits static, clicks don't process).
  Dismiss the briefing by dispatching a real `mousedown/up` on the canvas; rely on Playwright gates for interaction
  truth. Debug hooks: `window.__debug{Match,Economy,BuildingCount,Camera,Briefing,Sprites,ConYardScreenPos,…}`.

## Deploy pipeline (operator-gated; confirm before shipping)
1. `pnpm run build` → `dist/`.
2. Copy into `~/Code/games/speedrungames/apps/web/public/games/shard-dominion/`: replace `assets/index-*.js`,
   `index.html`, and the whole `art/` dir.
3. **Write `manifest.json`** — MUST include `buildHash` (sha256 of the js bundle), `buildTimestamp`, `lastUpdated`,
   plus slug/title/description/repo/playUrl/category/status/framework/supportsMobile/version/sourceCommit/emoji, and
   bump `version`. **Never hand-write a partial manifest — a missing field fails the prebuild registry validator and
   reds the ENTIRE Netlify build** (burned on this for 15h once).
4. `git commit` + `git push origin main` on `Brynrg/speedrungames`.
5. **Verify by Netlify deploy-STATE, not URL polling:**
   `netlify api listSiteDeploys --data '{"site_id":"71683967-2b9c-4227-8fec-0ae0d41ef0d9","per_page":1}'` → wait for
   `state: ready` on your `commit_ref` (parse with `json.loads(...,strict=False)`), then curl the bundle for 200.
   See memory [[project_speedrungames_deploy]].

## Art pipeline — NOW CODE-DRAWN (2026-07-11)
**All game art is generated as SVG/canvas → transparent-PNG by `scripts/art-gen/`
(`kit.mjs` helpers · `shapes.mjs` every unit/building shape · `render.mjs` sprites ·
`terrain.mjs` seamless tiles · `strips.mjs` walk/drive/fire anim · `presentation.mjs`
backdrops+portraits · `contact.mjs` review sheets), NOT by Gemini/Grok — both failed the
style (baked shadows, base pads, refused recolors).** Transparent alpha means NO magenta
bg, NO chroma-key halo, exact palette, and enemy/faction recolors are a one-token palette
swap. To change a sprite: edit `shapes.mjs` → `node scripts/art-gen/render.mjs <out>` (or
`terrain`/`strips`/`presentation`) → `node scripts/import-art.mjs <out>` → `pnpm run verify`
+ `pnpm run test:live`. The 89-asset set (all units/buildings/factions + terrain + anim
strips + title/act/credits backdrops + 6 stylized portraits) shipped at v0.43.0.

### Legacy diffusion path (retired — reference only)
- Spec + paste-ready Grok prompts: `docs/ART_ASSETS_SPEC.md` (§0.5 = image-gen path: ONE top-down sprite per unit
  on a **pure #FF00FF magenta** bg, PNG, facing up; terrain = seamless opaque tiles, no magenta).
- Assets: `public/art/{units,buildings,terrain}/` + `public/art/manifest.json`.
- Import: `node scripts/import-art.mjs <folder>` (copies + sidecars + manifest merge). Loader chroma-keys magenta
  by COLOUR FAMILY (R+B high, G low — handles Grok's vignetted magenta), rotates single top-down unit sprites to
  heading, blits seamless terrain (variant by hash, Shard art by density).
- **GOTCHA: macOS TCC blocks the terminal from reading `~/Downloads` AND `~/Desktop`** — operator must MOVE the
  Grok zip/folder into `~/Code/...`. See memory [[env_tcc_downloads_blocked]]. Also **`grep` is broken in this
  sandbox shell** (EPERM/bun spam) — use `curl -w "%{http_code}"`, `python3`, `head` instead.

## Open threads (pick up here)
**✅ ART COMPLETE (2026-07-11): the entire art set is now CODE-DRAWN via `scripts/art-gen/`
and shipped at v0.43.0 — all units/buildings/faction recolors, terrain, walk/drive/fire
strips, and presentation backdrops/portraits. Gemini AND Grok were both abandoned (both
failed the style). See "Art pipeline — NOW CODE-DRAWN" above. Everything below in this
block is OBSOLETE history:**

~~⭐ NEXT SESSION'S FIRST TASK (art, 2026-07-10): the operator is generating art in the GEMINI APP (NOT API —
the only Gemini key on the machine has zero image quota / no billing; do not retry it). The paste-ready package
is `docs/GEMINI_ZIP_PROMPTS.md` — one block PER BATCH, each image labelled with its real pipeline filename
(e.g. `barracks__player__idle.png`); Gemini names + zips them and the operator drops the zip under `~/Code/`.
Your job when the zip lands: `node scripts/import-art.mjs <unzipped-dir>` → `pnpm run verify` + `pnpm run
test:live` + an in-engine screenshot. Then keep going through batches 2–7.**

**Two engine tasks the art surfaces (do the FIRST one before/at the next import):**
1. **Hue-aware chroma key (promised to operator).** Gemini keeps baking a faint GROUND SHADOW behind sprites;
   the current per-channel key in `src/view/spritebank.ts` `chromaKeyOut()` (R+B high, G low) leaves a ragged
   purple halo right at shadow brightness. Rewrite it hue-based: key out magenta-family hue (~280–330°) at
   decent saturation regardless of brightness, so it strips BOTH the bright bg and the dark shadow. **Verify
   against the already-shipped sprites** (the original Grok art + batch-1 buildings) so it doesn't eat the
   blue-grey/cyan building colours or the violet Shard crystal. Test-cover it (pure fn, node env).
2. Consider auto-despeckle on import (Gemini stamps a tiny white ✦ flourish in a corner on some images — it's
   white so the magenta key won't remove it; keep only the largest sprite blob, drop stray corner specks).

**Art gen — hard-won this session (bake into any re-roll):** batch mode makes Gemini DRIFT on the hard rules
— it reintroduces base pads / ground tiles / cast shadows, occasionally goes pixel-art or glossy-mobile-3D,
drifts off the blue-grey/cyan palette, and IGNORES the "recolor of X" enemy variants (returns a different
building, not a red repaint). The fix that works: prepend a forceful **STYLE LOCK** (painted-Westwood-NOT-
pixel-NOT-3D · nothing beneath the building, no base pad/floor tile · ZERO ground shadow · one flat magenta
touching the walls · exact faction palette player=#3d7fd6+#00e5ff / enemy=#d1503a+ember) and do enemy
variants as SAME-CHAT edits ("recolor THAT exact image"), not batch items. Backgrounds needn't be exactly
#FF00FF — any magenta-purple keys out fine; the real enemy is the shadow (→ task 1). The operator's front-on
construction yard + the power_node (blue-grey, cyan mast, splayed feet, no pad) prove Gemini nails it when
the lock bites; the first barracks/refinery batch mostly missed and is being re-rolled.

**Art pipeline is fully wired (this session, commits 9d8092c → a915870):** `scripts/import-art.mjs` routes
units (ids from data/units.json — no more misclassifying the 9 new units as buildings), buildings, terrain,
presentation art, and §0.6 walk/drive/fire strips (writes frames/fps sidecars). `spritebank.ts` keys sheets
by (assetId, team, state) with a pure `sheetCandidates()` order (faction skin > team paint > neutral, anim
strip > base) + `setFactionIds()`; renderer drives the anim off the muzzle detector + interp delta.
Presentation view slots live (title/skirmish backdrop, act cards, credits, briefing portraits by speaker
tag). Numbered fallbacks: `docs/GROK_ART_PROMPTS.md` + `scripts/rename-art-drop.py` (save-by-order → names)
if Gemini ever ignores the filename labels. **First real drop already in-engine** (commit 73ba73e): conyard,
both barracks, refinery — imported + verified. Builders for the prompt docs: `scripts/build-{gemini,grok}-doc.py`
(regenerate from `scripts/art-prompts.json`, the single source of truth). 261 unit tests + 31 gates green.

**BOTH MASTER PLANS ARE EXECUTED IN FULL (2026-07-09):** `docs/FULL_GAME_PLAN.md` FG-1→FG-7
(v0.26→v0.33) and `docs/EXPANSION_PLAN.md` XP-1→XP-7 (v0.35→v0.41, panel-locked §11). Live = **v0.41.1**:
13-mission two-act campaign with the SEAL/HARNESS choice + credits, 3 factions with mechanical identities
(Concord shields / Emberhand salvage+stealth / Shardborn antagonist), tech tiers, Cells economy, Resonance,
storms, air+AA, artillery, garrisons, stances, gates, superweapon strike, saves/replays, `?editor=1`,
1v1+2v2 lockstep MP. **223 unit tests + 31 gates green**; AI-vs-AI balance harness at
`BALANCE=1 npx vitest run tests/balance/sweep.test.ts`.

What actually remains (all operator-gated or reactive):
1. **Art drops** — every unit/building added since v0.22 runs on procedural placeholder chassis by design.
   Operator generates via `docs/ART_ASSETS_SPEC.md` (§0.5 sprites, §0.6 4-frame animation strips), drops
   into `~/Code/...`, then `node scripts/import-art.mjs` — no code changes needed. Purple-base re-gen of
   the original 6 buildings also still pending.
2. **Play-feedback tuning** — the operator plays v0.41.1; tune from `__debug*` telemetry + the balance
   harness. QA round 2 via the Claude-in-Chrome charter prompt (ask Claude to regenerate it for v0.41
   systems: Cells, stealth, air, storms, the Choice, strike, replays).
3. **MP field test** — the relay (`node server/relay.mjs`, deploy to the Mini) has never carried a real
   2-human match; `?mp=1&room=X&relay=ws://<host>:8787` (add `&mode=2v2` for four seats).
4. **Sequel hooks (deliberate, not started):** Shardborn living-bases as a playable faction mechanic;
   Act III (the Choice's fallout); Veteran Reserve UI polish; painted briefing portraits.

## Operator (Jonathan) working style
Plays each build, gives concrete feedback, wants it to feel like C&C/Red Alert. Loop: ship a fix → deploy → tell
him what changed + what to try → he plays + reports. Deploys are operator-gated but he ships each iteration.
