# Shard Dominion — Grok Follow-Up Build Plan (continue + improve)

> **Orchestrator note (read first — reconciliation with actual repo state):**
> This follow-up was authored by **Grok** reviewing the *pre-build scaffold*, so it
> states "no Phaser integration yet" and "no core RTS systems." That is OUT OF DATE.
> The Hermes first pass already SHIPPED Phases 0–3: Phaser is integrated
> (`src/scenes/MainScene.ts`, `GameScene.ts`), plus terrain (`src/utils/terrain.ts`),
> fog of war (`src/utils/fog.ts`), A* pathfinding (`src/utils/pathfinding.ts`), units
> data (`src/data/`), and types. **Before starting, inspect the current `src/` and
> CONTINUE from where the code actually is — do NOT redo completed systems** (skip the
> Prep "install Phaser" / Phase 0.5 Phaser-bootstrap steps; they're done). The real
> value of this plan is **Phases 4–9** (units & combat → full UI → skirmish AI →
> advanced tech & threats → campaign → polish). Keep strict TS, data-driven configs in
> `src/data/`, ECS architecture, placeholders first, CI green, relative paths only.
> Commit per phase with a clear message. The bake-off `first-pass` git tag already froze
> the comparison snapshot, so this continuation builds beyond it freely.
>
> Everything below this line is Grok's plan, verbatim.

---

**✅ Close Review Complete — Shard Dominion Repo Status**

The repo (`https://github.com/Brynrg/shard-dominion`) is **exactly the right starting point** per the original plan: a clean fork of your SpeedrunGames.net Vite + TS template, with the full BUILD_PLAN.md staged in `docs/`, data scaffolding (`src/data/units.ts` + index), scene structure (`src/scenes/` with GameScene/MainScene stubs), types/utils folders, and agentic docs (AGENTS.md, COMPLETION_STATUS.md, IMPROVEMENT_PLAN.md).

**Current State (as of latest commits):**
- **Phase 0 mostly done** — template wiring, manifest, CI/CD/Netlify-ready, basic data + scene stubs in place.
- No Phaser integration yet (still canvas SDK demo).
- No core RTS systems (terrain, fog, pathfinding, economy, etc.).
- Strict TS, data-driven intent respected.
- Deploy pipeline ready for iterative pushes.

It aligns **very well** with the vision (Aether Prime, asymmetric factions, concrete/power, harvesters, worms, etc.). No IP issues.

### Follow-Up Build Plan to Complete the Full Game

This is an **executable, phase-gated extension** of `docs/BUILD_PLAN.md`. Instruct your local AI stack (Claude Code / URIM) as follows at the start of each phase:

> "Execute the next phase from the Follow-Up Plan below. Use strict TypeScript, data-driven configs in src/data/, entity/component/system architecture. Placeholders first (colored shapes/rects). Pause after milestone for review/playtest. Keep CI green and relative paths only. Commit with clear message referencing phase."

#### **Prep Steps (Do These First)**
1. Add **Phaser 3** (or PixiJS if preferring lighter canvas):
   ```bash
   npm install phaser @types/phaser
   ```
   Update `vite.config.ts` and `src/main.ts` to bootstrap Phaser (replace/replace demo loop with Phaser Game instance).

2. Expand data files:
   - `src/data/buildings.ts`, `factions.ts`, `missions.ts`, `terrain.json`.
   - Use the example structures from the original BUILD_PLAN.md.

3. Asset folder: Create `public/assets/` (or `src/assets/`) for tiles/sprites. Use the `asset_generation_prompts.md` (generate if missing) for Grok Imagine / local tools.

4. Update `game.manifest.json` with final title/description/slug.

#### **Phase 0.5: Phaser Integration & Core Loop (1-2 days)**
- Integrate Phaser into `src/scenes/` (GameScene extends Phaser.Scene).
- Camera (pan/zoom/drag + edge scroll), basic input (click select, right-click orders).
- Entity manager stub (array of GameObjects with components: Position, Health, Faction).
- Milestone: Phaser canvas loads, camera works, placeholder units (rects) selectable and movable with basic vector path.

#### **Phase 1: Terrain, Fog of War, Pathfinding & Movement (2-4 days)**
- Phaser Tilemap (multi-layer: ground, resources, obstacles) with JSON or procedural data. Tile properties (sand/rock/deep-sand, harvestable, walk speed).
- Fog/LOS system: BitmapData or per-tile alpha overlay. Reveal on unit/building radius + line-of-sight.
- A* pathfinding (easystar.js or custom heap-based). Handle static obstacles; periodic replan for dynamics.
- Unit movement: Speed, rotation (tanks), collision resolution.
- Milestone: Multiple units move intelligently on varied terrain; fog reveals as they explore.

#### **Phase 2: Economy — Harvesters, Processors, Credits (2-3 days)**
- Resource nodes (finite/slow-regen shard fields on map).
- Harvester entity: AI to find nearest field → harvest (timed/amount) → path to Processor → unload → credits.
- Processor + Silo buildings: Storage limits, visual feedback.
- UI: Top resource bar (credits, harvester count, income rate).
- Milestone: Autonomous multi-harvester economy running; raiding simulation possible via manual enemy placement.

#### **Phase 3: Base Building — Placement, Concrete, Power, CY (3-4 days)**
- Grid-based building placement (snap + validation: no overlap, terrain ok).
- Foundation Slabs: Place separately or auto-check; incomplete → reduced HP + ongoing degradation (timer drain).
- Power system: Nodes generate; global deficit → queue slowdown, disable radar/defenses.
- Construction Yard + build queues (prereqs, costs, times from data). MCV deployable.
- Milestone: Place full base on concrete, observe power/degradation effects, queue buildings.

#### **Phase 4: Units, Production & Basic Combat (3-5 days)**
- Expand `units.ts` + factories (Barracks, Vehicle Bays).
- Infantry (light/trooper/engineer-capture), vehicles (scouts, faction Combat Tanks), harvesters.
- Combat: Range/damage/armor types, targeting, projectiles or instant.
- Milestone: Produce mixed forces, fight basic counters (infantry vs vehicles visible).

#### **Phase 5: Full UI, Minimap, Orders, Repair, Logistics (3-5 days)**
- Dynamic sidebar (data-driven icons, costs, queues, tooltips) — DOM overlay or Phaser UI.
- Minimap (render texture or graphics with fog blips).
- Orders system: Context menus (move/attack/attack-move/capture/repair), rally points, groups (Ctrl+1-0).
- Repair Pad + Carryall stubs.
- Milestone: Complete skirmish-like loop — build, econ, army, fight, repair.

#### **Phase 6: AI Opponents & Skirmish Mode (4-6 days)**
- Rule-based AI (economy first → scout → harass → tech → attack). Faction personalities via weights.
- Skirmish menu (faction/map selection, difficulty, starting resources).
- Win condition: Destroy all enemy Construction Yards.
- Milestone: Fun, challenging 1v1 vs AI across factions.

#### **Phase 7: Advanced Tech, Asymmetry, Specials & Neutral Threats (4-7 days)**
- Research Lab + Command Nexus tech tree.
- Faction uniques (sonic tank, behemoth, deviator, saboteur) with risks (friendly fire, temp control, self-destruct).
- Carryalls, Starport, support powers.
- Titan Worms + Thumpers, Volatile Blooms.
- Milestone: Full strategic depth and tension.

#### **Phase 8: Campaign & Missions (3-5 days)**
- Data-driven missions with objectives, briefings, scripted events.
- 5-8 escalating missions.
- Milestone: Playable campaign arc.

#### **Phase 9: Polish, Balance, Audio/Visuals & Release (5-10 days)**
- Animations, particles, damaged states, explosions.
- Audio (UI, unit voices, alerts, music).
- Extensive balance passes (data files + playtesting vs AI).
- Performance (pooling, spatial queries), options, save/load, hotkeys.
- Mobile touch support if needed.
- Final deploy to SpeedrunGames.net.

**Total Estimated Effort**: 4-8 weeks of agentic iteration (faster with parallel reviews).

**Risk Mitigations (Add to IMPROVEMENT_PLAN.md)**
- Phase reviews after every milestone.
- Early perf profiling (target 60fps with 100+ units).
- Data-driven everything for balance.
- Placeholders → polished sprites via prompts.
- Test on Netlify preview frequently.

**Next Immediate Action for Your Stack**
> "Implement Phase 0.5: Full Phaser integration and core loop. Then proceed to Phase 1. Reference docs/BUILD_PLAN.md and original conversation visuals/mechanics."
