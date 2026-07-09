# Shard Dominion — Expansion Master Plan ("Beyond the Classics")

> **Status:** REVIEWED — decisions LOCKED in §11 (3-panel round, 2026-07-09); §8 phasing superseded by §11.6 · **Date:** 2026-07-09 · **Baseline:** v0.34.0 (FG-1→FG-7 complete, QA round 1 fixed)
> **Operator directive:** *"expand the storyline and gameplay well beyond Dune 2000 / C&C Red Alert / Warcraft 3.
> Story double the size, added complexity, more complex gameplay, economy, building and combat."*
> **Companions:** `FULL_GAME_PLAN.md` (executed), `ECONOMY_DESIGN.md`, `CAMPAIGN_DESIGN.md`.
> **Reviewers:** §2 for the story, §3–§6 for the systems, §8 for phasing, **answer §10**.

---

## 1. Calibrating "beyond"

The FG plan delivered "WC3-class **in kind**, indie in scale" — every category present. "Beyond" cannot mean
out-arting 60 Westwood developers; it means **out-designing them in depth per system**, with mechanics those
games *didn't have*:

> **"Deeper than the classics, indie in volume":** a two-act, 14-mission campaign with persistent state and a
> second playable faction; a two-tier refining economy with a market and risk harvesting; tech-tier base
> building with walls, addons, radar and superweapons; combat with an air layer, stealth, stances, garrisons
> and hero kits; three genuinely asymmetric factions; and the planet itself as a living third force.
> All of it deterministic (multiplayer-safe), data-driven, placeholder-art-first, shipped in verified slices.

The classics comparison, honestly: Dune 2000 = 1 resource, no heroes, scripted AI. RA = 1 resource + naval +
superweapons. WC3 = 2 resources, heroes, creeps, upkeep. **Our stack after this plan:** 2-tier refining chain
+ market + salvage + storm-risk harvesting; heroes with ability kits AND persistent campaign growth; a living
planet (Riftmaws/Shardstorms/Blooms) no classic had; lockstep MP on a deterministic sim; missions as JSON
(editor-ready). That is a defensible "beyond."

---

## 2. Story expansion — Act II: *The Waking Deep* (7 → 14 missions)

### 2.1 Where Act I left the board
Vane's stronghold fell; the Riftmaws woke; "Reckoning" (M7, optional) evacuates through a planet in revolt.
Corr calls it victory. The final sensor ping shows Riftmaw activity under *every* major Shard site.

### 2.2 Act II premise — you switch sides
**Act II is the Emberhand campaign** (the locked FG-6 decision made playable content): you are **Sera Vane**,
rebuilding from the ashes, as the **Shardborn** emerge — the planet's answer, crystalline colonies growing on
the fields both armies bleed for. The Concord Directorate overrules Corr and orders **Project Cauterize**:
scorch every vein on the continent. Vane must do what insurgents do — survive, salvage, steal — and then the
unthinkable: fight *alongside* Corr's renegade column when he refuses the order, against both the Directorate
and the Waking Deep itself.

- **New voices:** **The Chorus** (the Shardborn gestalt, speaking through shard-touched prisoners — it does
  not negotiate, it *quotes you back to yourself*); **Broker Yssel** of the Reach Syndicate (sells to all
  sides, the market mechanic personified); **Director Halex** (the Directorate's voice — Cauterize's author).
- **Corr's arc** completes: competent-but-blind → the man who saw too late → renegade ally. Vane's arc:
  prophet → warlord → the one who must decide what "the planet wins" actually means.
- **Finale (M14):** a three-way battle at the First Vein. The player choice teased in Act I is real now and
  mechanically cheap (two debrief branches, one flag): **seal the Deep** (Shard economy dies planet-wide —
  the Reach starves but Aether lives) or **harness it** (the Chorus bonded to human hands — sequel hook).

### 2.3 Mission arc (M8–M14, each = mechanic + pressure + twist + secondary + consequence)
| # | Title | You | Teaches (new system) | Twist |
|---|---|---|---|---|
| 8 | **Ashfall** | Emberhand | Salvage economy (wreck reclaiming) | Your "base" is a moving convoy |
| 9 | **The Exchange** | Emberhand | Capturable Processing Relays (Cell conversion) | Yssel auctions relay access — then sells your position to the Concord mid-mission |
| 10 | **Stormline** | Emberhand | Storm harvesting (2× yield inside Shardstorms) + stealth units | First Shardborn contact — they ignore you… at first |
| 11 | **Cauterize** | Emberhand | Air layer (evade + build AA) | Directorate bombers scorch fields you were mining |
| 12 | **The Renegade** | Emberhand + Concord gift units | Combined asymmetric armies | Corr defects to you with a broken battalion |
| 13 | **Choir of Glass** | Emberhand | Anti-Shardborn warfare (creep lattice, spore towers) | The Chorus speaks through YOUR shard-touched troops |
| 14 | **The First Vein** | Emberhand (+Corr AI ally) | Everything + superweapons | Three-way finale; the Choice |

**Persistent campaign state (as locked in §11.1.3):** hero level + ability picks persist; surviving veteran
squads convert to capped **Veteran Reserve** points spent on a small pre-mission **Deployment panel** (+1 vet
squad / +200 Shard / +1 ability point / intel). No raw squad carryover — missions stay tuned from a known
baseline. Stored in the versioned `campaignProgress`, applied at `seedFromMission`.

---

## 3. Economy 2.0 (beyond one-resource)

1. **Two-tier refining chain:** raw **Shard** (as today) + **Refined Cells** — a **Processing Plant**
   converts Shard→Cells at a tunable rate; T2/T3 units and structures cost *both*. Adds a real
   production-chain decision (raw military now vs refined tech later) without WC3's chore-harvesting.
2. ~~The Syndicate Exchange (market building)~~ **CUT in review (§11.2)** → replaced by **capturable
   Processing Relays**: neutral map structures that boost Cell conversion while held (derrick-capture
   mechanic reused). Broker Yssel survives as the story voice of relay access.
3. **Salvage (Emberhand identity, all factions lite):** destroyed vehicles leave **wrecks**; any harvester
   (Emberhand: any unit) can reclaim ~30% of cost. Battles literally fertilize the economy — fights over
   battlefield corpses, a C&C-never-had loop.
4. **Storm harvesting (risk/reward):** harvesting inside an active Shardstorm yields 2× but storms damage
   exposed units and ground aircraft. The weather becomes an economic decision.
5. **Kept from before:** finite fields + Blooms, dock saturation, salvage trickle floor, power-as-brake.
   **Still declined:** upkeep taxes, worker micromanagement.

## 4. Building 2.0

1. **Tech tiers:** Construction Yard upgrades **T1→T2→T3** (cost + time + power step). T2 unlocks Processing
   Plant / War Factory addons / Radar; T3 unlocks superweapons + faction apex units. The classic Dune 2000
   ladder, but per-faction shaped.
2. **Walls + Gates:** cheap linear segments (crush-able by heavy tracks, as in RA); gates auto-open for
   friendlies. Pathfinding already tile-based — walls are blocking entities.
3. **Building addons** (WC3-beyond, C&C-never): Barracks+**Infirmary** (slow heal nearby infantry),
   War Factory+**Machine Shop** (vehicle self-repair aura), Refinery+**Overdrive Rig** (faster dock,
   +explosion on death — the panel's old risk/reward idea, landed at last).
4. **Radar:** minimap requires a Radar structure + power (classic C&C readability stake).
5. **Superweapons (T3, one per faction, long global timer, map-wide alert):** Concord **Orbital Lance**
   (delayed pinpoint annihilation), Emberhand **Storm Caller** (summon a directed Shardstorm), Shardborn
   **Riftmaw Clutch** (hatch 3 juvenile Riftmaws under enemy ground).
6. **Repair Bay** (vehicles drive on, credits drain) + **Skypad** (builds/rearms aircraft).

## 5. Combat 2.0

1. **The air layer:** per-faction gunship + a transport; AA infantry/turret as counters. Aircraft ignore
   ground pathing (new move plane), must rearm at Skypads (no infinite loiter), storms ground them.
2. **Artillery + counter-battery:** long-range siege with minimum range + scatter; radar reveals firing
   positions for 3s (counter-play, not just counter-units).
3. **Stealth + detection:** Emberhand **Ghostwalker** cloaks while stationary; detectors = radar radius,
   scouts, watchtowers. Shardborn units *sense* through creep lattice.
4. **Stances & orders:** aggressive / defensive / hold-fire / patrol per unit; formation move (units arrive
   as a line, not a snake); target-priority (attack-move prefers combat units over harvesters unless told).
5. **Garrisons + transports:** bunkers hold 4 infantry (fire out, armored); the APC/skimmer carries 5.
6. **Hero kits (WC3-parity, then beyond):** 3 active abilities per hero on cooldowns (Warden: Rally Surge /
   Orbital Flare / Bastion Field · Vane: Ember Veil (mass stealth) / Salvage Storm / Dead Man's Bargain),
   chosen 1-per-level — and **levels persist across the campaign** (§2.3), which WC3 only did per-campaign-arc.
7. **Veterancy elite tier** (3 chevrons → self-heal + ability), building kill-credit, and the existing RPS
   matrix extended to AIR/ARTY rows. Targeting moves to the spatial index (perf at 200+ units).

## 6. Faction asymmetry 2.0 (from stat-mods to identities)

| | **Meridian Concord** | **The Emberhand** | **The Shardborn** |
|---|---|---|---|
| Identity | Industrial line-holder | Scavenger swarm | The planet, organized |
| Economy quirk | Overdrive rigs (risk refining) | **Salvage** everything | Buildings **grow on fields**, eat density |
| Signature units | Shield Sentinel, Lance Trooper, Bulwark Tank, Orbital Gunship | Ghostwalker (stealth), Scrap Titan (built FROM wrecks), Storm Skimmer | Lattice Spire (living turret), Choir Walker (converts infantry), Brood Burrower |
| Superweapon | Orbital Lance | Storm Caller | Riftmaw Clutch |
| Playstyle | Fewer, tougher, upgrades | Cheap, fast, map-wide | Territory itself fights |

Placeholder-first stays law: every new unit ships as a distinct procedural chassis + palette; Grok art swaps
in later. AI: one strategy profile per faction (Concord sieges, Emberhand raids, Shardborn creeps outward).

## 7. Systems & meta

- **Editor-lite:** missions are already validated JSON — ship an in-game editor page (place tiles/fields/
  entities/objectives → exports mission JSON) + a "load custom mission" entry. FG-8, finally real.
- **Replay browser:** command-logs are already saves — list, replay, seek (run-to-tick).
- **MP growth:** 2v2 (the lockstep protocol is seat-count-agnostic; relay rooms of 4), observer seat.
- **AI-vs-AI autoplay harness** (balance instrument): headless sim battles, telemetry out — tune the
  balance surface this plan doubles, without 100 hours of hand-play.

---

## 8. Phased rollout (every phase ships playable + gated, the discipline that got us here)

| Phase | Ships | Anchor gates |
|---|---|---|
| **XP-1 "Tiers & Walls"** (v0.35) | HQ T1–T3, Radar(+minimap gate), walls/gates, addons | tier gating unit tests; wall blocks path; addon auras measurable |
| **XP-2 "Economy 2.0"** (v0.36) | Processing Plant + Cells, Exchange, salvage wrecks, storm harvest | chain math unit-tested; prices deterministic; wreck reclaim gate |
| **XP-3 "Sky & Siege"** (v0.37) | Air layer + AA + Skypad, artillery + counter-battery, stances, garrisons, transports | air ignores walls gate; AA counters; stance behaviors unit-tested |
| **XP-4 "Asymmetry"** (v0.38) | Faction rosters + mechanics + superweapons + hero kits, faction AI profiles | per-faction roster gates; superweapon timer/alert gate; determinism suite extended |
| **XP-5 "Act II · Embers"** (v0.39) | M8–M10 + persistent hero/veterans + salvage/market/storm missions | mission chain validation; persistence round-trip test |
| **XP-6 "Act II · The Deep"** (v0.40) | M11–M14, Shardborn as campaign antagonist, the Choice, credits | finale branch flags; full-campaign playthrough gate |
| **XP-7 "Forge"** (v0.41) | Editor-lite, replay browser, 2v2, autoplay balance harness | editor exports valid mission; 4-seat lockstep gate |

Sequencing rule unchanged: **systems before the missions that teach them** (XP-1–4 before XP-5–6). Each phase
deployable alone; balance passes ride the autoplay harness from XP-2 onward.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Complexity kills readability (the #1 way "more" becomes "worse") | every mechanic must pass "explainable in one sentence"; HUD/comm teaching beats (QA-proven pattern); staged unlocks via tiers |
| Balance surface explodes (3 factions × air × 2 resources) | AI-vs-AI autoplay harness + per-phase telemetry review; data-only tuning |
| Perf at 200+ units + air + creep | combat targeting → spatial index (XP-3); perf budget gate (tick < 8ms at 250 units) |
| Determinism regressions (MP dies silently) | every new system sim-pure; determinism hash suite grows with each phase (already the law) |
| Scope creep in Act II writing | mission-design rules from CAMPAIGN_DESIGN §3.1 apply verbatim; 7 missions, no more |
| Art volume | placeholder-first (procedural chassis) stays law; Grok batches per phase, never blocking |

## 10. Decision points for the operator/panel

1. **Second resource (Refined Cells):** in as specced (recommended), or keep one-resource and gate tiers by
   structures only?
2. **Air layer scope:** gunship+transport+AA per faction (recommended), or a single shared airframe first?
3. **Persistent campaign state:** hero levels + veteran carryover (recommended), hero-only, or none?
4. **Act II playable side:** Emberhand throughout (recommended), or alternate Concord/Emberhand per mission?
5. **Superweapons:** all three at XP-4 (recommended), or defer to post-Act-II balance?
6. **The M14 Choice:** two-debrief branch (cheap, recommended) or two distinct final missions (expensive)?
7. **2v2 + editor priority:** XP-7 as placed, or pull the editor earlier for community missions?

---

## 11. Review round 1 — three-panel synthesis, adversarially verified · DECISIONS LOCKED

Three independent panel reviews returned. Convergence was strong; where they disagreed I verified against
this codebase's actual costs. Dispositions:

### 11.1 The 7 decisions — FINAL
1. **Second resource → MODIFIED (narrowed), IN.** All three said "not money #2." Adopted the strongest
   version: **Refined Cells are production CHARGES, not currency** — a Processing Plant converts Shard→Cells
   on a visible deterministic queue; **low storage cap (~12)**; Cells are spent ONLY on elite systems
   (superweapon charge, hero abilities, air rearm, T3/signature units). One sentence: *"Refineries turn
   Shard into a few precious Cells; Cells arm your best weapons."* T1/T2 stay Shard-only. (Declined one
   reviewer's "use Power upkeep instead" — upkeep taxation was already declined in ECONOMY_DESIGN, and
   power is already the soft brake.)
2. **Air → MODIFIED (shared-lite first), IN.** Unanimous against full per-faction air. Adopted: **one
   shared gunship frame** (palette per faction) + **rearm pad** + AA answers; storms ground aircraft.
   Faction air *flavor* arrives later as upgrades — and the "off-map orbital call-in" idea becomes
   **Concord's** later flavor rather than the whole air system. (Verified pushback: "a new movement plane
   breaks determinism/pathing" is overweighted here — air movement is straight-line, which this engine
   already has; the real cost is unit count + AI behaviors, hence shared-lite.)
3. **Persistence → MODIFIED, IN.** Unanimous: **no raw veteran-squad carryover** (it makes every mission a
   multi-state balance problem). Adopted: **hero levels/kit persist** + **Veteran Reserve** — surviving
   chevroned squads convert to capped points spent on a tiny **pre-mission Deployment panel** (one
   reviewer's "missing system," which is the natural UI for another's "reserve currency"): +1 veteran
   squad / +200 Shard / +1 hero ability point / reveal intel. Hard-capped; missions stay tuned from a
   known-zero baseline.
4. **Act II side → LOCKED (unanimous IN):** Emberhand/Vane throughout.
5. **Superweapons → MODIFIED (campaign-scripted first), unanimous.** Debut as **scripted Act II set
   pieces** (finale-centric: visible charge, map-wide alert, counter-OBJECTIVE — destroy the relay / power
   it down). Skirmish/MP versions ship later behind a data flag once telemetry exists.
6. **M14 Choice → UPGRADED (one reviewer's middle path).** One mission, but the Seal/Harness flag **gates
   real gameplay content via triggers** (Seal: heavier Riftmaws/storms + defensive buffs; Harness:
   overdrive units + faster corruption) — the choice changes play, not just debrief text, at one-mission
   cost. Needs only a small trigger-condition extension (choice flags).
7. **Editor → SPLIT VERDICT RESOLVED.** Adopted "internal mission kit EARLY, public editor late": schema
   docs, validator (exists) + **trigger preview + play-from-JSON dev menu + mission template generator +
   replay browser as a debug tool** land during XP-1..XP-5. Declined one reviewer's "full public editor at
   XP-2" — community-content multiplication assumes a community; the near-term payoff is MY authoring
   velocity for Act II.

### 11.2 The market is CUT (three-way convergence)
"Deterministic drifting prices" drew fire from all three (fake depth / solvable / AI can't use it /
determinism risk). **Replaced by capturable Processing Relays** — neutral map structures that boost Cell
conversion while held (reuses the derrick capture mechanic verbatim). Map fights instead of menu
optimization. Broker Yssel survives as story (M9 re-themed: the Syndicate auctions RELAY access; you take
it by force).

### 11.3 NEW CORE SYSTEM — Resonance (two reviewers independently invented it)
One called it "Planet Anger," the other "Shardborn Resonance"; same idea → strong signal. **Adopted as an
Economy 2.0 pillar in the market's place:** each side's extraction RATE raises its Resonance; thresholds
escalate storms/Riftmaw aggression **against the heaviest extractor**. Deterministic (pure function of
mined totals), reuses existing hazards, is the anti-snowball brake, makes the Shardborn mechanically
present all game, and is the thesis of the campaign ("the economy is power AND poison") expressed as a
mechanic. Mission-local first; campaign-global (feeding the M14 Choice) later. One sentence: *"The harder
you mine, the harder the planet hits back — at you specifically."*

### 11.4 Asymmetry cost ordering (adopted)
Faction mechanics are NOT equal-cost: **Emberhand first** (salvage rides existing wreck logic; needed for
Act II), **Concord second** (shields/orbital are ability-driven), **Shardborn last** (living bases ≈ a
second game mode; they're the campaign ANTAGONIST first, playable later).

### 11.5 Adopted design laws (from the risk sections)
- **Three-use rule:** a system isn't campaign-critical until it has a tutorial, a pressure, and a remix
  mission — else defer it.
- **AI-or-it-doesn't-ship:** every new system lands WITH its AI behavior rules (stealth needs AI detection
  use; relays need AI capture logic).
- **Determinism suite grows every phase** (already law; now explicit for storms/wrecks/Resonance/air).
- **UI budget:** one new permanent HUD element per phase, max — readability is the law that gates all of it.
- **Story beat adopted:** "Echoes of the Shard" — corrupted neutrals that pact or turn mid-mission (Act II
  flavor via existing neutral + trigger systems).

### 11.6 REVISED PHASING (supersedes §8)
| Phase | Ships | Notes |
|---|---|---|
| **XP-1 "Foundations & Forge-lite"** ✅ SHIPPED v0.35.0 (2026-07-09) | T1–T3 tiers, radar, walls/gates + **mission kit** (play-from-JSON dev menu, trigger preview, templates) | tooling multiplies everything after |
| **XP-2 "Economy 2.0"** (v0.36) | Cells-as-charges + Processing Plant, salvage wrecks, **Resonance v1**, capturable Relays | the unique strategic loop, complete |
| **XP-3 "Emberhand + Act II·1"** (v0.37) | Emberhand true asymmetry (salvage identity, Ghostwalker stealth+detection) + **M8–M10** | build the playable side, then teach it |
| **XP-4 "Ground Depth"** (v0.38) | Artillery+counter-battery, stances, garrisons, transports, addons + balance validation sprint | deepen ground before air |
| **XP-5 "Sky-lite"** (v0.39) | Shared gunship + rearm pad + AA; storms ground air; Concord shield mechanic | air after ground is stable |
| **XP-6 "Act II·2 + Finale"** (v0.40) | **M11–M14**, scripted superweapons, choice-gated finale, campaign-global Resonance, credits | the payoff |
| **XP-7 "Forge & Arena"** (v0.41) | Public editor, replay browser polish, 2v2, skirmish superweapons, Shardborn-playable groundwork | scale + community |

### 11.7 The sharpened thesis (one reviewer said it best)
> *"Do not try to beat Red Alert by adding every RTS feature. Beat it by making Shard extraction, Cell
> tech, salvage, and Resonance form one tight strategic loop. That loop is unique."*
That is now the plan's spine. Air, superweapons, and 2v2 are supporting cast.
