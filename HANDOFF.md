# Shard Dominion — Session Handoff

> Paste into a fresh Claude Code session, or read cold. Orientation + current state + how to work.
> Deep per-slice history lives in `PROGRESS.md`; read it too. (Old bake-off-era handoff → `HANDOFF.bakeoff-era.md`.)

## What this is
**Shard Dominion** — an IP-clean, late-1990s Westwood-style (C&C / Red Alert / Dune 2000) web RTS.
- **Repo:** `~/Code/games/shard-dominion` (TypeScript + Canvas2D + Vite + Vitest + zod + ESLint, single pnpm pkg).
- **Live:** https://speedrungames.net/games/shard-dominion/ — currently **v0.42.0**.
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

## Art pipeline (Grok → engine)
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
