# Shard Dominion — Economy, Pacing & Strategic-Depth RFC

> **Status:** DECISIONS LOCKED (panel-reviewed) · BUILDING v0.24.0
> **Target:** v0.24.0–v0.27.0 · **Date:** 2026-07-07
> **Author:** Claude (Opus 4.8), with operator play-feedback + an adversarial design-panel review
> **Scope:** economy, AI behaviour, map control, production, defence, match pacing, comeback potential.
> **Primary target:** a readable **8–14 minute** RTS match with distinct opening → expansion → mid-game
> → endgame phases, played in a browser on a games portal.

---

## 0. Review outcome & locked decisions (2026-07-07)

This RFC was reviewed by a design panel. The panel's high-value ideas were adopted; its heavier systems
were **parked behind proof-of-need gates** (Appendix B) to protect the ship-a-slice-per-deploy cadence.
Decisions the operator locked:

| Decision | Choice | Note |
|---|---|---|
| **Anti-snowball model** | **Expansion + saturation (primary) + power as a soft secondary brake** | C&C-authentic; no WC3 upkeep. |
| **Free harvester with constructed Refinery** | **DE-BUNDLED** — built refineries ship no harvester | keeps the army-vs-economy decision sharp. |
| **Match-length target** | **8–14 min** (fail if routinely >18) | fits the web-portal venue. |
| **AI depth (v0.24)** | **Full goal-driven FSM** | framework ships now; *map-control states activate in v0.25* (see §5 E1). |
| **Field model** | **Permanent depletion + split fields** (2 flank + 1 center) | Shard Blooms parked (Appendix B). |
| **Player vehicles** | **Yes, via a War Factory** (not the Refinery); reuse the existing `vehicle` unit first | v0.27. |

---

## 1. Executive summary

Operator play-feedback on v0.22–0.23: the economy feels **too fast/shallow**, matches **end too quickly**,
and the **AI is too weak**. The code audit (§2) confirms one root cause: the economy is a **fixed
allowance, not a strategic system** — income can't scale, the AI has no economy, the map has no economic
geography, and bases can't defend or progress.

This RFC converts the game into a compact, **C&C-authentic territorial economy**: finite Shard fields,
multiple expansion routes, buildable refineries, explicit harvester/dock saturation, exposed logistics,
powered structures, phased unit production, a **goal-driven AI economy**, and light base-defence — drawn
from the proven designs of C&C/Red Alert, Dune 2000, Warcraft III, StarCraft and Age of Empires (§4).
Changes are **additive** (new components/structures/fields), contract-safe, **data-tunable**, and shipped
in isolated **verified phases** (§8).

Intended match flow: **opening** (produce, scout, pick pressure vs economy) → **expansion** (flank field,
contest centre, or raid enemy logistics) → **mid-game** (combined arms, multiple economic sites, exposed
logistics, limited defences) → **endgame** (outer fields expire, conflict concentrates, fortified
positions must be deliberately broken).

---

## 2. Current-state audit (what the code actually does)

From `data/{units,structures,economyConstants,weapons}.json`, `src/main.ts`, and
`src/sim/systems/{harvest,production,ai,damage}.ts` at commit `08a0bcf` (v0.23.0).

### 2.1 Player economy
- Correct C&C foundation: one resource (Shard) → harvester → Refinery → one credit pool. ✅
- **Income is dock-throughput-capped, not harvest-capped.** `harvestRate 25/tick` (≈500 cargo/s) fills the
  **700 cargo** in ~1.4 s; the real bottleneck is unloading — `dockRate 100 cr/s` through **one dock slot
  per refinery**. **Ceiling ≈ 100 cr/s/refinery**, ~40–50 cr/s with travel.
- **Income can't scale** — the Refinery isn't buildable; with one dock slot, extra harvesters barely help.
- **One finite field, no expansion** — home field 9×800 = 7,200, depletes, **no regrowth**, no second
  field. Income eventually stops with nowhere to go.
- **No brakes** — no supply cap, no upkeep; the 2,000 storage cap rarely bites.

### 2.2 The AI economy — **there isn't one**
- Enemy Refinery holds a **static 600 cr, no harvester, no income** → builds **~6 infantry ever**, then
  bankrupt. Infantry-only, waves of 2 (`armySize: 2`). **This — bankruptcy, not tactics — is why it's
  trivial.**

### 2.3 Combat / pacing
- vs BUILDING armour: rifle (BULLET) ×0.2 = 1.6 dmg/shot; rocket (ROCKET) ×0.5 = 10 dmg/shot (~6.25/s).
  Refinery 1,500 HP / ConYard 2,000 HP → a few rockets end a base in ~30–60 s. The problem isn't TTK — it's
  that you reach the base **unopposed**: no defences, no player vehicles, no economic raids, no mid-game.

### 2.4 Diagnosis
"Too fast" = a shallow ~100 cr/s allowance with **no decisions**. "Too short" = **no economic phases** +
bankrupt AI + undefendable bases. "AI too weak" = **the AI has no economy.**

---

## 3. Design goals

**Goals:** (1) preserve C&C/RA identity; (2) make map control economically valuable; (3) ≥3 viable
openings; (4) distinct match phases; (5) AI uses the *same* economy/production rules as the player; (6)
both sides can raid/defend/expand/recover; (7) one won skirmish shouldn't auto-decide the match; (8)
balance stays in `data/*.json`; (9) sim stays deterministic & pure; (10) ship isolated verified phases.

**Non-goals (this cycle):** a second resource; WC3 upkeep; a large tech tree; heroes; random loot; infinite
regrowth; heavy worker micro; a hard pop cap; a big defensive-structure set.

---

## 4. Research digest — the proven levers (condensed)

| Lever | Effect | Source |
|---|---|---|
| Expansion pressure (deplete; richer fields elsewhere) | map control = income | StarCraft, C&C, AoE |
| Scalable income via structures (more refineries) | income = investment curve | C&C, RA |
| Harvester/dock saturation | caps spam, rewards expansion | StarCraft |
| Upkeep tax on army size | hard snowball brake | WC3 *(not adopted)* |
| Harvester vulnerability | economic warfare | C&C, Dune, SC |
| Storage cap + overflow loss | punishes hoarding | Dune, C&C silos |
| Capturable/passive income | fight over the map | RA2 *(parked)* |
| Finite premium / late convergence | economic phases, anti-stalemate | AoE, (our Shard Bloom — parked) |
| Tanky bases / defence | matches last; defender holds | AoE, WC3 |
| Power as infrastructure | attackable soft constraint | C&C |

---

## 5. Map economy layout (locked: split fields, permanent depletion)

A single central jackpot creates a binary winner-take-all match. Standard map = **four field roles**:

- **Home fields (one per base):** ~**8×650 = 5,200**. Fund the opening + one early decision; last ~4–5 min
  solo; don't force an immediate centre rush.
- **Safe flank expansions (one per side, on your natural side):** ~**6×650 = 3,900**. Easier to defend,
  less valuable than centre, far enough that a nearby refinery matters, raidable from ≥2 approaches. The
  **recovery/comeback** route.
- **Contested centre:** ~**10×800 = 8,000**. Shortest aggregate distance, open lanes, poor turret cover,
  high reward, hard to hold without an army. The focal battlefield.
- **Late-game convergence:** **PARKED** (Appendix B) — deterministic Shard Bloom, only if playtests show
  fields deplete into stalemate. **Ship permanent depletion first.**

`shardDensity` must go into `stateHash` (a known determinism gap) as part of this work.

---

## 6. Economy & AI mechanics (E1–E10)

Each: **what · why · proposed values (v0, data-tunable) · implementation · risk.**

### E1 — Goal-driven AI economy *(v0.24 headline; the root fix for "AI too weak")*
- **What:** the AI plays the same economy — its own **harvester + home field + funded production**, can
  **replace a lost harvester**, and runs a **goal-driven FSM** that evaluates board state on a deterministic
  interval and picks a plan, with **reactive composition** (counters what it observes).
- **States:** `Stabilize` (replace harvester / defend base / rebuild production), `Develop` (add
  production/power, save toward tech, improve mix), `Pressure` (hit exposed units, deny expansion, avoid
  full commitment), `Raid` (target harvesters/power/undefended production, then retreat), `Assault`
  (assemble an **army-value** threshold, pick a base objective, commit + reinforce), `Recover` (preserve
  army, take a safe field, rebuild), and **`Expand`** (claim a field, escort, build a refinery).
- **⚠️ Sequencing:** the FSM *framework* + `Stabilize/Develop/Pressure/Raid/Assault/Recover` + reactive
  composition + retreat ship in **v0.24**. **`Expand` and centre-contest are latent until v0.25** provides
  fields + buildable refineries + AI construction — there is no map to control yet. This is explicit, not a
  gap.
- **Composition (target bands, not fixed %):** 40–60% rifle, 20–35% rocket, 10–30% vehicle; shift toward
  vehicles vs massed rifle, toward rockets vs vehicles/turrets, toward a fast raid vs a greedy expand.
- **Attack triggers (replace "armySize+1 every 3 waves"):** army-value threshold **or** an exposed player
  expansion / recently-wiped player army / low-power player / contested centre.
- **No hidden income.** The AI never gets unexplained recurring credits; difficulty changes *behaviour*
  (decision interval, reserve size, retreat threshold, counter quality), not income.
- **Implementation:** enemy harvester + field seeded in `main.ts`; rewrite `ai.ts` into an FSM (sim-pure,
  deterministic — throttle evaluation by a tick counter, no `Math.random`; vary any tie-breaks by entity
  id/tick). `combat`-driven units already march via the existing systems.
- **Risk:** over-strong AI → bands/thresholds in `data`; a **"player can still win with good play"**
  liveness gate; cap escalation. Full **fog-limited knowledge + scouting memory** is **parked** (App. B) —
  v0.24 reads board state directly; fairness comes from behaviour limits, not omniscient exploitation.

### E2 — Map economy: split fields + permanent depletion *(v0.25; fixes "too fast" + "too short")*
- **What:** the §5 layout — home + two flanks + contested centre, all **finite, no regrowth**.
- **Why:** the shared DNA of the best economies; attention-splitting + a real comeback route (raid the far
  side) instead of one binary fight.
- **Values:** §5 / §7. **Implementation:** field seeding in `main.ts`; harvester already re-seeks the
  densest reachable tile. **Risk:** centre a coinflip → tune distance/size; flanks provide recovery.

### E3 — Buildable Refinery, **de-bundled** *(v0.25; adds the income decision)*
- **What:** Refinery becomes buildable — **+1 dock slot, +storage, NO free harvester** (buy harvesters
  separately). The **starting** refinery keeps its initial harvester; constructed ones don't.
- **Why:** income = investment curve (C&C/RA), and de-bundling (operator decision) keeps "army now vs
  economy later" sharp.
- **Values:** **1,200 cr / 35 s / 1,500 HP / power −20 / +1 dock / +1,500 storage / no harvester.**
- **Implementation:** add `refinery` to `structures.json` + build menu + placement (reuses the barracks
  path); on placement attach `economy` + `production` (harvesters). **Risk:** refinery spam → bounded by
  finite fields (a refinery is useless without an adjacent field) + one dock (E4).

### E4 — Harvester/dock saturation *(v0.25; caps "too fast")*
- **What:** one dock/refinery; a 2nd harvester on one refinery gives sharply diminishing returns. Surface
  it: HUD shows **active harvesters / occupied docks / waiting / recent income rate / field remaining**.
- **Target throughput:** 1H/1R ≈ 65–75 cr/s; 2H/1R ≈ 80–90; 2H/2R ≈ 130–150; extra H w/o docks ≈ 0.
- **Implementation:** enforced in `harvest.ts`; add HUD readout + a unit test (2nd harvester ≈ no gain).

### E5 — Economy tuning *(v0.24; the cheap, high-impact dials)*
- start credits **700 → 600**; `dockRate` **100 → 80**; cargo **700 → 600**; **harvest fill ~5–7 s**
  (lower `harvestRate` so mining is *visible* — enables raids, congestion, anticipation); full-load unload
  ~7.5 s; round-trip ~18–28 s by distance; harvester **400/8 s → 450/12 s**.
- **Why:** 100 cr/s is huge vs 100-cr infantry; instant harvest hides the economy. Slower + legible + a bit
  tighter creates real tempo. **Implementation:** `data/economyConstants.json` + `data/units.json` +
  `main.ts`.

### E6 — Harvester survival: flee + emergency recovery *(v0.24; anti-elimination)*
- **What:** a damaged harvester **routes to the nearest Refinery/Turret** (flee, not fight). If a team has
  **no harvester and no producing refinery**, its **Construction Yard** can build **one** emergency
  harvester on a long cooldown (not free).
- **Why:** one early raid should hurt, not end the match; rewards smart defensive placement.
- **Implementation:** flee branch in `harvest.ts` (on hp drop vs last tick); emergency rule in
  `production`/`ai`. **Risk:** abuse → long cooldown, only when truly harvester-less.

### E7 — Power as the soft secondary brake *(v0.26; Option-C-lite)*
- **What:** structures produce/consume power; when demand > supply, **partial** penalties — production
  −40%, turret fire −35%, refinery unload −20%, radar off — never a full shutdown.
- **Why:** C&C-authentic, visible, attackable infrastructure; ties economic scale to base layout without an
  abstract tax. **Implementation:** extend the existing `power` system; values in `data`. **Risk:** death
  spiral → penalties are partial; HUD shows "unpowered".

### E8 — Defence Turret + repair *(v0.26; fixes "too short")*
- **What:** one general defensive structure; optional **repair** (drains credits over time, slower under
  fire) before any HP inflation.
- **Values:** Turret **550 / 18 s / 500 HP / power −15 / range 5 / dmg 12 / cd 0.8** — strong vs infantry,
  weak vs tanks, fires slower when under-powered.
- **Implementation:** add `defense_turret` to `structures.json` + build menu; give the placed building a
  `combat` component so existing `combatTargeting`+`damage` drive it (no new combat code). **Risk:**
  turtling → modest range/DPS + power dependence + anti-armour weakness.

### E9 — Player vehicles via a War Factory *(v0.27; parity + combined arms)*
- **What:** a **War Factory** produces the player's vehicles (reuse the existing `vehicle` unit first; add a
  heavier tank later). The Refinery must **not** make combat vehicles.
- **Values:** War Factory **1,000 / 35 s / 1,300 HP / power −30 / requires Power Node**; Scout Vehicle reuse
  (~350 / 10 s / 80 HP). Counter-triangle: rifle > exposed rocket; rocket > vehicle; vehicle > unsupported
  rifle; turret delays light but loses to rocket/tank.
- **Implementation:** add `war_factory` structure + route `vehicle` train to it (the E3/refinery routing
  pattern generalises). **Risk:** vehicles invalidate infantry → explicit counters + staged rollout.

### E10 — Economy telemetry *(v0.24; makes tuning measurable)*
- **What:** per-team `__debugEconomy` snapshot — credits, storage, income over last 10/30/60 s, Shard
  remaining under control, active/idle harvesters, dock waits, #refineries, power, army value, first-
  expansion/first-vehicle/first-attack/match-end times.
- **Why:** turns "too fast/slow" into numbers; drives the balance-acceptance criteria (§13).
- **Implementation:** a lightweight sampler in `main.ts` debug hooks (start minimal: credits + income-rate
  + idle-harvester + field-remaining; expand as phases add systems).

---

## 7. Proposed values (v0 — locked defaults, tune via telemetry)

| Parameter | Current | Locked v0 | Phase |
|---|---|---:|:--:|
| Starting credits | 700 | **600** | v0.24 |
| `dockRate` (income ceiling/dock) | 100 cr/s | **80** | v0.24 |
| Cargo capacity | 700 | **600** | v0.24 |
| Harvest fill time | ~1.4 s | **~5–7 s** (lower `harvestRate`) | v0.24 |
| Harvester | 400 / 8 s | **450 / 12 s** | v0.24 |
| Enemy economy | static 600 cr | **harvester + home field (real income)** | v0.24 |
| Home field (each) | 9×800 = 7,200 | **8×650 = 5,200** | v0.25 |
| Safe flank field (each) | — | **6×650 = 3,900** | v0.25 |
| Contested centre | — | **10×800 = 8,000** | v0.25 |
| Dock slots / refinery | 1 | **1** | — |
| Constructed Refinery | not buildable | **1,200 / 35 s / 1,500 HP / +dock / +1,500 store / no harvester** | v0.25 |
| Power penalties | none | **partial (prod −40 / turret −35 / unload −20)** | v0.26 |
| Defence Turret | — | **550 / 18 s / 500 HP / range 5 / dmg 12 / cd 0.8** | v0.26 |
| War Factory | — | **1,000 / 35 s / 1,300 HP / req Power** | v0.27 |
| Player vehicle | enemy-only | **buildable (reuse `vehicle`, ~350/10 s/80 HP)** | v0.27 |
| AI | armySize 2, infantry-only | **goal-driven FSM + reactive bands** | v0.24 |
| Match-length target | unspecified | **8–14 min** (fail if routinely >18) | — |

---

## 8. Rollout plan (each phase = one verified deploy)

**v0.24.0 — "The Opponent."** E1 (AI economy + goal-driven FSM framework: Stabilize/Develop/Pressure/
Raid/Assault/Recover + reactive composition + retreat; Expand latent) · E5 (economy tuning) · E6 (harvester
flee + emergency recovery) · E10 (telemetry) · `shardDensity`→`stateHash`.
*Gates:* unit — AI harvests real income, replaces a lost harvester, stays active ≥10 sim-min, no hidden
credits, deterministic; FSM picks states from board state; composition reacts to player mix. Liveness — AI
mounts ≥2 escalating funded attacks and can dent the player base; **player can still win**; a damaged
harvester flees.

**v0.25.0 — "The Map."** E2 (split fields, permanent depletion) · E3 (buildable de-bundled Refinery) · E4
(dock saturation + HUD) · AI `Expand`/centre-contest activate.
*Gates:* unit — 2nd harvester/1 refinery ≈ no gain; 2nd refinery scales throughput; field depletes,
harvester re-seeks; refinery destruction removes its dock/storage. Liveness — player picks flank vs centre;
AI expands to a field; losing the centre isn't instantly fatal.

**v0.26.0 — "Mid-Game."** E7 (power penalties) · E8 (Turret + repair) · AI attacks power/turrets.
*Gates:* unit — low power slows prod/unload/turret; repair drains credits; turret targets in range; rockets
beat an unsupported turret. Liveness — one turret delays a small raid; turrets alone don't stop a composed
assault; killing power opens a window.

**v0.27.0 — "Combined Arms."** E9 (War Factory + player vehicle) · AI vehicle composition + counters.
*Gates:* unit — counters land in target bands; AI shifts composition to observed army; vehicles can retreat/
survive. Liveness — rifle-only loses to supported vehicles; rocket-supported infantry stop vehicles; a raid
damages economy without auto-ending the match.

**Parked (proof-of-need):** Appendix B.

---

## 9. Verification & tuning

Every phase: `pnpm run verify` (typecheck+lint+unit) **and** `pnpm run test:live` (Playwright) green before
deploy; ≥1 new gate per mechanic. Balance in `data/*.json`. Operator playtest after each deploy. Telemetry
(E10) makes "too fast/slow" measurable — see §13.

---

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Centre still decides every match | flank fields + finite centre; comeback via raid/flank |
| Refinery spam runaway income | de-bundled harvester + power cost + finite fields + one dock |
| Harvester raids feel unfair | flee + emergency recovery + telegraphed raids |
| Turtling from turrets | power dependence + modest range + anti-armour weakness |
| AI predictable / appears to cheat | goal-driven states + opportunity triggers; same economy; no hidden income |
| Power death-spiral | partial penalties, never full shutdown |
| Depletion → stalemate | ship permanent depletion; Shard Bloom parked as the valve if needed |
| Determinism (regrowth/bloom write density) | `shardDensity` in `stateHash` before either ships |
| Scope creep | strict phasing; heavy systems parked (App. B); each phase independently valuable |
| FSM over-scope in v0.24 | Expand/map states deferred to v0.25; fog-limited AI knowledge parked |

---

## 11. Open questions (status)

1. Anti-snowball model — **RESOLVED:** expansion+saturation + power soft-brake.
2. Player vehicles — **RESOLVED:** yes, via War Factory (v0.27).
3. Field regrowth — **RESOLVED:** permanent depletion; Shard Bloom parked.
4. Income ceiling — **RESOLVED (initial):** `dockRate` 80; re-evaluate via telemetry.
5. Starting credits — **RESOLVED:** 600.
6. Match-length target — **RESOLVED:** 8–14 min.
7. Free harvester with refinery — **RESOLVED:** de-bundled.
8. Capturable derrick — **DEFERRED** (Appendix B).
9. *Open:* exact home-field size vs opening tempo (tune in v0.25 via telemetry).
10. *Open:* does v0.24's board-reading AI need fog-limited knowledge, or do behaviour limits suffice? (decide
    after v0.24 playtest.)

---

## 12. Backout

Each phase = one source commit + one tagged bundle + manifest + verified deploy. Backout = redeploy the
prior bundle/manifest, verify by Netlify deploy-state. Balance-only fixes stay in `data/*.json` (tweak +
redeploy, no revert). Source on `Brynrg/shard-dominion`; every phase its own commit.

---

## 13. Balance-acceptance criteria (measured via E10 telemetry)

First balance pass succeeds when: ≥3 viable openings; AI economically active the whole match; one lost
harvester is serious but survivable; one won skirmish doesn't normally decide the game; the centre is
valuable but not mandatory; extra refineries help only with fields+harvesters to feed them; low power is
exploitable but not disabling; turrets delay but don't replace an army; infantry/vehicle counters are
readable; **most competent matches run 8–14 min** with a recognisable mid-game.

---

## Appendix A — current constants (reference)

**Units:** infantry 100/3 s/20 HP/spd 12/rifle · rocket_trooper 200/4 s/20 HP/inf_rocket · harvester
400/8 s/200 HP · vehicle (enemy) 300/6 s/60 HP/scout_gun. **Structures:** conyard 1,000/60 s/2,000 HP ·
barracks 300/20 s/800 HP · power_node 400/30 s/500 HP · refinery (seeded only) 1,500 HP. **Economy:**
harvestRate 25 · cargo 700 · dockRate 100 · storage 2,000 · 1 dock/refinery. **vs BUILDING:** BULLET ×0.2 ·
ROCKET ×0.5 · SHELL ×0.7 · SIEGE ×1.0 · EXPLOSIVE ×1.3. **Start:** ConYard + Refinery(700) + 1 harvester + 2
infantry + field 9×800; enemy Refinery(600, no harvester) + barracks; AI armySize 2 infantry-only.

## Appendix B — parked, with proof-of-need gates

Build only when a playtest shows the trigger:

| Parked item | Build it when… |
|---|---|
| **Shard Bloom** (deterministic late-game field event + warnings) | matches routinely stalemate after fields deplete |
| **Fog-limited AI knowledge + scouting memory** | v0.24's board-reading AI feels like it "cheats" |
| **Assault Tank** (heavy armour) | the reused Scout Vehicle is stable and armies need a frontline |
| **Structure repair beyond the E8 basic** | HP inflation is tempting — repair is the better lever |
| **Silo** (dedicated storage) | storage caps prove to create real decisions |
| **Build-influence / outpost placement rules** | turret/expansion crawling becomes a problem |
| **Capturable neutral derrick** (RA2 passive income) | the harvesting economy is proven and wants a map objective |
| **Hard population/supply cap** | army sizes balloon past what saturation+power restrain |

---

## Appendix C — openings the balance must support

**1 Early pressure:** Barracks → infantry → scout → delay 2nd harvester (initiative; weaker economy).
**2 Economic:** Power → 2nd harvester → save for expansion refinery (stronger mid-game; raid-vulnerable).
**3 Defensive tech:** Power → Barracks → early turret/repair → save for War Factory (safe vehicle
transition; may concede centre). **4 Fast-expand (situational):** minimal army → flank refinery first
(best economy; punishable if scouted). If one of 1–3 is clearly inferior across playtests, tune before
adding systems.
