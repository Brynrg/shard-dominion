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
| Campaign 13 missions, 2 acts | 14 promised | 13 shipped — **M7 "The Turn" absent; Act I→II side-switch unexplained** | ✅ boot + trigger + choice gates |
| The M14 Choice (branch gameplay) | ✅ | ✅ (objectives/triggers branch; debriefs shared) | ✅ unit + gate |
| Objectives honesty (contested hold, visible secondaries, true pointer) | ✅ | ✅ (v0.42) | ✅ unit tests |
| Hero persistence + Veteran Reserve | ✅ | ✅ (loader fixed v0.42) | ✅ round-trip tests |
| Saves / replays (command-log) | ✅ | ✅ incl. boot-state (bonus/deployment/choice) | ✅ replay gate + unit tests |
| Superweapon (Faction Strike) | ✅ | ✅ UI wired v0.42 (was sim-only) | ✅ sim tests; UI arm path in gate suite |
| Multiplayer 1v1 / 2v2 lockstep | experimental | ✅ N-seat lockstep, full hash | ⚠️ machine-tested only — NO human field test yet; no reconnect; lobby via URL |
| Faction identity | 3 mechanical | Concord shields · Emberhand salvage+stealth+hero · **Shardborn = stat/palette only** | ✅ what exists is tested |
| AI | funded, goal-driven, finishes | ✅ FSM + finisher + sudden-death (v0.42) | ✅ balance harness: 6/6 matchups resolve decisively |
| Editor | "editor" | **Mission Kit** (validated JSON launcher + templates) — not a visual editor | ✅ gate |
| Art | painted everything | 14 painted sheets; expansion roster = procedural placeholders BY DESIGN | n/a (operator pipeline) |
| Accessibility | — | minimal (keyboard focus only) | ✗ known gap |

## Known gaps (deliberate, next-era)
M7 + Act II identity repair (the audit's v0.45 story revision) · Shardborn as a true
mechanical faction · visual editor · MP field test + reconnect · hero ability kits ·
walk/fire/death animation strips (operator art drop) · accessibility mirror.
