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
| Faction identity | 3 mechanical | Concord shields · Emberhand salvage+stealth+hero · **Shardborn = living-crystal regen + Chorus kinship (planet never hunts them)** — all 3 now mechanically distinct | ✅ unit tests + balance harness 9/9 |
| Balance fairness (v0.49) | all factions viable | **Shardborn retuned 15%→50% cross-faction win rate** (was 0/10 as defender; any speed deficit proved fatal — identity now toughness ×1.35 + regen 8/s + kinship at par cost/speed). Multi-seed win rates: concord 45% / emberhand 55% / shardborn 50%. | ✅ NEW `tests/balance/winrate.test.ts` (BALANCE_WINRATE=1, 30 games over 5 seeds, asserts no 0-win faction) + full 3×3 sweep matrix |
| Control fit-and-finish (v0.49) | WC3-grade | **Groups 1–9** (was 1–3, now seat-scoped for MP) · **double-tap any recall key centres the camera** · **Q = select army** · **I = cycle idle harvesters** · **O = select hero** (no-op safe) · briefing hint documents them | ✅ +4 unit tests (seat-scoping, army, idle-cycle, hero no-op) + NEW `controls.spec.ts` gate |
| AI | funded, goal-driven, finishes | ✅ FSM + finisher + sudden-death (v0.42) | ✅ balance harness: 6/6 matchups resolve decisively |
| Editor | "editor" | **Mission Kit** (validated JSON launcher + templates) — not a visual editor | ✅ gate |
| Art | painted everything | 14 painted sheets; expansion roster = procedural placeholders BY DESIGN | n/a (operator pipeline) |
| Accessibility | — | **v0.50:** aria-live screen-reader announcer (mission start · unit ready · under attack · power shortage · victory/defeat, deduped) + **colorblind team-shape markers** (○ own / ▲ hostile, dual-stroke, pause-menu toggle, persisted) + full hotkey legend in HUD & briefing | ✅ NEW `a11y.spec.ts` gate (announcer text, toggle, reload persistence) |

| Beyond-WC3 control depth (v0.51) | exceed the bar | **Shift-queued waypoint orders** (move + attack-move legs, 8-cap, dashed route + stop-dots drawn for the selection, plain order replaces, S clears) · **military-first box select** (a box over army+workers grabs only the fighters — WC3 has no such filter) | ✅ 5 unit tests (`orderQueue.test.ts`: sequencing, attackMove carry, replace/stop, cap, box filter) + NEW `beyond_wc3.spec.ts` gate |

| Westwood feedback layer (v0.52) | research-driven | **EVA announcer** (top-centre text flash + synthesized voice, toggleable+persisted, mirrors to aria-live): construction complete · unit ready · low power · base under attack · new construction options (tier-up) · storage full · **insufficient funds/tier/prereq/cells on refused build clicks** (denied clicks now buzz + swallow instead of falling through to field-select) · **SELL button** (Westwood convention: demolish selected completed buildings for 50% refund; refund granted AFTER removal — the ConYard is itself a bank). Sourced from the official RA/D2K manuals + EA's GPL'd RA source (deep-research run, 24 sources). | ✅ 2 sell unit tests + NEW `eva_sell.spec.ts` gate (EVA line + banner + sell refund/demolish) |

## Where the level of play EXCEEDS WarCraft III (evidence-backed)
WC3 remains the fit-and-finish benchmark; on these *measured* dimensions the game now
plays beyond it (WC3 1.x classic as reference):
- **Unlimited selection** — WC3 caps at 12 units/group; box + Q select the whole army.
- **Military-first box select** (v0.51) — SC2-era QoL WC3 lacks: boxing near the base
  never steals workers into the army.
- **Global production hotkeys** — T/R/H/V/C/E train from anywhere; WC3 requires
  selecting the production building first.
- **Double-tap recall centring on 1-9/Q/I/O** (v0.49) — WC3 only centres on group
  double-tap; here every recall key (incl. army/idle/hero) centres.
- **Accessibility** (v0.50) — aria-live screen-reader announcer + colorblind team-shape
  markers; WC3 shipped with neither.
- **Measured faction balance** (v0.49) — a reproducible multi-seed AI-vs-AI win-rate
  harness holds all 3 factions at 45-55%; WC3 balance was patch-by-feel, unreproducible
  by players.
- **Deterministic command-log saves/replays at ANY tick** + instant continue; and the
  whole game is instant web-play (no install, no CD key).
- Parity where WC3 leads elsewhere: shift-queued waypoints (v0.51), idle-worker key
  (v0.49), control groups, attack-move/stances/garrisons — all present and gate-tested.
Still short of WC3: roster breadth (4 heroes/race, items, neutral shops) — out of scope
by design (own identity, not a feature clone).

## Ship-Quality program (docs/SHIP_QUALITY_PLAN.md — in progress)
Toward a fully-realized, polished game in its own identity (WC3 = the execution/polish
bar, not a feature clone). Done: complete code-drawn art (v0.43); complete 3-act
17-mission campaign (v0.44); **economy depth — Refinements** (v0.45): a TECH tab of
team-wide researched upgrades at the Processing Plant (Deep Extraction, Munitions
Doctrine, Composite Plating, and the identity-tied **Resonance Dampers** that softens the
living planet's hunt), a credit+Cell sink applied deterministically at point-of-use. In
flight: **S2** faction/character build depth (Shardborn made real; hero kits) · **S4**
polish (AI research + sharpening, a11y, MP field test, balance).
