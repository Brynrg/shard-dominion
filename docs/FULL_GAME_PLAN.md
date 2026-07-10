# Shard Dominion — Front-to-Back Review & Full-Game Master Plan

> **Status: HISTORICAL design document — see /STATUS.md for current product truth.** Originally:** DRAFT FOR REVIEW · **Date:** 2026-07-09 · **Baseline:** v0.25.0 (commit `1c6a3a6`)
> **Author:** Claude, from a full-codebase audit (all sim systems, view, loaders, data, tests read)
> **North star (operator):** *"a full game that is front-to-back playable and as full-featured as Warcraft 3."*
> **This doc:** (1) honest calibration of that goal, (2) a front-to-back review with grades,
> (3) a WC3 gap analysis, (4) a phased master roadmap that absorbs the existing economy + campaign RFCs,
> (5) the decision points. Companion RFCs: `ECONOMY_DESIGN.md`, `CAMPAIGN_DESIGN.md`.

---

## 1. Calibrating the north star

Warcraft 3 was ~60 developers × ~4 years: 4 asymmetric factions (~12 units + full anim/voice sets each),
a hero/RPG layer, ~60 campaign maps with cinematics, battle.net multiplayer, and a modding platform that
birthed DotA. **Cloning that scale is not the plan.** The achievable, honest target is:

> **"WC3-class in kind, indie in scale":** every *category* of WC3 feature present and polished, at a
> fraction of the volume — 2 asymmetric factions, ~8–10 units each, a hero system, a 6–7-mission scripted
> campaign, neutral creeps/structures, a skirmish map pool with difficulty settings, save/replay, an
> editor-lite, and (stretch) 1v1 multiplayer.

That is genuinely reachable on this codebase, because the foundations are unusually good (§2.1). The plan
below sequences it so **every phase ships a playable, verified improvement** — the cadence that got us from
tech demo to v0.25 keeps going; no multi-month dark periods.

---

## 2. Front-to-back review (v0.25.0)

~5,300 lines of TS. 143 unit tests + 14 Playwright gates, all green. Bundle 143 KB gzipped→42 KB (huge headroom).

### 2.1 What is genuinely strong — protect these
| Asset | Why it matters |
|---|---|
| **Pure deterministic sim core** (fixed 20 Hz, no DOM/Date/random, ESLint red-builds violations, `stateHash` smoke) | The crown jewel. Makes **replays, mid-match saves, and lockstep multiplayer** cheap later — most indie RTSes can never retrofit this. |
| **Contract discipline + reserved seams** | `SYSTEM_ORDER` already reserves `order`, `projectile`, `agitation`, `planetEvent`, `audio`, `mission` slots — the engine *anticipated* this roadmap. |
| **Everything data-driven** | Units/weapons/structures/economy/missions in validated JSON. Content scales without logic changes; `validate:missions` gates bad data. |
| **Weapons roster ahead of units** | 13 weapons defined, only 3 used — tank shells ×3, siege (with splash), AA, flame, sonic, raider cannon are *already specced*. New units are mostly data. |
| **Mission framework (CP-1)** | Menu → briefing → typed objectives → debrief → progress. The campaign is now a content pipeline. |
| **Goal-driven AI FSM** | Stabilize/Recover/Raid/Assault/Pressure/Develop + reactive composition + a real harvested economy. Right foundation to deepen. |
| **Verification culture + deploy pipeline** | Every mechanic has a gate; deploys verified by Netlify state. This is why 3 versions shipped in 2 days without a regression. |

### 2.2 Front-to-back findings, graded

**A. Shell & presentation — D+**
Title menu exists (new). But: no options screen, **no pause**, no game-speed control, no restart from a
running match, no fullscreen toggle, no volume control (nothing to control — see B), fixed 800×600 backing
store (scales, but blurry-pixelated at 2×), no post-match stats.

**B. Audio — F (does not exist)**
**Zero sound.** No music, no unit acknowledgments, no weapon SFX, no UI clicks, no alerts ("base under
attack" exists in the schema's *audio-readability cue set* — defined, never implemented). The reserved
`audio` SYSTEM_ORDER slot is empty. This is the single largest "not a real game yet" gap; audio is half of
RTS game-feel (every C&C player can hum the refinery sound).

**C. Unit movement — D**
`movement.ts` is 35 lines: straight-line step-toward-target. **No pathfinding** (units walk through
impassable rock), **no collision** (units stack into one perfectly-overlapped point), no separation, no
formations, no arrival spreading. The tile grid + terrain data needed for A* already exist (`grid.ts`,
used only by command/fog).

**D. Command vocabulary — D+**
Have: click/box select, contextual right-click (move/attack/mine), 3 control groups, build/train hotkeys.
Missing the RTS staples: **attack-move** (the single most important RTS command), stop, hold-position,
patrol, **rally points** on production buildings, shift-queued waypoints, double-click select-all-of-type,
subgroup tab. Units under fire while moving keep walking; units with no orders never reposition.

**E. Combat depth — C−**
Instant-hit only; `projectile` slot unused (no arcing shells, no dodgeable missiles). `splash` is in
weapons data but `damage.ts` is single-target. No repair, no healing, no veterancy, no upgrades/research.
The RPS triangle (BULLET/ROCKET/SHELL × armor classes) is sound and data-tuned. Targeting is O(n²) — fine
at ~30 units, not at 200 (the built spatial index isn't used by combat).

**F. Economy — C+ (roadmap already locked)**
v0.24 gave the AI a real economy and legible harvesting. Still: one dock, no buildable refinery, one field
per side, no expansion decision. `ECONOMY_DESIGN.md` phases (split fields, buildable refinery, saturation,
power penalties, turret/repair, War Factory) are locked and queued — unchanged by this plan, just re-slotted.

**G. AI — B−**
The FSM is a real opponent (funded, reactive, escalating, raids). Gaps: reads the full board (no fog
honesty), one hardcoded personality, no build-order variety, no difficulty levels exposed, `Expand` latent
until the map exists, no wall-off/defense placement, retreats are crude.

**H. Content breadth — D**
3 player units + 1 enemy-flavored vehicle; 5 structures (one seed-only); **one 32×32 map**; one mission;
factions differ only by sprite tint. WC3-class needs: ~8–10 units/faction, 2 real factions, tech-tier
gating, a map pool, 6–7 missions.

**I. Campaign — C (CP-1 shipped)**
Mission 1 playable end-to-end with briefing/debrief/progress. Missing: triggers (mid-mission events),
missions 2–7, secondary objectives/rewards, a mission-select screen showing progress, difficulty, mid-
mission save. All specced in `CAMPAIGN_DESIGN.md` CP-2+.

**J. The WC3 signature layer — F (absent, by design so far)**
No heroes (XP/levels/abilities/items), no neutral creeps guarding map value, no neutral buildings
(shops/mercs/derricks), no day/night. This layer is *the* thing that separates WC3 from C&C. Note the
elegant convergence available: **Riftmaws (the planned planet hazard) ARE creeps** — neutral hostiles
nesting on rich Shard fields; and the parked RA2 derrick idea is a neutral capturable. The lore already
contains the WC3 layer.

**K. Persistence & meta — D**
Campaign progress persists (versioned, mission-id-keyed — good). No mid-match save/load, no replays
(trivially enabled by determinism + command log — currently thrown away), no match stats, no medals.

**L. Multiplayer — F (absent), but architecture-ready**
Nothing today. However: pure deterministic sim + command-intent queue + stateHash = **lockstep-ready by
construction**. A 1v1 needs a thin WS relay (Fly.io experience exists from gctd-server), input-delay
lockstep, and desync detection via the existing hash. Genuine stretch goal, not fantasy.

**M. Art & animation — C−**
Real painted sprites + seamless terrain (good baseline). But single-frame units (no walk/fire/death anims
— units *vanish* on death), the purple building-base issue (open thread, operator has the Grok prompt),
conyard is neutral-tinted for both teams, no build-up animation, no briefing portraits.

**N. Performance & tech debt — B**
Tiny bundle, clean architecture, no debt crises. Watch-items: O(n²) targeting (adopt the spatial index when
unit counts grow), renderer redraws everything every frame (fine at 800×600), fixed canvas resolution.

---

## 3. WC3 gap analysis (category → verdict)

| Category | WC3 | Shard Dominion v0.25 | Plan phase |
|---|---|---|---|
| Deterministic engine + replays | ✅ | ✅ core / ❌ replays unused | FG-6 |
| Pathfinding/collision/formations | ✅ | ❌ straight-line, no collision | **FG-1** |
| Audio (music/SFX/voice/alerts) | ✅ | ❌ none | **FG-1** |
| Command vocabulary (A-move, stop, hold, patrol, rally, queue) | ✅ | ❌ minimal | **FG-1** |
| Economy w/ real decisions | ✅ (gold+lumber+upkeep) | 🟡 roadmap locked | FG-2 |
| Base defense + repair | ✅ | ❌ | FG-2 |
| Combined arms + projectiles + splash | ✅ | ❌ (data ready) | FG-3 |
| Upgrades / research / tech tiers | ✅ | ❌ | FG-3 |
| Scripted campaign w/ triggers | ✅ (~60 maps) | 🟡 1 mission, no triggers | FG-4 |
| Difficulty levels | ✅ | ❌ | FG-4 |
| **Heroes (XP/abilities/items)** | ✅ signature | ❌ | **FG-5** |
| **Neutral creeps + buildings** | ✅ signature | ❌ (Riftmaws = the design) | **FG-5** |
| 2+ asymmetric factions | ✅ (4) | ❌ (tint only) | FG-6 |
| Map pool + skirmish setup screen | ✅ | ❌ (1 map) | FG-6 |
| Save/load + replays + stats | ✅ | 🟡 progress only | FG-6 |
| Multiplayer | ✅ battle.net | ❌ (lockstep-ready) | FG-7 (stretch) |
| Editor / modding | ✅ World Editor | 🟡 mission JSON | FG-8 (stretch) |
| Full anim sets + voice | ✅ | ❌ single-frame | continuous |

---

## 4. Master roadmap

Absorbs `ECONOMY_DESIGN.md` (E-phases) and `CAMPAIGN_DESIGN.md` (CP-phases) into one sequence. Every phase
= shippable + verified (unit tests + a Playwright gate per mechanic), operator plays each build. Versions
are indicative; each phase is 1–3 deploys.

### FG-1 · "Feels Like a Real RTS" (v0.26–v0.27) — game-feel table stakes
*The review's three F/D grades that make everything else feel better. Do this before more content.*
- **Audio system** (WebAudio, the reserved `audio` slot): music bed, ~15 SFX (fire ×3, explosion, harvest
  dock, build place/complete, train ready, click/select acks), **alert cues** ("base under attack",
  "harvester under attack" — already named in the schema), volume control + mute. View-layer playback off
  sim events (sim stays pure).
- **Pathfinding + collision:** A* over the tile grid (impassable rock finally matters) + unit separation
  steering + arrival spread; use the existing `grid` spatial index. Keep it deterministic.
- **Command vocabulary:** **attack-move (A)**, stop (S), hold position, **rally points** on barracks/
  refinery, shift-queued orders, 9 control groups, double-click select-type. New `order` slot usage.
- **Death feel:** corpse/wreck fade + explosion SFX (no more vanishing units).
- **Pause (P/Esc menu) + game speed** (−/+) + options overlay (volume, speed, hotkeys reference).
- *Gates:* pathing around rock; A-move engages en route; rally point delivers; audio cue on attack; pause
  freezes sim.

### FG-2 · "The Map Game" (v0.28) — economy RFC phases E2/E3/E4/E7 + AI Expand
- Split fields (2 flank + contested centre), buildable **Refinery** (de-bundled), dock saturation + HUD
  income readout, **power penalties** (prod −40% etc.), AI `Expand` state activates, AI difficulty knob
  (Easy/Normal/Hard presets over the existing FSM tunables).

### FG-3 · "Combined Arms" (v0.29) — economy RFC E8/E9 + combat depth
- **War Factory** + player vehicles: light tank (`tank_shell_v`), **siege tank** (`siege_cannon` —
  implement **projectile system** in its reserved slot + **splash damage**), AA/scout variants later.
- **Defense Turret** + structure **repair**.
- **Upgrades v1:** Tech Lab structure; weapon/armor +1 research (data-driven multipliers).
- AI uses vehicles + counters; unit cap sanity (soft supply akin to power).

### FG-4 · "The Campaign Arc" (v0.30–v0.32) — campaign RFC CP-2→CP-4
- **Trigger system** (message/spawn/reveal/grantCredits, deterministic) — missions feel authored.
- **Missions 2–4** (Lifeblood, Hold the Line, The Vein) leaning on FG-2/FG-3 mechanics, with mid-mission
  complications, secondary objectives + rewards.
- **Mission select screen** (progress, medals), difficulty selector, skippable briefings, M1 reinforcement
  beat retrofit.

### FG-5 · "The WC3 Layer" (v0.33–v0.34) — the signature differentiator
- **Hero: the Warden** — a buildable/revivable hero unit with XP, 3 levels, 2–3 activated abilities
  (e.g. Rally Aura, Concussion Strike, Emergency Shield), revival at the ConYard. New `hero` component +
  ability system (deterministic cooldowns).
- **Creeps = Riftmaws:** neutral hostile nests on rich fields (guard the best economy — WC3's creep-camp
  economics) + they ARE the planet-hazard lore. Killing nests grants XP/salvage.
- **Neutral capturable:** the parked derrick (passive income point) — fight over the map.
- Campaign M5 (Iron & Ash) ships here using heroes+vehicles.

### FG-6 · "Faction, Maps & Permanence" (v0.35–v0.36)
- **Faction program (§6.4):** Emberhand playable (FG-6a), then the Shardborn (FG-6b), optional Reach
  Syndicate (FG-6c) — each ships placeholder-first via procedural fallback chassis + palette, painted art
  swaps in later.
- **Skirmish setup screen:** map pool (3–4 authored maps via mission format), difficulty, faction.
- **Save/load + replays:** command-log capture (determinism pays off), post-match stats screen.
- Campaign M6 + optional M7 finale (Shardstorm hazard via `planetEvent` slot).

### FG-7 · "Multiplayer" (COMMITTED, v0.37+)
- 1v1 **lockstep** over WebSocket (Fly.io relay), input-delay model, `stateHash` desync detection,
  reconnect. Feasible *because* of the deterministic core. Promoted from stretch by operator decision (§6.3).

### FG-8 · "Editor & Modding" (stretch)
- In-browser mission/map editor emitting the existing mission JSON; share via URL/file. The validator
  already gates bad content.

### Continuous tracks (every phase)
- **Art:** purple-base re-gen (operator), team-colored conyard, then walk/fire/death frames or procedural
  animation overlays; briefing portraits at FG-4+.
- **Balance:** telemetry-driven passes after each phase (`__debugEconomyTeams` etc.).
- **Perf:** adopt spatial index in targeting when unit counts pass ~80; resolution scaling.

---

## 5. Sequencing rationale (why this order)

1. **FG-1 before content:** audio + pathfinding + attack-move multiply the value of everything that
   follows; every later playtest reads better. They're also the review's worst grades against "playable."
2. **Economy before combined arms before campaign missions** that teach them (the RFC interleave).
3. **Heroes/creeps (FG-5) before second faction (FG-6):** the WC3 layer changes how maps and balance work;
   design the faction around it, not vice versa.
4. **MP and editor last:** highest cost, and only worth it on a proven-fun single-player game — but the
   deterministic core means nothing done earlier blocks them.

## 6. Decisions — LOCKED (operator, 2026-07-09)

1. **Scope: RATIFIED** — keep the current theme (Aether Prime / Shard), scale in kind per §1.
2. **Hero system: IN** — FG-5 as planned.
3. **Multiplayer: PROMOTED** — FG-7 is now a **committed phase**, not a stretch goal. Implications threaded
   earlier: determinism stays a hard gate every phase (already enforced); FG-6's command-log capture/replay
   is now *required* (it is the lockstep substrate); add a determinism-hash liveness gate when pathfinding
   lands (FG-1's riskiest change to sim determinism).
4. **Factions: 3–4 TOTAL, placeholder art.** FG-6 expands from "add Emberhand" to a faction program:
   - **Meridian Concord** (baseline): industrial, disciplined — versatile mid-cost units.
   - **The Emberhand** (FG-6a): raider identity — cheaper/faster/fragile, salvage-from-wrecks economy twist.
   - **The Shardborn** (FG-6b): the planet answering — crystalline/bio units grown from Shard fields
     (Riftmaw-aligned; converges with the creep/hazard lore). Unorthodox economy (units seeded ON fields).
   - **(Optional 4th, FG-6c) The Reach Syndicate:** mercenary/tech — expensive elites, capturables, intel.
   - **Placeholder-art policy:** the engine's `graphics.fallback_geometry` procedural chassis system IS the
     placeholder mechanism — every new faction ships with distinct procedural silhouettes + team palettes
     first; Grok painted sets are generated separately and swap in via the existing manifest path with no
     code change.
5. **Animation frames: SOONER.** The sprite loader already supports multi-frame sheets + fps sidecars
   (built at v0.13, unused). Actions: extend `ART_ASSETS_SPEC.md` with paste-ready Grok prompts for
   walk/fire/death strips (operator generates alongside the purple-base re-gen); engine wiring + procedural
   interim animation lands during FG-1–FG-2 rather than post-FG-4.

---

*Review method: full read of `src/sim/**`, `src/view/**`, `src/loaders/**`, `data/**`, tests, and both
RFCs at v0.25.0. Findings verified against the running build (14/14 gates green at audit time).*
