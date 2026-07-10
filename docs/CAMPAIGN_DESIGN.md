# Shard Dominion — Story Mode (Campaign) Design Brief

> **Status: HISTORICAL design document — see /STATUS.md for current product truth.** Originally:** DRAFT FOR REVIEW (story bible + engine architecture) · **Target:** v0.30.0-series
> **Date:** 2026-07-07 · **Author:** Claude (Opus 4.8), with operator direction
> **Scope:** a single-player **campaign** (à la C&C / Dune 2000 / Warcraft) — story, factions, a 5–7
> mission arc, the mission-data format, and the engine changes to run it. Skirmish (the current game) is
> preserved as "the default mission".
> **Reviewers:** read §1 (story bible) and §3 (the mission arc) for the narrative; §4–§5 for the engine.
> Answer §8.

---

## 0. The core idea (and a happy synergy)

A Westwood-style campaign is a **sequence of hand-authored missions**, each with its own map, starting
forces, briefing, and **objectives beyond "destroy everything"** (defend, survive, escort, hold, build),
strung on a **story** with progression and save.

**The synergy worth calling out:** our economy roadmap (`ECONOMY_DESIGN.md`) is already building the exact
mechanics a good campaign teaches — economy, raiding, defense, expansion, combined arms. So the campaign
can **double as the tutorial-through-mastery arc for those systems, in order.** Each mission showcases the
mechanic we ship that phase. One arc, two payoffs.

---

## 1. Story bible

### 1.1 Setting
**Aether Prime** is a scoured desert world and the only known source of **Shard** — the crystal that powers
every fleet, foundry, and thinking-machine across **the Reach** (the settled worlds). Hold Aether Prime's
Shard and you hold the balance of power. The planet is beautiful and lethal: open sand scoured by
**Shardstorms**, and — where mining bites deepest — **Riftmaws**, crystalline burrowers roused by greed.

### 1.2 Factions (IP-clean, original)
- **The Meridian Concord** *(you)* — a coalition military of the settled worlds, sent to secure Shard
  extraction "for the good of the Reach." Disciplined, industrial, order-through-strength. Steel-and-cyan
  livery. You play a rising Concord field commander, **callsign Warden**; your handler is **Marshal Thane
  Corr**, who delivers your briefings.
- **The Emberhand** *(antagonist)* — an insurgency of the dispossessed and the **Shard-touched**, who hold
  Aether Prime as sacred and the Concord as plunderers. Guerrilla, fast, raid-happy, ember-and-crimson.
  Led by the **Ashen Warlord, Sera Vane** — charismatic, ruthless, and a better strategist than the Concord
  admits.
- **The planet itself** *(hazard, not a playable side in v1)* — **Riftmaws** on high-density Shard and
  **Shardstorms** on open sand. Environmental danger that turns terrain into a decision.

### 1.3 The arc's spine (tone: gritty, morally shaded — not grimdark)
You arrive to "restore order and secure the Shard." You win battles. But mid-arc the ground itself starts
to answer: the Concord's aggressive extraction is **waking the Riftmaws and worsening the storms**, and Sera
Vane's "zealots" turn out to be the only ones who saw it coming. The finale forces the question the Concord
never asked — *is the Reach's hunger for Shard worth the world it's killing?* Leave a clean sequel hook; keep
the missions playable as straight RTS regardless of how deep a player reads the story.

---

## 2. What makes a "mission" (vs skirmish)

Skirmish today = one map, one win rule ("destroy all enemy combat + producers"). A **mission** adds:
1. a **hand-authored map + starting forces** (yours and the enemy's),
2. **typed objectives** (primary = must complete to win; secondary = optional reward/story),
3. **failure conditions** (lose the mission, not just "your army died"),
4. a **briefing** (before) and **debrief** (after win/lose), and
5. a place in a **campaign sequence** with saved progress.

---

## 3. The campaign arc (6 missions + optional 7th)

Each mission: **hook · situation · primary objective(s) · failure · new mechanic it teaches** (mapped to the
economy roadmap phase that ships it). Difficulty and force sizes ramp across the arc.

| # | Title | Hook & situation | Primary objective(s) | Failure | Teaches (roadmap) |
|---|---|---|---|---|---|
| **1** | **First Light** | Concord dropships hit the sand; a small Emberhand watch-post overlooks the landing zone. | Destroy the Emberhand watch-post. | Your force wiped. | Core controls (folds today's onboarding). Base game. |
| **2** | **Lifeblood** | The Concord needs Shard flowing *now*; Emberhand raiders hunt your harvesters. | Bank **N credits** **and** keep your Refinery alive. | Refinery destroyed / harvesters all lost. | Economy + harvester raid/flee. **v0.24** |
| **3** | **Hold the Line** | Dig in at Canyon Reach; waves of Emberhand hit until relief arrives. | **Survive N minutes.** | HQ destroyed. | Base defense / turrets. **v0.26** |
| **4** | **The Vein** | A rich Shard vein sits between you and the Emberhand. | Take **and hold** the central vein for N seconds; deny theirs. | HQ destroyed. | Expansion / map control. **v0.25** |
| **5** | **Iron & Ash** | Break a fortified Emberhand forward base — infantry won't be enough. | Destroy the forward base (needs armor from your new War Factory). | HQ destroyed. | Combined arms / vehicles. **v0.27** |
| **6** | **The Ashen Warlord** | Assault Sera Vane's stronghold as a Shardstorm rises. | Destroy the stronghold **and** survive the counterattack. | HQ destroyed / defended asset lost. | Everything + hazard. |
| **7** *(opt)* | **Reckoning** | The Riftmaws wake. A choice: scorch the vein or hold the line with Vane. | Branch: survive the Riftmaws / escort the evac. | Asset lost. | Hazards + sequel hook. |

**Objective-type taxonomy (drives the engine, §5):** `destroy` (a target or all-of-faction), `defend`
(keep an entity/building alive), `survive` (last N seconds), `hold` (control a region for N seconds),
`accumulate` (reach C credits), `build` (construct a structure type), `reach` (move a unit into a region).
Win = all **primary** objectives complete. Lose = any **failure** condition.

---

## 4. Engine architecture (additive, contract-safe, maps to today's seams)

Four additive pieces; the sim core stays pure/deterministic; nothing rewrites the immutable contract.

### 4.1 Mission data — `data/missions/*.json` (+ zod loader `src/loaders/missions.ts`)
```jsonc
{
  "id": "m1_first_light", "name": "First Light", "order": 1,
  "map": { "width": 32, "height": 32, "seed": 1337 },
  "briefing": { "title": "FIRST LIGHT", "story": ["..."], "objectives": ["Destroy the Emberhand watch-post"] },
  "debrief":  { "win": ["..."], "lose": ["..."] },
  "fields":  [ { "tx": 18, "ty": 16, "w": 3, "h": 3, "density": 800 } ],
  "player":  { "credits": 600, "buildings": [ { "type": "construction_yard", "tx": 14, "ty": 16 }, ... ],
               "units": [ { "type": "infantry", "tx": 15, "ty": 18 } ] },
  "enemies": [ { "team": "enemy", "ai": { "assaultValue": 500, ... }, "credits": 400,
                "buildings": [...], "units": [...], "fields": [...] } ],
  "objectives": [ { "type": "destroy", "target": { "faction": "barracks", "team": "enemy" }, "primary": true,
                    "text": "Destroy the Emberhand watch-post" } ],
  "failure":    [ { "type": "lose_all_producers", "team": "player" } ],
  "next": "m2_lifeblood"
}
```
The **default skirmish** becomes a mission file too (`skirmish.json`) that reproduces today's seeding —
proving the format can express the current game.

### 4.2 Mission loader — parameterize `bootstrap()`
Today `bootstrap()` in `main.ts` hardcodes the seeding. Refactor it to **seed from a mission object**
(units/buildings/fields/credits/AI per side). `bootstrap(mission = SKIRMISH)` — skirmish is the default, so
the live game is unchanged. Seeding helpers already exist inline; this lifts them into a
`seedFromMission(state, mission)`.

### 4.3 Objective system — `src/sim/systems/objectives.ts` (generalizes `victory.ts`)
A sim-pure system that each tick evaluates the mission's objective + failure list against state and exposes
`{ objectives: [{text, complete}], won, lost }`. `victory.ts`'s "destroy all" becomes the `eliminate`
objective as a special case; skirmish uses exactly that, so its behavior is preserved. The view reads the
status for the objective tracker + win/lose screen. **Deterministic**, no DOM.

### 4.4 Campaign flow + UI (view layer)
- **Title menu:** Campaign · Skirmish · (later) Options. New view state before the sim starts.
- **Mission select / linear unlock:** progress saved in `localStorage` (`campaignProgress`).
- **Briefing → play → debrief → next:** extend the existing `onboarding.ts` overlay (it already does a
  briefing + objective tracker) into per-mission briefing/debrief screens; the objective banner reads the
  §4.3 status live.

---

## 5. Objective system detail (the heart of "missions feel different")

Each objective/failure is `{ type, ...params, primary?, text }`. Evaluated per tick:

| Type | Params | Complete/fires when |
|---|---|---|
| `destroy` | `target: {team, faction?}` | all matching entities are gone |
| `eliminate` | `team` | that team has no combat units **and** no producers (today's victory rule) |
| `defend` | `target: {team, faction?}` | *(failure)* the matched entity is destroyed |
| `survive` | `seconds` | `state.tick ≥ seconds × 20` with HQ alive |
| `hold` | `region:{tx,ty,r}, team, seconds` | team has had a unit in-region continuously for N s |
| `accumulate` | `team, credits` | team's banked credits ≥ C |
| `build` | `team, faction` | team owns ≥1 of that structure |
| `reach` | `team, region` | a team unit entered the region |
| `lose_all_producers` | `team` | *(failure)* team has no producers + no combat units |

Win = every `primary` objective complete. Lose = any `failure` fires. Determinism: all reads off sim state
+ `state.tick`; region checks use world distance; no wall-clock.

---

## 6. Phased rollout (ship Mission 1 first; each phase verified + deployable)

- **CP-1 — "The Framework + Mission 1" (first ship).** Mission loader (bootstrap-from-data) + objective
  system (`destroy`/`eliminate`/`lose_all_producers`) + a **Campaign** menu entry + **Mission 1 "First
  Light"** playable end-to-end (briefing → objective → win/lose → back to menu). Skirmish preserved as the
  default mission. *Gates:* unit — objective system completes/fails correctly; skirmish mission reproduces
  today's win rule. Liveness — start Campaign → Mission 1 loads, briefing shows, killing the target wins.
- **CP-2 — "A real arc" (objectives + save).** Add `survive`/`accumulate`/`defend`/`build` + **Missions
  2–3** + `localStorage` progression + mission select + a debrief screen.
- **CP-3 — "Mid-arc."** `hold`/`reach` + **Missions 4–5** (lean on v0.25/v0.27 mechanics as they land) +
  secondary objectives + difficulty.
- **CP-4 — "Finale + hazard."** **Mission 6** (+ optional 7), Shardstorm/Riftmaw hazard, narrative
  briefing/debrief polish, credits screen.

Mission *content* for 5+ leans on economy-roadmap mechanics; sequence the campaign phases just behind the
matching economy phases so each mission has its mechanic to teach.

---

## 7. Verification & scope discipline

Every phase: `pnpm run verify` + `pnpm run test:live` green; ≥1 gate per new objective type and for the
campaign flow. All mission content in `data/missions/*.json` (authorable without touching logic). The engine
(loader + objective system) is story-agnostic and ships first; story content lands mission-by-mission.
**Art:** briefings are text-first (matches today's onboarding) — no new art blocks Mission 1; optional
briefing portraits/backdrops are a later polish (Grok pipeline).

---

## 8. Open questions for reviewers

1. **Story tone** — is the "order vs plunder, and the planet fights back" spine right, or do you want
   straight heroic (Concord = unambiguous good) or a different premise entirely?
2. **Faction names** — Meridian Concord / Emberhand / Sera Vane / Warden / Marshal Thane Corr — keep, or
   rename? (Easy to swap; they're just strings.)
3. **Player faction across the arc** — always the Concord (recommended for v1), or a second playable
   Emberhand campaign later (C&C-style two-campaign structure)?
4. **Arc length** — 6 missions + optional finale, or trim to a tight 5?
5. **Briefing style** — text panels (lean, ship now) vs later portrait/backdrop art vs (much later)
   animated/voiced. Recommend text-first now.
6. **Mission 1 objective** — simple "destroy the watch-post" to teach controls, or fold in a scripted
   reinforcement beat for flavor?
7. **Branching (M7)** — a real branch/choice, or a linear finale for v1 with the choice as a sequel hook?

---

## 9. Relationship to the economy roadmap

The campaign and the economy overhaul are **mutually reinforcing**, not competing:
- Economy phases ship the *mechanics*; campaign missions ship the *teaching + context* for them.
- Recommend interleaving: economy phase N → the campaign mission that showcases it. (M2↔v0.24 economy is
  already possible today; M3 waits on turrets, M4 on the split-field map, M5 on vehicles.)
- CP-1 (framework + Mission 1) needs **none** of the unbuilt economy mechanics — it can start now, in
  parallel, on the current build.

---

## 10. Review round 2 (panel) — verified outcomes & revised plan

Two panel reviews received and **adversarially verified** (not rubber-stamped). Dispositions:

**Adopted into CP-1 (cheap, foundational, prevents rework):**
- **Stable `id`** on every objective and every mission-authored entity (needed for triggers, rewards,
  debrief refs, tests, save).
- **Rename objective target param `faction` → `kind`** — in the ECS the inner `faction` field holds the
  *type* string (`'barracks'`), which is confusing, and `type` would collide with the objective's own
  discriminator. So `target: { team, kind? }`. (Update `objectives.ts` + its tests.)
- **Rename failure `lose_all_producers` → `eliminated`** (clearer; it's the skirmish-defeat rule).
- **`validate:missions` CI gate** — unique ids, valid `next` chain, legal entity types, in-bounds spawns,
  a `destroy` target that matches ≥1 entity at start (unless `allowEmpty`), skirmish loads. High value:
  same class of "one bad data file reds the whole build" the deploy pipeline already fears.
- **Save keyed by mission id + versioned:** `{ version, completed[], unlocked[], medals{} }` (survives
  reordering missions).
- **Reserve (unused) schema fields now** so the format doesn't churn later: `triggers[]`, entity `tags[]`,
  `secondaryObjectives[]`, `rewards[]`.

**Adopted for CP-2+ (needs the trigger system to exist first):**
- **Minimal deterministic trigger system** (`src/sim/systems/missionTriggers.ts`, kept separate from
  objective evaluation): actions `message` / `spawn` / `reveal` / `grantCredits`; conditions read sim +
  mission state only (no wall-clock, no DOM).
- **Secondary objectives + small rewards** (+next-mission credits/units) — makes optional objectives matter.
- **New objective types as needed:** `protect_count` (≥N of a group survive), `escort` (compose from
  `reach` + `defend`, not a new primitive), **contested `hold`** (timer *pauses* while an enemy unit shares
  the region).
- **Per-mission mid-mission complications:** M2 raider warning @50% quota, M3 escalating labelled waves,
  M4 over-harvest foreshadows a Riftmaw, M6 post-stronghold Riftmaw survival turn. All are trigger-driven.

**Declined / simplified (adversarial pushback):**
- **"Evaluate objectives once/second"** — *keep per-tick.* At this entity scale the cost is negligible, and
  the `hold` counter is defined per-tick; sub-sampling would complicate determinism for no measurable gain.
  Revisit only if profiling proves otherwise.
- **`escort` as a brand-new primitive** — compose from `reach` + `defend` instead.
- **Authored terrain (`layout_mask`)** — reserve the schema field; implement only when M3/M4 need real
  chokepoints (M1 is open desert). Not a CP-1 blocker.

**Narrative enrichments folded into §1 (the bible):**
- **Strengthen the Concord's rationale** — they extract because the Reach may *collapse* without Shard, not
  from greed. The campaign question sharpens to *"is survival elsewhere worth ecological death here?"* —
  stronger than "empire bad, rebels good," and it keeps the Concord (you) sympathetic longer.
- **Give Sera Vane early presence** — intercepted comms / battlefield taunts / debrief quotes from M1
  onward (cheap: just text). e.g. *"You call it extraction. The planet calls it bloodletting."*
- **Marshal Corr = competent but ideologically blind foil**, not a cartoon villain.
- **New mission-design rule (see §3.1):** every mission carries 1 core mechanic + 1 narrative pressure +
  1 mid-mission complication + 1 secondary objective + 1 clear failure + 1 debrief consequence.

**§8 answers — LOCKED:** shaded tone ✓ · keep faction names (optional Corr first-name swap left to operator)
· Concord-only for v1 ✓ · 6 missions + optional 7 ✓ · text-first briefings ✓ · **linear M7** ✓ ·
**Q6 (the one review conflict): Mission 1 ships SIMPLE in CP-1 (destroy the watch-post, no scripted beat —
the beat needs the trigger system); the reinforcement beat is ADDED in CP-2 once triggers land.** This
resolves the text-vs-HTML disagreement by sequencing rather than choosing.

## 3.1 Mission-design rules (added per review)
Every mission must carry: **(1)** one core mechanic lesson, **(2)** one narrative pressure (why it's
*urgent*, not "learn harvesters" but "fuel the fleet before the raiders arrive"), **(3)** one mid-mission
complication (trigger-driven), **(4)** one optional secondary objective with a small reward, **(5)** one
clear failure condition, **(6)** one debrief consequence (even if only narrative). This turns the arc from
a tutorial list into an authored campaign.

## Appendix A — code seams (where each piece plugs in)
- `src/main.ts` `bootstrap()` → refactor to `bootstrap(mission)` + `seedFromMission()`; skirmish = default.
- `src/sim/systems/victory.ts` → generalized by `src/sim/systems/objectives.ts` (`eliminate` = today's rule).
- `src/view/onboarding.ts` → per-mission briefing/debrief + live objective banner from the objective system.
- **New:** `data/missions/*.json`, `src/loaders/missions.ts`, `src/sim/systems/objectives.ts`, a title/menu
  view state, `localStorage` campaign progress.
