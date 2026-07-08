# Shard Dominion — Session Handoff

> Paste into a fresh Claude Code session, or read cold. Orientation + current state + how to work.
> Deep per-slice history lives in `PROGRESS.md`; read it too. (Old bake-off-era handoff → `HANDOFF.bakeoff-era.md`.)

## What this is
**Shard Dominion** — an IP-clean, late-1990s Westwood-style (C&C / Red Alert / Dune 2000) web RTS.
- **Repo:** `~/Code/games/shard-dominion` (TypeScript + Canvas2D + Vite + Vitest + zod + ESLint, single pnpm pkg).
- **Live:** https://speedrungames.net/games/shard-dominion/ — currently **v0.24.0**.
- **Your role now:** you (Claude) **build it directly** and verify. (Earlier plan was to delegate slices to a
  local Qwen builder; in practice Claude builds and only occasionally hands a tightly-scaffolded sub-task to
  `hermes-ask code` — e.g. the S6B AI waves. Default to building it yourself + verifying.)

## Current state (v0.24.0) — a genuinely playable RTS
Start with a Construction Yard + Refinery + 1 Harvester + 2 troops + 700cr → harvester auto-mines Shard →
**build a Barracks (B)** → **train Infantry/Rocket/Harvester (T/R/H)** → **right-click** to move/attack/mine →
destroy the enemy base (marked on radar + off-screen arrow) to win. The AI reinforces + attacks in waves.
Shipped: real Grok **painted sprites** (units+buildings) + **seamless terrain tiles**; **clickable C&C build
sidebar** with live progress fill + `×N` queue + context cursors; **edge-scroll + wheel-zoom + radar click-jump**
camera (clamped to map); mission briefing (goal-first + how-to). **125 unit tests + 13 Playwright gates green.**

## How to work
- **Architecture:** `src/sim/**` is the PURE deterministic core (no DOM/Date/Math.random — ESLint red-builds it;
  `coords.ts`/`loop.ts`/`components.ts`/`store.ts`/etc. are the immutable contract — ADD components, don't rewrite
  the shape). `src/view/**` = `renderer.ts` (draw + camera + rAF loop), `hud.ts` (sidebar), `input.ts` (mouse/keys
  → command intents), `spritebank.ts` (real-asset + terrain loader, chroma-key, zoom scaling), `onboarding.ts`
  (briefing + objectives). `src/sim/systems/**` = command, movement, harvest, production, construction, power,
  combatTargeting, damage, ai, victory, fog. `data/*.json` + `src/loaders/**` = tunables.
- **Verify (non-negotiable):** `pnpm run verify` (typecheck + lint + 125 unit tests) AND `pnpm run test:live`
  (13 Playwright gates — the real-browser proof of interaction; add a gate for any new mechanic).
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
1. **Purple building base** — Grok's building sprites bake a purple base platform that reads oddly on tan sand.
   Fix: re-gen the 6 buildings with Grok ("no coloured base — sits flat on the ground, transparent to its
   footprint"), re-import. (Operator generating the re-gen art; drop into `~/Code/...`, then `import-art.mjs`.)
2. **Harvester source — ✅ DONE (v0.23.0):** harvesters now build at the **Refinery** (available turn one,
   C&C-accurate); combat units still come from the Barracks. Routing is by unit type in `command.ts`'s `train`
   handler; the starting Refinery carries a `production` component (`main.ts`); HUD greys the Harvester button
   against the Refinery, not the Barracks. Gate: `tests/liveness/harvester_refinery.spec.ts`.
3. **Economy/pacing overhaul (phased; RFC = `docs/ECONOMY_DESIGN.md`, panel-reviewed + decisions locked).**
   Root cause of "AI too weak / economy too fast / matches too short": the economy was a static allowance and
   the AI had NO economy. Plan: v0.24 "The Opponent" ✅ → v0.25 "The Map" → v0.26 "Mid-Game" → v0.27 "Combined
   Arms". **v0.24.0 SHIPPED:** real AI economy (enemy harvester+field+funded income) + goal-driven FSM
   (Stabilize/Recover/Raid/Assault/Pressure/Develop + reactive composition; Expand latent until v0.25) +
   economy tuning (start 600, dockRate 80, cargo 600, ~5s visible harvest, harvester 450/12s) + harvester
   flee/health (E6) + per-team telemetry (E10) + shardDensity in stateHash. Gate: `ai_economy.spec.ts`.
   **Next (v0.25):** split fields (2 flank + centre) + buildable de-bundled Refinery + dock saturation +
   AI Expand/map-control. Tune v0.24 via the new telemetry (`__debugEconomyTeams`/`__debugAiState`).
4. **Optional depth:** construction_yard player/enemy team variants (currently neutral), unit animation frames,
   more building types (war factory / defense turret).

## Operator (Jonathan) working style
Plays each build, gives concrete feedback, wants it to feel like C&C/Red Alert. Loop: ship a fix → deploy → tell
him what changed + what to try → he plays + reports. Deploys are operator-gated but he ships each iteration.
