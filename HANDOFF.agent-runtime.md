# Handoff — agent runtime vs. the WebOps cockpit

> Paste into a fresh Claude Code session **running locally, with `webops-control-center` on disk**.
> This brief is written to be read cold. It carries the analysis that could NOT be verified from the
> cloud session (which is scoped to `brynrg/shard-dominion` and cannot attach `brynr-builds/*`).

## Your job

Produce a concrete diff between (a) the proposed KV-aware agent runtime sketched below and (b) what
the WebOps cockpit **already implements**. The cloud session could only see the Hermes stack as it is
*described inside this repo*. You can see the real thing. Correct it.

Deliverable: a short doc — what already exists, what's genuinely missing, and the smallest change to
the dispatcher that removes the biggest failure mode. Do not build the runtime. Do not touch operator
machine infra (other Hermes models, SATORI, the cockpit's running services).

## The proposal being evaluated

A runtime that schedules agent contexts against **resident GPU memory**, not against worker slots:

- **Context Manager** — token/KV accounting, rollover, compaction, retrieval
- **Agent Scheduler** — spawn/suspend/kill, worker priority, concurrency limits, foreground priority
- **Context Broker** — admission control over one loaded model (vLLM/SGLang as the execution kernel)

The scheduler knows bytes, not just tokens: *weights 62 GiB, parent KV 7.4, worker A KV 12.1, safe
remaining 14.6, worker B needs 18 → queue B; on A's completion persist evidence, return ~1.4K tokens,
destroy the session, reclaim 12.1, start B.* Target profile: one model resident for days, thousands of
logical agents around it. Prior art worth stealing from: Letta (context repositories), LangGraph
(checkpointers, threads, subgraphs), AutoGen/Magentic-One (orchestrator delegation), Agent libOS
(agents as schedulable processes with lifecycle + capabilities + audit).

## The finding to verify or refute

**This architecture already exists in `shard-dominion` as a hand-operated version.** Each primitive
has a Markdown analogue that has been run for ~20 slices:

| Proposed primitive | Hand-operated equivalent in this repo |
|---|---|
| Context rollover (parent gen N→N+1) | `HANDOFF.md:3` — "Paste into a fresh Claude Code session" |
| Compaction | `AGENTS.md:3-5` — distilled from every failure that cost a rework round |
| Persistent external state | `PROGRESS.md`, `STATUS.md`, `PHASE_STATUS.md` |
| Disposable worker context + capability bound | `packets/S*.md` — task envelope + **file allowlist** |
| ~1.5K result contract | "one commit; update `PROGRESS.md`; CALL `kanban_complete`" |
| Agent scheduler | Hermes kanban board `game-bakeoff` + `com.hermes.gateway-local` |
| One loaded model | launchd `com.hermes.mlx-coder` on `:8088` |
| Capabilities / audit | pinned contract layer + 2 ESLint red-build guardrails |

The scheduler in that table is the operator. **Check whether the cockpit has already automated any of
these rows** — that is the single most important thing this session can answer.

## Three gaps, each already a recorded failure in this repo

1. **No memory accounting.** `HANDOFF.bakeoff-era.md:64-68` — the phantom ~3-min timeout was
   *"coder swapping under 4-game memory exhaustion."* Two of four bake-off games never shipped.
   That is exactly the admission-control case: worker B should have been queued, not started.
2. **No checkpointing.** `HANDOFF.bakeoff-era.md:110-112` — *"Laptop sleep kills builds...
   `caffeinate` can't stop it."* Current mitigation is retries + a 10-min watchdog
   (`com.bakeoff.coder-watchdog`): liveness recovery, which **restarts** rather than **resumes**.
3. **No enforced result handoff.** *"the worker builds correctly but tends to exit without calling
   `kanban_complete`"* — noted as expected on every slice (`AGENTS.md:73-74`,
   `HANDOFF.bakeoff-era.md:51-54`). Today that's a protocol convention a model can silently violate.

## What the cockpit/Hermes stack has that the frameworks don't — preserve these

- **A hard external truth oracle.** `pnpm run verify` + `pnpm run test:live` + screenshots. Tasks
  don't terminate on the model's self-report; they terminate on gate-green. Letta/LangGraph/AutoGen
  generally do not center this.
- **Capability enforcement outside the model.** Sim-purity and no-second-spatial-index as *red builds*,
  plus packet allowlists — libOS-style capabilities that don't depend on agent cooperation.
- **A load-bearing human gate.** "mechanical halt for operator review"; the operator judges
  playability. This needs a real lifecycle state (blocked-on-human), not a sleep.

## Three places the proposal doesn't survive contact with the real stack

- **Not one model — a fleet.** mlx-coder `:8088`, glm-4.5-air on the DGX `100.108.249.113:4000`, and
  Claude. The scheduler needs a **placement** decision (which box, which tier), not only an admission
  decision. Single-resident-model is a Spark-only special case.
- **The verification lane competes for the same RAM.** `vite build`, Playwright, Chromium. Every
  framework listed models only LLM memory; a budget that ignores non-LLM consumers will oversubscribe
  and OOM the thing that proves correctness.
- **Workload mismatch.** `HANDOFF.md:74-76` records that delegating slices to the local Qwen builder
  was abandoned in practice — *"Default to building it yourself + verifying."* Quality, not
  throughput, bound the authoring work, and the cloud model won it.

## The recommendation to pressure-test

Point the runtime at **grinding** workloads, not authoring. "11h / 8.7M tokens / 184 subagents /
96K peak resident" is a throughput profile, and this repo has throughput-bound, machine-verifiable
work already: `BALANCE_WINRATE=1` (30 games × 5 seeds, full 3×3 faction matrix), the 600-tick
determinism harness (wants seed fuzzing), art-gen sweeps over 89 assets, MP soak
(5,805 lockstep ticks). Authoring stays cloud; the harness goes local.

Then the increment is not a new runtime but three additions to the Hermes gateway (already the choke
point): **(1)** a byte budget in the dispatcher — admission on KV, not on slot count; **(2)**
checkpoint/resume on tasks, retiring watchdog-and-pray; **(3)** generated handoffs — the runtime
writes `HANDOFF.md` at rollover instead of the operator.

## What to actually go read in `webops-control-center`

Answer these against the source, not from this brief:

1. Does the cockpit already track **resource state** (VRAM/RAM/KV, loaded-model residency) anywhere,
   or only task/worker state? Is there any admission gate besides a concurrency cap?
2. Where is the dispatch choke point in code — is there one function every task launch passes through
   that a byte budget could hook into?
3. Is there **persistence per task** beyond the kanban card (any checkpoint, resume token, or partial
   state), or does a killed worker restart from the packet?
4. How is model residency managed — one launchd service per model, on-demand load, or swap? Does
   anything prevent two large models being resident at once? (This is failure #1.)
5. Is completion **detected** or **reported**? If a worker exits without `kanban_complete`, does
   anything reconcile the task from evidence (git commit, file diff, gate result)?
6. Is there a lifecycle state for blocked-on-human, or is operator review out-of-band?
7. Does the cockpit already do context rollover/compaction for long-running sessions, or is that
   entirely the Markdown convention in this repo?
8. Routing: how are mlx-coder / DGX glm-4.5-air / cloud chosen today — static profile config
   (`~/.hermes/profiles/alex-builder/config.yaml`) or dynamic?

## Ground truth already established (don't re-derive)

- Repo: `~/Code/games/shard-dominion`. Live at speedrungames.net; deploy pipeline is operator-gated
  and documented in `HANDOFF.md:108-120`.
- The tool-call blocker is **fixed** — root cause was `tool_parser_type: json_tools` vs
  Qwen3-Coder-Next's XML tool calls; set to `qwen3_coder` (`HANDOFF.bakeoff-era.md:45-49`,
  `PROGRESS.md:582-583`). Not a version or timeout issue.
- Timeouts were hardened: `request_timeout_seconds: 1200`, `stale_timeout_seconds: 600`,
  `HERMES_API_TIMEOUT=900`, `HERMES_API_CALL_STALE_TIMEOUT=600`. Backups exist with `.bak.*` suffixes.
- The Axis-2 "Qwen ≫ GLM" verdict is **caveated** — the local Qwen may not have done the tool-using
  turns; the glm-4.5-air fallback may have.

## Constraints

- Read-only on the cockpit unless the operator says otherwise. Don't restart services, don't edit
  profiles, don't disrupt other Hermes models or SATORI.
- Don't touch this repo's immutable contract layer (`src/sim/**`, `src/loaders/**`,
  `data/weapons.json`) — see `AGENTS.md:29-37`.
- If the analysis above is wrong once you can see the code, say so plainly and correct the record.
  It was written without access to the cockpit.
