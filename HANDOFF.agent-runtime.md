# Handoff — should we build an agent runtime, or extend WebOps?

> For a Claude Code session **running locally, with `webops-control-center` on disk**. Read cold, top
> to bottom. Sections 1-3 are the context (why this work exists); 4-6 are the state; 7-9 are yours to
> carry. Ownership of this thread transfers to you — see §8.

---

## 1. The decision on the table

**Is it worth building a local agent runtime — an "operating system for local intelligence" — or does
the WebOps cockpit plus Hermes already cover enough that the right move is three additions to the
dispatcher?**

That is the whole question. Everything below exists to answer it. It is a build-vs-extend call with
real cost on both sides: the runtime is a months-long project; the extension is arguably a week. The
operator (Jonathan) decides. Your job is to make the decision answerable with facts instead of
guesses.

Nobody has committed to building anything. If the honest answer is "the cockpit already does five of
these eight things, build nothing," that is a *good* outcome and the one the evidence should be
allowed to produce.

## 2. Where the idea came from

The thread started as "which agent runtime should we use for long-running local inference on the
Spark?" The survey landed at: no existing runtime is an unequivocal fit.

- **Letta** — closest conceptually. Persistent agents, context management, memory, long-running
  continuity. Its Context Repositories approach lets agents manage their own context through files,
  progressive disclosure, rewriting, and spawning sub-agents. Very close to "bounded working memory +
  persistent external state + disposable worker contexts."
- **LangGraph** — cleanest runtime primitives. Persistent checkpoints, resumable execution, threads,
  subgraphs, state propagation; checkpointing saves execution state per step and child subgraphs
  inherit persistence from the parent. Best foundation if we build it ourselves.
- **AutoGen / Magentic-One** — strongest on multi-agent delegation (orchestrator plans, delegates,
  tracks progress, replans), but oriented to "multi-agent team," not one-model/many-disposable-contexts.
- **Agent libOS** (June 2026, research) — models agents as schedulable processes with parent-child
  relationships, lifecycle state, typed object memory, checkpoints, capabilities, audit records.
  Conceptually an OS for agents. Right direction, prototype maturity.

**The gap none of them centers: local inference economics.** They think in tokens, messages, agents,
workflows. A runtime for a fixed local box has to think in *bytes of resident memory*:

```
Model weights            = 62 GiB
Parent KV                =  7.4 GiB
Worker A KV              = 12.1 GiB
Safe remaining budget    = 14.6 GiB
Worker B est. requirement= 18 GiB
→ Do not start Worker B. Queue it.
   On A's completion: persist evidence → return ~1,400 tokens → destroy session
   → reclaim 12.1 GiB → start Worker B.
```

The shape: **Persistent Agent** over a **Context Manager** (token/KV accounting, rollover, compaction,
retrieval) and an **Agent Scheduler** (spawn/suspend/kill, worker priority, concurrency limits,
foreground priority), both feeding a **Context Broker** that admits parent + workers against **one
loaded model** on vLLM/SGLang.

Target operating profile — the thing that makes it worth building:

```
Agent lifetime 11 h · 8.7M tokens processed · peak resident context 96K
Parent generations 037 · subagents spawned 184 · peak active workers 2 · model copies loaded 1
```

vLLM/SGLang = GPU execution kernel. The runtime = operating system for local intelligence. The
objective function it optimizes, which the others don't: **maximize useful reasoning per byte of
resident memory and per token of active context on a fixed local compute budget.**

## 3. Why we went looking at `shard-dominion`

The operator asked how this compares to the current WebOps setup. A cloud session (scoped to
`brynrg/shard-dominion`, and **permanently unable to attach `brynr-builds/*` — cross-owner adds are
blocked**) could only reach the Hermes stack as *described inside this repo*: `HANDOFF.bakeoff-era.md`,
`HANDOFF.md`, `AGENTS.md`, `packets/*.md`. That produced §4, which is a hypothesis built on
documentation, not on the cockpit's source.

Hence you. You can see the real thing.

## 4. What that analysis concluded (verify or refute this)

**Finding: the proposed architecture already exists in `shard-dominion` — hand-operated, in Markdown,
with the operator as the scheduler.** It has been run ~20 slices deep, which is real validation of the
*shape*; what's missing is automation.

| Proposed primitive | Hand-operated equivalent |
|---|---|
| Context rollover (parent gen N→N+1) | `HANDOFF.md:3` — "Paste into a fresh Claude Code session" |
| Compaction | `AGENTS.md:3-5` — distilled from every failure that cost a rework round |
| Persistent external state | `PROGRESS.md`, `STATUS.md`, `PHASE_STATUS.md` |
| Disposable worker context + capability bound | `packets/S*.md` — task envelope + **file allowlist** |
| ~1.5K result contract | "one commit; update `PROGRESS.md`; CALL `kanban_complete`" |
| Agent scheduler | Hermes kanban board `game-bakeoff` + `com.hermes.gateway-local` |
| One loaded model | launchd `com.hermes.mlx-coder` on `:8088` |
| Capabilities / audit | pinned contract layer + 2 ESLint red-build guardrails |

**Three gaps, each already a recorded failure in this repo** (this is the strongest part of the case —
these aren't hypotheticals):

1. **No memory accounting.** `HANDOFF.bakeoff-era.md:64-68` — the phantom ~3-min timeout was
   *"coder swapping under 4-game memory exhaustion."* Two of four bake-off games never shipped. That
   is exactly the admission-control case: worker B should have been queued, not started.
2. **No checkpointing.** `HANDOFF.bakeoff-era.md:110-112` — *"Laptop sleep kills builds...
   `caffeinate` can't stop it."* Mitigation today is retries + a 10-min watchdog
   (`com.bakeoff.coder-watchdog`): liveness recovery, which **restarts** rather than **resumes**.
3. **No enforced result handoff.** *"the worker builds correctly but tends to exit without calling
   `kanban_complete`"* — expected on every slice (`AGENTS.md:73-74`). A protocol convention a model
   can silently violate, not a runtime guarantee.

**Three things this stack has that Letta/LangGraph/AutoGen don't center — preserve them:** a hard
external truth oracle (`pnpm run verify` + `pnpm run test:live`; tasks terminate on gate-green, not on
self-report); capability enforcement outside the model (sim-purity + no-second-spatial-index as *red
builds*, plus packet allowlists); and a load-bearing human gate ("mechanical halt for operator
review") that needs a real blocked-on-human lifecycle state, not a sleep.

**Three places the proposal breaks on the real stack:** it's a *fleet*, not one model (mlx-coder
`:8088`, DGX glm-4.5-air `100.108.249.113:4000`, cloud Claude) so the scheduler needs a **placement**
decision, not just admission; the verification lane (`vite build`, Playwright, Chromium) competes for
the same RAM and no listed framework models non-LLM consumers; and `HANDOFF.md:74-76` records that
delegating slices to the local Qwen builder **was abandoned in practice** — *"Default to building it
yourself + verifying."*

## 5. The recommendation the answer feeds into

Because authoring was won by the cloud model, the proposal should be pointed at **grinding** workloads
instead. "11h / 8.7M tokens / 184 subagents" is a throughput profile, and this repo has throughput-bound,
machine-verifiable work already: `BALANCE_WINRATE=1` (30 games × 5 seeds, full 3×3 faction matrix), the
600-tick determinism harness (wants seed fuzzing), art-gen sweeps over 89 assets, MP soak (5,805
lockstep ticks). Authoring stays cloud; the harness goes local.

If that holds, the increment is **not a new runtime** but three additions to the Hermes gateway, which
is already the choke point:

1. **A byte budget in the dispatcher** — admission on KV, not on slot count. (Kills failure #1.)
2. **Checkpoint/resume on tasks** — retires watchdog-and-pray. (Kills failure #2.)
3. **Generated handoffs** — the runtime writes `HANDOFF.md` at rollover instead of the operator.

**Your findings decide which of those three survive**, and whether #1 is a small hook or a rewrite.
That is what the answer is *for*.

## 6. What to read in the cockpit

Answer these against `webops-control-center` source, not against this brief:

1. Does the cockpit track **resource state** (VRAM/RAM/KV, loaded-model residency) anywhere, or only
   task/worker state? Any admission gate besides a concurrency cap?
2. Where is the dispatch choke point in code — one function every task launch passes through, that a
   byte budget could hook?
3. Is there **per-task persistence** beyond the kanban card (checkpoint, resume token, partial state),
   or does a killed worker restart from the packet?
4. How is model residency managed — one launchd service per model, on-demand load, or swap? Does
   anything prevent two large models being resident at once? (Failure #1.)
5. Is completion **detected** or **reported**? If a worker exits without `kanban_complete`, does
   anything reconcile the task from evidence (git commit, file diff, gate result)?
6. Is there a lifecycle state for blocked-on-human, or is operator review out-of-band?
7. Does the cockpit already do context rollover/compaction for long-running sessions, or is that
   entirely the Markdown convention in this repo?
8. Routing: how are mlx-coder / DGX glm-4.5-air / cloud chosen — static profile config
   (`~/.hermes/profiles/alex-builder/config.yaml`) or dynamic?

## 7. If you already ran the finding

Good — that's §6 done. The part that was missing is what it's *for*, which is §1 and §5. So now:

- Re-read your findings against §4's three gaps and §5's three increments. For each increment, say
  **already exists / partially exists / missing**, and if partial, name the file and function.
- Kill anything §4 got wrong. It was written without cockpit access and is expected to be wrong in
  places; correcting it is worth more than confirming it.
- Then answer §1 in one paragraph: build, extend, or do nothing — with the evidence that decides it.

## 8. How to continue the work locally

**This thread is now yours.** The cloud session cannot see the cockpit and never will (cross-owner
attach is blocked in v1), so it can't lead this. Practical consequences:

- **Write results where both sides can see them.** Either commit a findings doc to this repo on branch
  `claude/agent-runtime-local-inference-aridhl` (which is where this brief lives, PR
  `Brynrg/shard-dominion#1`, draft), or post them as a comment on that PR. Don't leave the answer only
  in a local transcript — that's the exact failure this document is a fix for.
- **Suggested artifact:** append a `## Findings (local session, <date>)` section to *this file* — it
  keeps question and answer in one place, and makes the next rollover cheap.
- **The operator decides build-vs-extend.** Give him the call with evidence; don't make it for him and
  don't start building the runtime off your own conclusion.
- **If you do get a green light for increment #1**, the natural first slice is read-only: instrument
  the dispatcher to *log* what it would have admitted or queued under a byte budget, using real KV
  numbers, before enforcing anything. Cheap, reversible, and produces the data that sizes the rest.

## 9. Ground truth and constraints

Already established — don't re-derive:

- Repo: `~/Code/games/shard-dominion`. Live at speedrungames.net; deploy pipeline is operator-gated,
  documented at `HANDOFF.md:108-120`.
- The tool-call blocker is **fixed** — root cause was `tool_parser_type: json_tools` vs
  Qwen3-Coder-Next's XML tool calls; set to `qwen3_coder` (`HANDOFF.bakeoff-era.md:45-49`,
  `PROGRESS.md:582-583`). Not a version or timeout issue.
- Timeouts were hardened: `request_timeout_seconds: 1200`, `stale_timeout_seconds: 600`,
  `HERMES_API_TIMEOUT=900`, `HERMES_API_CALL_STALE_TIMEOUT=600`. Backups exist with `.bak.*` suffixes.
- The Axis-2 "Qwen ≫ GLM" verdict is **caveated** — the local Qwen may not have done the tool-using
  turns; the glm-4.5-air fallback may have.

Constraints:

- **Read-only on the cockpit** unless the operator says otherwise. Don't restart services, don't edit
  profiles, don't disrupt other Hermes models or SATORI.
- Don't touch this repo's immutable contract layer (`src/sim/**`, `src/loaders/**`,
  `data/weapons.json`) — `AGENTS.md:29-37`.
- Don't build the runtime. §1 is undecided.
