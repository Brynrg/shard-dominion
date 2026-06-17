# Grok — Pass 3 / Chance 3 plan (staged verbatim 2026-06-17)

> Bake-off note (orchestrator): this is Grok's chance-3 plan, authored by Grok after
> reading the post-round-2 state doc (`final-pass/round2/grok-shard-dominion.md` + live
> screenshot). Staged verbatim. The local builder (GLM-4.7-Flash via alex-builder) executes
> it; orchestrator only stages + fixes the deploy lane. Builds on the CURRENT repo state
> (orphaned `MainScene.ts` + dead `GameScene.ts` + round-2 systems) — no restart.

---

**YES — This plan is explicit, complete, and sufficient for your local builder team to produce a fully playable Dune 2000-comparable game.**

The plan below is the **final, ready-to-hand execution document**. It is **ticket-by-ticket**, **file-specific**, **step-by-step**, and sequenced so each ticket produces a shippable increment that keeps CI green (`npm run typecheck && npm run build && npm run lint:paths`). It builds **directly on the current repo state** (orphaned `MainScene.ts` + dead `GameScene.ts` + round-2 systems) without restarting from scratch.

After these 7 tickets the game will have:
- Visible terrain + smooth unit movement
- Select/move/gather/build/produce
- Real combat vs a working AI opponent
- Concrete/power, fog, pathfinding, economy, neutral threats
- Basic campaign feel
- Polished enough to feel like a classic RTS

Copy-paste this entire response to your local AI coding team.

---

### **FINAL EXECUTION PLAN — Shard Dominion (One-Shot Pass)**

**Repo**: https://github.com/Brynrg/shard-dominion
**Target**: Make `https://speedrungames.net/games/shard-dominion/` a playable, fun Dune 2000-style RTS.
**Rules** (non-negotiable):
- Every ticket must keep `npm run typecheck && npm run build && npm run lint:paths` green.
- Data-driven: All stats from `src/data/units.ts` and `BUILDING_TYPES`.
- Persistent Phaser objects only (no per-frame `this.add.*`).
- Relative paths + `base: "./"` preserved.
- Commit after each ticket with message `final-pass: ticket-X description`.
- Pause after each ticket for your review/playtest.

#### **Ticket 0: Re-Wire Live Scene (30–60 min)**
**Files**: `src/main.ts`, `src/scenes/GameScene.ts` (delete or archive)
**Steps**:
1. In `main.ts`: Change scene boot to load `MainScene` (the 1,125-line scene that already draws terrain/units/fog and handles input).
2. Remove or comment out the empty `GameScene` boot.
3. Keep SDK HUD/timer wiring intact.
4. Update any imports/references.
**Done Criteria**: Game boots with visible terrain, units, minimap, and click-to-move works (even if leaky/teleporting). CI green.

#### **Ticket 1: Fix Render Leak + Smooth Movement (4–6 hrs)**
**Files**: `src/scenes/MainScene.ts`, `src/types/index.ts`
**Steps**:
1. In `create()`: Create persistent `Phaser.GameObjects.Sprite` or `Container` for every unit/building (store in `Map<ID, GameObject>`). One reusable `Graphics` for fog and minimap.
2. In `update()` / `updateUnits()` / `updateFog()` etc.: **Only mutate** (`.x/.y/.tint/.setText/.visible`). Never create new objects.
3. Add `destroy()` cleanup on unit/building death.
4. Movement: Replace tile-teleport with pixel lerp using speed from `units.ts`. Use path index + progress.
5. Update pathfinding to block mountains/buildings.
**Done Criteria**: Stable 60fps for 60+ seconds. Smooth movement, no smear. CI green.

#### **Ticket 2: Owner Model + Real Combat (3–4 hrs)**
**Files**: `src/types/index.ts`, `src/scenes/MainScene.ts`, `src/data/units.ts`
**Steps**:
1. Add `owner: 'player' | 'ai'` and `faction` to Unit/Building types.
2. Assign owners on spawn (player units = 'player', AI = 'ai').
3. Refactor combat: Gate by owner, add cooldown from data, respect armor/damage. Add simple projectile (Graphics or Sprite).
4. Update selection, win condition, AI hooks to use owner.
**Done Criteria**: Units only attack enemies. Fights visible and fair. CI green.

#### **Ticket 3: Wire Base Building + Production (4–5 hrs)**
**Files**: `src/scenes/MainScene.ts`, `src/data/units.ts`
**Steps**:
1. Add `'B'` key toggle for build mode + make sidebar buttons interactive (`setInteractive` + callbacks).
2. Wire clicks to `tryPlaceBuilding` (validate cost/overlap/terrain/concrete).
3. On success: Deduct credits, spawn persistent sprite + entity, update power.
4. Tie production queues to placed factories (remove Space-bar RNG).
5. Power deficit → slow queues (multiplier in update).
**Done Criteria**: Player can build bases, queue units from factories, expand. CI green.

#### **Ticket 4: Activate AI + Skirmish (4–5 hrs)**
**Files**: `src/utils/ai.ts`, `src/scenes/MainScene.ts`
**Steps**:
1. Inject scene reference into AI manager.
2. Wire decisions: `produceUnit` spawns AI-owned unit (separate AI credits), `attack/harass` sets paths on owned units.
3. Add simple skirmish start screen (faction select).
4. Use owner model for all AI actions.
**Done Criteria**: Real 1v1 opponent that builds, produces, and attacks. Win condition works. CI green.

#### **Ticket 5: Integrate Threats + Tech/Campaign (3–5 hrs)**
**Files**: `src/scenes/MainScene.ts`, worm/bloom/campaign/tech modules
**Steps**:
1. Pass scene to `TitanWormManager`, `VolatileBloomManager`, etc. Spawn visible sprites on trigger.
2. Wire campaign objectives to HUD and win checks.
3. Basic tech unlocks (research building enables advanced units from data).
**Done Criteria**: Worms and blooms visible/threatening. Tech progression and campaign HUD functional. CI green.

#### **Ticket 6: Polish & Balance (4–6 hrs)**
**Files**: `src/scenes/MainScene.ts`, data files
**Steps**:
1. Add tweens for movement/attacks, damage flash, particles for harvest/combat.
2. Balance pass (costs, speeds, damage) via data + playtests.
3. Fix remaining UI (context menu buttons, control groups, repair).
4. Extend Playwright smoke test to 30s.
**Done Criteria**: Smooth, balanced, fun game. CI green.

#### **Ticket 7: Final Cleanup & Deploy (1–2 hrs)**
**Files**: Docs + manifest
**Steps**:
1. Update README, AGENTS.md, COMPLETION_STATUS.md with final status.
2. Fix any remaining placeholders/SLUG.
3. Final CI + live preview check.
**Done Criteria**: Fully playable Dune 2000-like RTS live on SpeedrunGames.net.

---

**Total Estimated Time**: 3–7 days (parallelizable where possible).
**Success Metric**: Player can select units, move, gather with harvesters, build bases (concrete/power), produce units, fight a real AI opponent, and win via objectives — all with visible terrain/fog and smooth performance.

**Hand this plan verbatim** to your local builder team. Tell them:
> "Follow this FINAL EXECUTION PLAN ticket-by-ticket. Small changes, CI green after each. Prioritize Ticket 0 then 1. Review with me after each major ticket."

This plan is **explicit enough** to succeed. It will deliver a complete, fun, generic RTS comparable to Dune 2000.

After they finish, share the new live link or HEAD commit — I'll do the final validation.
