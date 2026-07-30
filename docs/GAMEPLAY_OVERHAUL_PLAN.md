# Shard Dominion — Gameplay Overhaul Plan

> **Goal:** a game you can sit down and play start to finish the way you play C&C Red Alert,
> Dune 2000, or WarCraft III — a real opening, a real mid-game, a real endgame, against an
> opponent worth beating, solo / vs-AI / multiplayer.
>
> **Premise of this document:** the engine is not the problem. `pnpm run verify` is green
> (290 tests), the sim is deterministic, lockstep MP holds 5,805 ticks with zero desync, and
> there are 24 units / 25 structures / 20 missions of authored content on disk. The problem is
> that **almost none of that reaches the player, and the match itself is decided in under four
> minutes.** This plan is about the play loop and the operating model, not the substrate.

---

## Part 0 — How this was measured

Everything below is from the running game and two new env-gated probe harnesses added
alongside the existing `_playtest.spec.ts` convention (they're `skipIf(!PACING)`, so
`pnpm run verify` stays at 290 passing):

| Harness | Command | What it answers |
|---|---|---|
| [`tests/balance/_pacing_probe.test.ts`](../tests/balance/_pacing_probe.test.ts) | `PACING=1 npx vitest run tests/balance/_pacing_probe.test.ts` | Income curve, milestone affordability, enemy aggression timeline, match length |
| [`tests/balance/_ai_exploit_probe.test.ts`](../tests/balance/_ai_exploit_probe.test.ts) | `PACING=1 npx vitest run tests/balance/_ai_exploit_probe.test.ts` | Is the AI exploitable, what does it actually build, does it pay the player's construction cost |

Plus a live session on `localhost:5199` and a static reachability diff of
`data/*.json` against the sidebar menu in `src/view/hud.ts`.

---

## Part 1 — Diagnosis

### Finding 1 — The match is over before it starts (the headline problem)

Measured, passive player (harvests, builds nothing), skirmish, `data/missions/skirmish.json`:

| Difficulty | Player wiped at | Enemy army value @1:00 | @2:00 | @3:00 |
|---|---|---|---|---|
| Easy | **4:10** | ◈2600 (10 units) | ◈4800 (18) | ◈6600 (24) |
| Normal | **3:22** | ◈2600 (9) | ◈5200 (21) | ◈7200 (37) |
| Hard | **3:16** | ◈2600 (9) | ◈5100 (20) | ◈7300 (34) |

Three things are wrong at once:

1. **The whole difficulty range is 54 seconds wide.** Easy is not easy. There is no setting at
   which a new player gets to learn the game.
2. **The enemy out-produces the player ~3:1 on the same nominal economy.** The player's bank
   peaks at ◈2231 across 20 minutes; the enemy converts to ◈7200 of army by 3:00. The AI is not
   cheating on income — it's that the player's single starting harvester at 6/s can never match a
   producer that never stops.
3. **An AI-vs-AI match resolves at 5:48.** RA/WC3/D2K matches run 15–30 minutes. There is no
   mid-game here at all: opening → blob → over.

### Finding 2 — There is no economic progression, so there is no build order

The player can afford **every structure in the game inside the first 16 seconds**, and HQ Tier 3
(◈2000) by **0:43**:

```
Barracks 300      @ 0:00        Radar 600        @ 0:15
Power 400         @ 0:00        War Factory 1000 @ 0:15
Refinery 1200     @ 0:15        Proc Plant 800   @ 0:16
HQ Tier2 1000     @ 0:15        HQ Tier3 2000    @ 0:43
```

In RA, the tension of the first four minutes *is* the game: power → refinery → second harvester
→ do I take the War Factory or a second Ore Truck? Here every one of those decisions is free.
Costs are calibrated as if income were scarce; income is not scarce, so nothing costs anything
in the only currency that matters — **time**.

### Finding 3 — The AI is neutralised by one ◈100 unit

Measured. Park a single infantry 6 tiles from the enemy base and do nothing else:

| | First Assault | Time spent in Assault | Time spent in Stabilize |
|---|---|---|---|
| No bait | 1:15 | **91%** | 1% |
| One ◈100 infantry parked | 3:52 | **2%** | **98%** |

`Stabilize` triggers on *any* hostile combat unit within `defendRadius` (8 tiles) of the AI base
and has **no exit hysteresis and no cost/benefit test** — so a 100-credit decoy pins the entire
enemy army at home for the whole match. This is not a subtle exploit; it is the dominant
strategy, and it is the same mechanism that made the AI-vs-AI probe end 5:48 with the enemy
sitting in `Stabilize` from 0:12 onward and never leaving.

### Finding 4 — The AI builds nothing and techs nothing

Measured over 15 minutes against a passive player, the enemy's structure census went:

```
0:00  refinery 1, barracks 1, construction_yard 1, power_node 1
1:24  + relay 1        (a neutral capture, not a build)
FINAL refinery 1, barracks 1, construction_yard 1, power_node 1, relay 1

NEVER BUILT: defense_turret, bunker, wall, gate, radar, skypad,
             infirmary, machine_shop, ion_cannon, tech_lab
```

The "7-state FSM" runs two states in practice. The AI is permanently credit-starved because it
re-queues a unit every evaluation, so it never banks the ◈2500 that gates its War Factory or the
◈1500 that gates `Expand`. Consequences:

- **The enemy base is four buildings with zero defences.** There is nothing to besiege, no
  turret line to break, no reason to bring artillery or air.
- The AI never fields vehicles, air, heroes, stealth, artillery, or the superweapon. All of that
  content is player-only, so it's never *taught* to you by an opponent using it.
- The AI never repairs, never walls, never expands, never garrisons, never retreats a damaged
  unit.

**Two fairness asymmetries in the same code path:** the AI creates structures with
`state.store.create({...structureComponents(...)})` — instant, operational, no build site, no
clock, no one-at-a-time restriction (`state.structureBuild.get('enemy')` is `null` all match),
while the player pays upfront → waits the sidebar clock → places → waits a ~3s unfold, one
structure at a time. And the AI reads `state.store.all()` directly, so it is fully omniscient
(see Finding 5).

### Finding 5 — Fog of war is a screen effect, not a mechanic

`makeFogSystem` computes `visible`/`explored`, and the **only** consumer is `renderer.ts`.
Neither `ai.ts` nor `combatTargeting.ts` reads it. So:

- The AI knows your army composition, your bank, your harvester's position, and whether you have
  air, through solid fog.
- Your units acquire and fire on targets you cannot see.
- **Scouting has no purpose and map control has no reward.** There's a Radar structure and a
  Scout unit whose entire genre-purpose is information, and information is free.

### Finding 6 — Roughly half the authored content is unreachable

`src/view/hud.ts` hardcodes the build menu as three literal arrays. Diffing against `data/`:

| | On disk | Reachable in-game | Unreachable |
|---|---|---|---|
| Units | 24 | 11 | **11 real** — `commando`, `engineer`, `howitzer`, `medium_tank`, `super_heavy_tank`, `laser_trooper`, `transport_apc`, `repair_truck`, `defense_drone`, `razor` (Emberhand hero), `tempest` (Shardborn hero) |
| Structures | 25 | 14 | **7 real** — `tech_lab`, `air_pad`, `barracks_elite`, `armor_upgrade_center`, `ion_cannon`, `resonance_device`, `heavy_gate` |
| Missions | 20 + 5 skirmish maps | 17 + 2 | **m18/m19/m20** (Act 4 epilogue) and **Desert Clash / Twin Peaks / Four Corners** are absent from the `MISSIONS` registry in `main.ts` |

So: two of three factions have no reachable hero. There is no Tech Lab, so the tech tree has no
spine. There is no Air Pad. The two superweapon structures (`ion_cannon`, `resonance_device`) —
listed in `PHASE_STATUS.md` as the top Phase 3 priority — cannot be built. The Act 4 finale is
written and cannot be played.

### Finding 7 — The tech tree is decorative

Three separate breaks in `data/refinements.json` (13 entries) and `src/sim/systems/research.ts`:

1. **`prerequisites` and `tier` are parsed and never enforced** — not in the HUD
   (`enabled = !isDone && !busy && affordable && hasPlant`) and not in the sim. Tier-3
   `quantum_leap` is researchable at minute one.
2. **Tier-2 upgrades are shadowed, not stacked.** `refinementValue()` returns the *first* match
   by effect, so once `munitions_doctrine` is done, `advanced_munitions` (+25%) can never apply.
   The entire tier-2 tier is a no-op for any effect you already own at tier 1.
3. **Three effects are applied nowhere at all**: `range`, `firepower`, `buildTime`. That makes
   `extended_range`, `rapid_fire`, and `quantum_leap` pure no-ops.
4. The TECH tab renders all 13 entries at 38px from y=146 in a 574px panel → **~60px of overflow
   with no scroll**; the last refinement is unclickable.

### Finding 8 — No producer → unit binding

`production.ts` will build *any* unit from *any* producer; it gates only on `tier` and
`factionLock`. The Barracks-makes-infantry / War-Factory-makes-vehicles / Air-Pad-makes-air
structure is a **view-side convention only** (`hud.ts`'s hardcoded `isVehicle()` list). This is
why the AI happily queues a vehicle at its barracks. It also means:

- Destroying a War Factory doesn't stop tanks.
- There is no reason to protect a specific production building.
- Build-order and tech-structure decisions have no mechanical teeth.

### Finding 9 — The endgame is a mop-up, and the objective lies

`victory.ts` declares a winner only when a side has **zero living combat units AND zero
producers**. In practice: after you've flattened the enemy base you must sweep a 32×32 map for
the last stray infantry. And the skirmish briefing says *"Destroy the enemy base"* while the
objective banner (from `skirmish.json`'s `eliminate` objective) says *"Destroy the enemy
forces"* — I saw both on screen in the same session.

### Finding 10 — Game setup is a stub

- **Skirmish** offers 1 map of 2 registered (of 5 authored), 3 factions, 3 difficulties. No
  opponent count, no team setup, no starting-resource or crate/superweapon toggles, no map
  preview, always exactly one enemy.
- **Multiplayer** has relay/room/mode only. **No faction, map, or difficulty picker** — faction
  comes from a URL param and the map is always `skirmish`. There is no in-lobby readiness,
  colour, or slot assignment.
- **Challenges** parse `playerCanAttack`, `playerCanBuild`, `constraint`, `constraintParam` and
  then use none of them; only `survive` duration and `destroy` credit overrides do anything.
- **No AI in multiplayer** (`aiSystems = mp ? [] : …`), so no co-op-vs-AI and no filling an empty
  slot with a bot.

### Finding 11 — Readability

On screen, terrain / structures / units are all in the same dark violet register at similar
value. In the live session I could not tell my two infantry from ground clutter without the
selection ring, and the enemy base read as a terrain blob. Also: the 32×32 map fits almost
entirely on one screen at zoom 1 (nothing to scroll to, nowhere to flank), the radar panel
occupies a large screen block to say `NO RADAR`, and `panelRect()` reports `h: 380` while the
sidebar is drawn 574 tall — so the bottom third of the sidebar isn't in the edge-scroll dead
zone and browsing those buttons drags the camera.

---

## Part 2 — The target operating model

The reference games all share a spine that this game currently lacks. Stating it explicitly,
because it's what the plan below is built to deliver:

| Beat | Red Alert / D2K / WC3 | Shard Dominion today |
|---|---|---|
| **0:00–1:00 opening** | Scout, place power + refinery, second harvester. Money is tight. | Everything is affordable; nothing to scout; one build. |
| **1:00–5:00 early game** | Tech structure decision, first real army, first contact, expansion. | Enemy blob of 20+ arrives; match effectively over. |
| **5:00–15:00 mid game** | Map control, expansions, tech tiers, counter-composition, static defence, harass. | Does not exist. |
| **15:00+ endgame** | Superweapon, mass army, base-crack, decisive push. | Does not exist. |
| **Ending** | Base falls → opponent is done. | Sweep the map for one straggler. |

**Design principles for the overhaul**

1. **Time is the currency, not credits.** Costs should be re-expressed in seconds-of-income.
2. **Every structure must matter when it dies.** Bind producers to what they produce.
3. **The AI plays the same game you do** — same construction cost, same fog, same tech gates.
4. **Information is earned.** Fog gates the AI and combat, so scouts, radar, and stealth mean
   something.
5. **One reachable path per authored thing.** No content ships that the player cannot click.

---

## Part 3 — The plan

Sequenced so that **each phase leaves the game more playable than the last**, and the first
phase alone converts it from "decided in 3 minutes" to "a real match".

### Phase A — Make one skirmish match good (the core loop) · biggest win, smallest surface

**A1. Re-pace the economy around time-to-income.**
- Raise map/field density and give the player **two starting harvesters** on skirmish maps, then
  re-cost every structure in *seconds of one harvester's income* rather than flat credits.
- Target opening curve: Power+Refinery ≈ 0:45, first tech structure ≈ 2:00, HQ Tier 2 ≈ 4:00,
  HQ Tier 3 ≈ 9:00, first superweapon ≈ 14:00.
- Add **harvester count as the real economic lever** (RA's Ore Truck decision): each additional
  harvester should be a visible, affordable, meaningful purchase.
- **Gate:** extend `_pacing_probe` with an asserted milestone table (Tier 2 no earlier than
  3:00, Tier 3 no earlier than 7:30) so this can never silently regress.

**A2. Slow the army curve and add a supply ceiling.**
- Enemy army value at 1:00 must fall from ◈2600 to roughly ◈600–800. Increase unit build times
  (the barracks is currently an infinite tap) and make production **one job per producer** with
  a visible queue, so army size scales with *buildings you invested in*, not with time.
- Introduce a soft cap tied to structures (RA-style: production throughput; or WC3-style: a
  food/upkeep curve). Recommend the RA model — it fits this codebase and the sidebar already.

**A3. Rebuild difficulty as three genuinely different opponents.**
Currently Easy/Normal/Hard differ by 54 seconds. Make them differ in *behaviour*:
- **Easy** — one production building, no expansion, attacks in telegraphed waves with a lull,
  never raids harvesters. Target: a new player survives 20 minutes and wins.
- **Normal** — expands once, techs to tier 2, walls its base, raids economy, retreats damaged
  units. Target: an even match around 15–20 minutes.
- **Hard** — multi-pronged attacks, two expansions, tier 3, superweapon, punishes an
  undefended flank.
- **Gate:** a win-rate harness per difficulty against a *scripted baseline player* (not another
  AI), asserting Easy ≥ 80% player win, Hard ≤ 25%.

**A4. Fix the ending.**
- Win when the opponent has **no Construction Yard and no producers** (RA convention), with
  remaining stragglers auto-surrendering. No map sweep.
- Add a **surrender** option and a **defeat-is-final** message.
- Reconcile `skirmish.json`'s objective text with the briefing so the banner and the briefing
  agree.

**A5. Bind producers to products** (`production.ts`).
- Add a `producedBy` field to each unit in `data/units.json`, enforced in the sim: Barracks →
  infantry, War Factory → vehicles, Air Pad/Skypad → air, Refinery → harvesters, Elite Barracks →
  commando/hero.
- Drive the sidebar off that field instead of the hardcoded `isVehicle()` list. This makes A6/B
  and Phase C nearly free.

**A6. Make the map a map.**
- Promote to **64×64 minimum** for skirmish (the authored `four_corners` is already 48×48), with
  bases outside one screen of each other, 2–3 contested expansion fields between them, and
  chokepoints worth holding.
- Register the three authored skirmish maps (Finding 6) so there's a real map pool.

### Phase B — Make the AI an opponent

**B1. Kill the Stabilize pin.** Add hysteresis and a threat test: only defend if the incoming
threat value exceeds a fraction of the defending army's value, hold the defend state for a
minimum dwell, and require *sustained* proximity (N consecutive evaluations) rather than a single
frame. A ◈100 decoy must not move an army worth ◈5000.

**B2. Give the AI a build order, not a bank threshold.** Replace the "if credits ≥ X, build Y"
ladder with a **prioritised build plan per difficulty** that reserves credits for the next
structure instead of always re-queueing a unit. Concretely: the AI must reach a War Factory, a
Tech Lab, static defences, and an expansion in a normal match — the current probe shows it
reaches none of them.

**B3. Make the AI pay the player's construction cost.** Route AI structures through the same
`structureBuild` job + construction-site path the player uses. This is both a fairness fix and
the thing that makes AI bases *crackable* (a half-built structure is a target).

**B4. Put the AI behind fog.** Give the AI a per-team knowledge model — last-known positions,
decaying — instead of `store.all()`. This single change creates scouting, ambushes, stealth
value, and radar value all at once. It is the highest-leverage change in the whole plan for
making the game feel like an RTS.

**B5. Teach the AI the rest of its own roster:** static defence, air, artillery, transports,
repair, hero, superweapon, retreat-damaged-units, and focus-fire (the existing squad code is a
good base). Each is a small addition once B2 gives it a plan and a budget.

**B6. AI in multiplayer and co-op.** Drop the `mp ? [] : …` restriction so lobbies can fill empty
slots with bots and support 2-humans-vs-2-AI.

### Phase C — Make the content reachable

**C1. Data-drive the sidebar.** Delete `BASE_MENU`/`DEF_MENU`/`UNIT_MENU`. Generate the menu from
`data/units.json` + `data/structures.json`, keyed on `tier`, `producedBy`, `factionLock`, and
prerequisites. This is what unlocks all 18 stranded units/structures at once, and it removes the
permanent drift risk between data and UI.
- Needs **paged or scrolling sidebar tabs** (RA's arrow-scroll convention) — with 24 units the
  fixed 10-row panel cannot hold the roster. Fixes the TECH-tab overflow too.
- Fix `panelRect()` to report the real 574px height.

**C2. Repair the tech tree.**
- Enforce `prerequisites` and `tier` in the sim (authoritative) and reflect them in the HUD with
  a "requires X" hint.
- Make same-effect refinements **stack additively** instead of first-match-wins.
- Implement the three unapplied effects (`range`, `firepower`, `buildTime`) or delete those three
  refinements. Do not ship no-op upgrades.
- Add **Tech Lab** as the tier-2/3 spine (it's already in `structures.json`).

**C3. Ship the superweapons.** `ion_cannon` and `resonance_device` exist as data. Add the
area-effect command + cooldown UI (already scoped in `PHASE_STATUS.md` Phase 3) and make them the
14-minute win condition the mid-game builds toward.

**C4. Register the missing missions and maps** (m18–m20, Desert Clash, Twin Peaks, Four Corners),
and add the Act 4 entries to `CAMPAIGN`.

### Phase D — Solo play

**D1. Campaign structure.** With Phase A pacing landed, re-tune all 20 missions: a campaign
mission should run 12–25 minutes, not 4. Verify each mission is *winnable and losable* under the
new economy — this is a mission-by-mission playthrough pass, and the `missions.test.ts` validator
should grow an assertion that every mission's objectives are reachable from its starting
loadout.

**D2. A real tutorial.** The current `HOW TO PLAY` briefing block is a wall of text. Replace with
a scripted M0 that gates on actions ("build a Power Node" → waits → "now a Refinery"), using the
existing `missionTriggers` system. The onboarding step ids in `schemas.ts`
(`select_mcv`, `deploy_mcv`, `choose_foundation`, …) suggest this was already intended.

**D3. Finish challenges.** Implement the four parsed-but-unused rule fields, or cut them from the
schema. Add score/time tracking and a leaderboard-shaped local best.

**D4. Skirmish setup that matches the genre.** Opponent count (1–3), team assignment, AI
difficulty *per opponent*, starting resources (low/normal/high), map preview, crates/superweapon
toggles.

### Phase E — Multiplayer

The lockstep substrate is proven (5,805 ticks, zero desync) — everything here is lobby and
match-setup work, not netcode.

**E1. Real lobby:** slot list, per-slot faction + colour + team + human/AI/open, map picker with
preview, host-locked settings, ready-check, and a chat line. Today two players cannot even pick
different factions from the lobby.

**E2. Map pool for MP:** the MP path hardcodes `skirmish`. Wire the map picker to the registry
(and Four Corners for 4P FFA).

**E3. Reconnect + graceful drop.** A dropped seat currently ends the match. Add a hold-and-resume
window and a "player left → their base goes neutral / AI takes over" path.

**E4. The 2-human field test** — still the one thing never done. It's a 20-minute task once E1
lands, and it should be repeated after every phase.

### Phase F — Readability and feel

**F1. Value separation.** Push a three-band value ramp: terrain dark and low-contrast, structures
mid, units bright with a hard team-colour rim. Right now all three sit in the same band. This is
the difference between "I can read the battlefield at a glance" and what the live session showed.

**F2. Team colour as a first-class channel** — not just the existing colourblind shape markers.
Player/enemy/ally/neutral should be instantly separable at zoom-out.

**F3. Reclaim the radar block.** Before Radar is built, that panel space should show something
useful (objectives, selection detail) rather than a large `NO RADAR`.

**F4. Selection and command feedback pass** at the new match length: unit portraits/stats for the
selection, a proper command bar, and health bars readable at zoom-out.

---

## Part 4 — Sequencing recommendation

**Do Phase A first, and stop to play it.** A1–A4 alone (economy re-pacing, army curve,
difficulty behaviours, win condition) turn a 3-minute blob-rush into a real match, and they touch
a small number of files: `data/*.json`, `production.ts`, `ai.ts` config, `victory.ts`. Everything
else in this plan is more enjoyable to build *after* there is a 15-minute match to build it into.

Then, in order of gameplay-per-unit-of-work:

1. **A1–A6** — the match exists.
2. **B1 + B3 + B4** — the opponent is honest (kill the pin, same construction cost, behind fog).
   B4 is the single change that most makes this feel like the reference games.
3. **C1** — data-drive the sidebar; 18 stranded units/structures light up at once.
4. **B2 + B5** — the AI uses that roster.
5. **C2 + C3** — the tech tree and superweapons give the mid-game a destination.
6. **D1** — re-tune the campaign to the new pacing.
7. **E1–E2** — the lobby.
8. **F** — readability, continuously, not last.

## Part 5 — Verification per phase (non-negotiable, per `BUILD_CONSTITUTION.md`)

| Phase | New gate |
|---|---|
| A | `_pacing_probe` promoted to an **asserting** test: milestone timings, enemy army-value ceiling per minute, match length 12–25 min |
| A3 | Win-rate harness vs a scripted baseline player, per difficulty (Easy ≥80% / Hard ≤25%) |
| B1 | `_ai_exploit_probe` promoted to an asserting test: a ◈100 decoy must not drop Assault share below 60% |
| B3 | Unit test: every AI structure passes through a construction site and the one-at-a-time job |
| B4 | Unit test: the AI cannot target or path to an entity outside its knowledge model |
| C1 | Test: **every** id in `units.json`/`structures.json` is either reachable in the sidebar or explicitly flagged internal — the drift that caused Finding 6 becomes impossible |
| C2 | Tests: prerequisite refusal, tier refusal, additive stacking, and every declared effect has an application site |
| D1 | Per-mission winnability test under the new economy |
| E1 | Playwright lobby gate + the 2-human field test |

## Appendix — Fix-now list (small, independent, no design decisions needed)

These are cheap and can land immediately, outside the phases:

1. Register `m18`/`m19`/`m20` + 3 skirmish maps in `MISSIONS` and `CAMPAIGN` / `SKIRMISH_MAPS`.
2. `panelRect()` returns `h: 380`; the panel is drawn `ph = 574`. Fix the edge-scroll dead zone.
3. TECH tab overflows the panel with 13 refinements — add scroll/paging.
4. Skirmish briefing says "Destroy the enemy base"; the objective banner says "Destroy the enemy
   forces". Pick one.
5. `chooseUnit()` in `ai.ts` classifies the player's army with `f.faction === 'vehicle'`, which
   only matches the legacy `vehicle` unit — so tanks and scouts are counted as infantry and the
   AI's counter-composition logic reads the board wrong. Classify by `armorClass` instead.
6. Delete or implement the `range` / `firepower` / `buildTime` refinement effects.
7. Delete or implement `playerCanAttack` / `playerCanBuild` / `constraint` / `constraintParam` in
   the challenge schema.
8. `STATUS.md` and `PHASE_STATUS.md` both report the Phase 1a–1d content as shipped. It is on
   disk but not reachable; the truth table should say so until Phase C lands.
