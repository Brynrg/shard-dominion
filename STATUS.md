# Shard Dominion — Product Truth Table (v0.42.0, 2026-07-09)

> The single current-state document. Three columns: what was promised, what is
> implemented, what is machine-verified. The RFCs in `docs/` are HISTORICAL design
> documents — this file supersedes their status lines.
> Verification = 250+ unit tests + 31 Playwright browser gates + the AI-vs-AI
> balance harness (`BALANCE=1 npx vitest run tests/balance/sweep.test.ts`).

| Area | Promised | Implemented | Verified |
|---|---|---|---|
| Deterministic sim (20Hz, pure) | ✅ | ✅ | ✅ determinism harness + full stateHash sensitivity tests |
| Entity creation (all paths identical) | ✅ | ✅ canonical factory (v0.42) | ✅ cross-path parity tests |
| Team economy (one wallet) | ✅ | ✅ ledger (v0.42) | ✅ split-bank spend, enemy-dock refusal tests |
| Construction pacing (sites build up) | ✅ | ✅ (v0.42) | ✅ inert-scaffold → operational tests + gates |
| Cells / salvage / Resonance / relays | ✅ | ✅ | ✅ unit + browser gates (relay identity fixed v0.42) |
| Tech tiers, radar, walls+gates | ✅ | ✅ | ✅ gates |
| Stealth + detection | ✅ | ✅ | ✅ unit tests + M10 gate |
| Artillery, stances, garrisons, transports | ✅ | ✅ | ✅ unit tests + bunker gate |
| Air + AA + storms + shields | ✅ | ✅ (shared-lite frame per panel) | ✅ unit tests + flight gate |
| Campaign missions/acts | ship-quality, long | **17 shipped, 3 full acts** — M7 "The Turn" (the defection); complete Act III (M15 Aftershock → M16 The Ash Court → M17 Aether's Verdict), all branching on the Seal/Harness choice via inheritsChoice; the finale is now data-driven, not hardcoded to M14. | ✅ boot + trigger + choice + both-branch gates (M7, M15×2, Act III×3) |
| The M14 Choice (branch gameplay) | ✅ | ✅ (objectives/triggers branch; debriefs shared) | ✅ unit + gate |
| Objectives honesty (contested hold, visible secondaries, true pointer) | ✅ | ✅ (v0.42) | ✅ unit tests |
| Hero persistence + Veteran Reserve | ✅ | ✅ (loader fixed v0.42) | ✅ round-trip tests |
| Saves / replays (command-log) | ✅ | ✅ incl. boot-state (bonus/deployment/choice) | ✅ replay gate + unit tests |
| Superweapon (Faction Strike) | ✅ | ✅ UI wired v0.42 (was sim-only) | ✅ sim tests; UI arm path in gate suite |
| Multiplayer 1v1 / 2v2 lockstep | experimental | ✅ N-seat lockstep, full hash | ⚠️ machine-tested only — NO human field test yet; no reconnect; lobby via URL |
| Faction identity | 3 mechanical | Concord shields · Emberhand salvage+stealth+hero · **Shardborn = living-crystal regen + Chorus kinship (planet never hunts them)** — all 3 now mechanically distinct | ✅ unit tests + balance harness 6/6 |
| AI | funded, goal-driven, finishes | ✅ FSM + finisher + sudden-death (v0.42) | ✅ balance harness: 6/6 matchups resolve decisively |
| Editor | "editor" | **Mission Kit** (validated JSON launcher + templates) — not a visual editor | ✅ gate |
| Art | painted everything | 14 painted sheets; expansion roster = procedural placeholders BY DESIGN | n/a (operator pipeline) |
| Accessibility | — | minimal (keyboard focus only) | ✗ known gap |

## Ship-Quality program (docs/SHIP_QUALITY_PLAN.md — in progress)
Toward a fully-realized, polished game in its own identity (WC3 = the execution/polish
bar, not a feature clone). Done: complete code-drawn art (v0.43); complete 3-act
17-mission campaign (v0.44); **economy depth — Refinements** (v0.45): a TECH tab of
team-wide researched upgrades at the Processing Plant (Deep Extraction, Munitions
Doctrine, Composite Plating, and the identity-tied **Resonance Dampers** that softens the
living planet's hunt), a credit+Cell sink applied deterministically at point-of-use. In
flight: **S2** faction/character build depth (Shardborn made real; hero kits) · **S4**
polish (AI research + sharpening, a11y, MP field test, balance).
