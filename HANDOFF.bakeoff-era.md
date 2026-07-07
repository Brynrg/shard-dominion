# Shard Dominion — Session Handoff Prompt

> Paste this into a fresh Claude Code session (or read it cold). It is the orientation + current state +
> next action. Deep detail lives in the on-disk files it points to — read those, don't expect this to restate them.

## Your role
You are the **orchestrator** of a project to build *Shard Dominion* — an IP-clean, late-1990s Westwood-style
(Command & Conquer / Dune 2000) real-time-strategy game that ships to the web. You do NOT hand-write the game;
a **local coding model** (profile `alex-builder`, a Hermes kanban worker) builds it **one vertical slice at a
time** against a pinned contract layer. You orchestrate, verify, and finish-line. The operator (Jonathan) gives
explicit directives and reviews each slice.

## Read these first (source of truth, in order)
1. `~/projects/shard-dominion/PROGRESS.md` — the live ledger. **Current state + the active blocker live here.**
2. `~/projects/shard-dominion/BUILD_CONSTITUTION.md` — the build rules + the immutable contract-layer list + guardrails.
3. `~/projects/shard-dominion/packets/S0.md` and `S1.md` — the next work packets for the builder.
4. `~/projects/game-bakeoff/master-plan/MASTER_PLAN.md` — the **v4** design (the whole game spec; §14/§16/§17 are the locked decisions).
5. `~/projects/game-bakeoff/axis2-progress.md` — the bake-off experiment record (history + the Axis-2 verdict + caveats).
6. Memory files (recalled automatically): `game-bakeoff`, `builder-laptop-sleep-policy`, `hermes-dispatch-policy`.

## How we got here (compressed arc)
1. **Bake-off experiment — CALLED at 2/4.** Four frontier LLMs each wrote a plan for the same RTS; one local
   coder built each, deploying to speedrungames.net. Two axes: best PLAN (Axis-1), best BUILDER (Axis-2). The
   builder was swapped GLM-4.7-Flash → **Qwen3-Coder-Next** for the Axis-2 re-run. **Games 2 (ChatGPT,
   `shard-dominion-chat`) and 4 (Opus/Fable, `shard-dominion-fable`) shipped LIVE; games 3 (Gemini) and 1 (Grok)
   were not completed** (harness fragility + laptop sleep). Verdict was "Qwen ≫ GLM" — **now caveated** (see the
   blocker: the local Qwen may not have done the tool-using turns; the glm-4.5-air fallback may have).
   Repos: `~/projects/game-bakeoff/shard-dominion{,-chat,-fable,-v2}` (the bake-off builds; `glm-chance3-*`
   branches + `axis2-qwen` tags preserve history). Live: speedrungames.net/games/shard-dominion-chat/ + -fable/.
2. **Master plan synthesis (v1→v4).** All four plans were distilled (the `EXTRACT_*.md` files) and synthesized
   into one coherent plan, then hardened through three operator-run review passes (Pass-1 architecture/six
   forks; Pass-2 balance/systems-integration; Pass-3 readability/onboarding/art/audio/campaign). v4 is canonical;
   v1–v3 archived in `master-plan/`. The package is capped at ≤10 files for the operator's review panel.
3. **Contract layer — BUILT + VERIFIED (this is real, committed code).** `~/projects/shard-dominion/` is a fresh
   git repo (commit `6f95f9c`). Stack: **TypeScript + Canvas2D + Vite + Vitest + zod + ESLint, single package,
   pnpm** — chosen specifically to keep a context-limited local model on rails. The immutable contract layer was
   authored by the orchestrator (cloud) so the builder "physically cannot reinterpret" the foundation:
   `src/sim/{coords,ids,components,store,grid,map,rng,hash,state,loop,combat-types}.ts`, `src/loaders/{schemas,
   loader}.ts`, `data/weapons.json` (locked 7×5 damage matrix + values). Two guardrails are ESLint red-builds
   (proven on a deliberate violation): **sim-purity** (no DOM/Date/Math.random in `src/sim`) and
   **no-second-spatial-index** (systems can't construct grid/store/map/state). `pnpm run verify`
   (typecheck + lint + test) is **green: 32 tests**. The builder's S0 is `packets/S0.md`: wire the renderer +
   loop + bootstrap so one harvester visibly moves and the liveness gate is green — NOT designing the foundation.

## ✅ BLOCKER RESOLVED + S0 SHIPPED (2026-06-30) — see PROGRESS.md for live state
**The tool-call blocker is fixed.** Root cause: the model's `tokenizer_config.json` had
`"tool_parser_type": "json_tools"` but Qwen3-Coder-Next emits XML tool calls — wrong parser → silent drop →
empty `tool_calls`. Fix: set it to `"qwen3_coder"` + kickstart the coder (backup `tokenizer_config.json.bak.json_tools`
in the model dir; memory `project_mlx_tool_parser_type`). NOT a version/timeout issue. Verified by probe + e2e.
**S0 "blank→alive" is DONE & verified** (commit `aef0163`): renderer + loop + bootstrap + movement; `pnpm run
verify` green + `pnpm run test:live` PASS with before/after screenshots. **Next: S1** (`packets/S1.md`,
economy) — but only after operator review of S0. NOTE: the worker builds correctly but tends to exit without
calling `kanban_complete` (protocol violation) — that's expected; the orchestrator does the finish-line
(commit + mechanical CI-green fixes). The original blocker text is preserved below for history.

## (HISTORICAL) THE ACTIVE BLOCKER
**The local Qwen coder, served by mlx_lm 0.31.3 on `:8088`, does not emit parseable tool calls.** A direct
function-tool request returns `finish_reason: tool_calls` but an **empty `tool_calls` array + empty content**
(reproduced at reasoning_effort low AND medium, thinking on AND off). So the agentic worker narrates
("I'll start by reading the task details…") and stops with **0 tool calls** → protocol violation → blocked.
The agentic build cannot run on the local coder until this is fixed.

What is NOT the problem (already ruled out + fixed this session):
- **Timeout: FIXED.** The bake-off "Request timed out at ~3min" was *situational* (coder swapping under 4-game
  memory exhaustion + laptop lid closing mid-request). There is no fixed ~60s code timeout. Hardened anyway:
  `request_timeout_seconds: 1200` / `stale_timeout_seconds: 600` (self-contained, per-model) in the alex-builder
  profile + global config. Verified 0 timeout recurrence; coder healthy at **36 tok/s**, streamed a 1500-token
  completion in 41.5s with no break.
- **Reasoning effort: not it.** Tried medium — identical narrate-then-stop. Reverted to `low` (documented
  builder default). Kept `max_tokens: 12000` (the `1500` was an obsolete bake-off mitigation).

### Recommended next actions, in order
1. **Upgrade mlx_lm and re-test tool-calling** (cheapest potential fix). `uv pip install -U mlx_lm --python
   ~/llm-mlx/.venv/bin/python`, restart the coder (`launchctl kickstart -k gui/$(id -u)/com.hermes.mlx-coder`),
   then re-run the tool-call probe (below). Newer mlx_lm versions added/extended tool-call parsing for Qwen
   templates. If `tool_calls` populates → the local Qwen builder is viable. **Verify it didn't break the
   serving** (the model path, the flags) and that other Hermes models still load.
2. **Confirm glm-4.5-air (DGX fallback) tool-calls** — DGX (`100.108.249.113:4000`, key in
   `~/.hermes/profiles/alex-builder/config.yaml`) was DOWN during travel. When up, probe it the same way. If it
   tool-calls properly, the build can run on it, and it likely explains what built the bake-off games (→ confirm
   the Axis-2 caveat).
3. If neither: a tool-call-parser shim, or local vLLM serving of the coder (vLLM does Qwen function-calling).

### The tool-call probe (reproduce the blocker / verify a fix)
```bash
curl -s -m 40 http://127.0.0.1:8088/v1/chat/completions -H 'Content-Type: application/json' -d '{
  "messages":[{"role":"user","content":"Read the file sample.ts. You must use the read_file tool."}],
  "tools":[{"type":"function","function":{"name":"read_file","description":"Read a file","parameters":{"type":"object","properties":{"path":{"type":"string"}},"required":["path"]}}}],
  "tool_choice":"auto","max_tokens":300}' | python3 -c "import sys,json;m=json.load(sys.stdin)['choices'][0]['message'];print('tool_calls:',bool(m.get('tool_calls')),'| content:',repr((m.get('content') or '')[:120]))"
# BROKEN today: tool_calls False, content ''. FIXED when: tool_calls True (a read_file call).
```
End-to-end verify (the real worker path) once the probe passes: create a tiny kanban task on board
`game-bakeoff` assigned `alex-builder`, workspace `dir:<scratch>`, body "read sample.ts, write summary.md,
complete", and confirm it makes tool calls + writes the file + completes (archive the task after).

## Once unblocked — how the build proceeds
- Hand the builder `packets/S0.md` (it reads `PROGRESS.md` + `BUILD_CONSTITUTION.md` first). One slice → verify
  (`pnpm run verify` + the S0 Playwright liveness gate against `vite build && vite preview` with a screenshot) →
  the worker commits + flushes `PROGRESS.md` → **mechanical halt for operator review** → then S1, etc.
- Slice roadmap (MASTER_PLAN §10): S0 alive → S1 economy → S2 control → S3 base/concrete/power → S4A/B/C combat
  → S5 fog/groups → S6A–D AI + living planet = v1.0. Campaign/art/superweapons are S7+.
- **Orchestrator rules:** never hand-write game code (the builder does, via packets); you do deploy-lane +
  finish-line (commit/push the builder couldn't, mechanical CI-green fixes). Verify everything; a screenshot/
  liveness pass is proof, a green vitest is not. The operator is the judge of playability.

## Machine / infra context + gotchas
- **Coder:** launchd `com.hermes.mlx-coder` serves `:8088`, currently `Qwen3-Coder-Next-MLX-6bit` (4bit also on
  disk at `~/llm-mlx/models/`). It sleeps with the laptop — kickstart on wake. `coder-watchdog`
  (`com.bakeoff.coder-watchdog`, 10-min) recovers genuine wedges.
- **Laptop sleep kills builds** (lid close = clamshell sleep; `caffeinate` can't stop it). Builds only make
  progress lid-open + plugged. The operator travels and opens/closes the lid — expect interruptions; the
  dispatcher + high max-retries + the watchdog recover across them.
- **Config changes I made this session (all backed up):** alex-builder profile config — added a `providers`
  block (timeouts), `max_tokens 1500→12000`, `reasoning_effort` low (backup
  `config.yaml.bak.pre-timeout-harden`). Global `~/.hermes/config.yaml` — `providers.custom` timeouts + coder
  model entries (same backup suffix). Gateway plist — env `HERMES_API_TIMEOUT=900` +
  `HERMES_API_CALL_STALE_TIMEOUT=600` (backup `.bak.pre-api-timeout`). `alex-builder/SOUL.md` — relative-paths /
  no-scratch / commit-and-complete rules (from the bake-off; helps the worker behave).
- **pnpm quirk:** `node_modules` in `shard-dominion` vanished once mid-session (a relink hiccup); `pnpm install`
  (cached, ~1s) fixed it. If `tsc/eslint/vitest: command not found`, just reinstall.
- **Dispatch:** Hermes kanban board `game-bakeoff` (`dispatch_in_gateway: true`, gateway `com.hermes.gateway-local`).
  `hermes kanban --board game-bakeoff ls`. The bake-off game-3 build task is left `blocked` (intentional).

## What NOT to do
- Don't modify the immutable contract layer (`src/sim/**`, `src/loaders/**`, `data/weapons.json`) — it's pinned;
  if it's wrong, flag it, don't edit it.
- Don't pull S7+ scope forward (campaign, superweapons, real art, save/load, engineer capture — see MASTER_PLAN §15).
- Don't re-open the six design forks (MASTER_PLAN §14) or the Pass-2/3 decisions (§16/§17) — closed.
- Don't run the agentic build until the tool-call blocker is fixed — it will just narrate-and-stop.
- Don't disrupt the operator's machine infra (other Hermes models, the WebOps cockpit, SATORI, etc.).
```
