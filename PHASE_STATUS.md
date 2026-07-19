# Shard Dominion — Phase Completion Status

## Overview
Autonomous multi-phase implementation of OpenRA parity roadmap. Completed Phases 1-2 (1d); ready for Phase 3.

## Completed Work

### Phase 1a: Unit Expansion
- **24 total units** (12 new): Howitzer, Engineer, Transport APC, Defense Drone, Repair Truck, Medium Tank, Super-Heavy Tank, Commando, Laser Trooper
- **2 hero units**: Razor (Emberhand), Tempest (Shardborn)
- Armor class distribution: LIGHT (scout), MEDIUM (standard), HEAVY (tank), AIR (gunship)
- Cost curves prevent any single unit from being "always best"

### Phase 1b: Weapon Diversity
- **8 weapon types**: Howitzer, Laser Rifle, Plasma Charge, Defense Gun, Repair Beam, Demolition Charge, Homing Missile, Twin Laser
- Damage matrices respect armor classes; splash weapons for area control
- Range/cooldown tuning prevents dominant strategies

### Phase 1c: Tech Tree & Research
- **14 refinements** (up from 4): Tier 1–3 progression
- Prerequisite gating: War Factory + Tech Lab required for T2+
- Faction-exclusive techs: Cloaking Field (Emberhand), Crystalline Regeneration (Shardborn)
- Tier 3 synthesis: Quantum Leap (requires T2 chain completion)
- **25 structures** (was 17): Added Armor Center, Elite Barracks, Air Pad, Processing Plant, Ion Cannon, Resonance Device, etc.

### Phase 2: Tactical Depth
- **Threat Matrix**: Turrets (0.7×) > Mobile Units (1.0×) > Harvesters (1.5×)
  - Prevents AI from raiding economy when army should fight
- **Squad-Based AI**: Groups units by type/proximity; veteran leaders coordinate targets
  - Elects squad leader by veterancy rank; squaddies focus-fire on leader's target
  - Runs post-movement-assignment to avoid corrupting idle-fresh filtering
- **Veterancy System Enhanced**:
  - Attacker damage bonus: +15% per rank (existing)
  - Defender armor reduction: -5% per rank (new)
  - Combined: Veterans are noticeably harder to kill + deal more damage

### Phase 1d: Campaign & Maps
- **20 single-player missions** (m1–m20):
  - Acts 1–3: m1–m17 (story progression + faction campaigns)
  - Act 4 Epilogue: m18 (tower defense), m19 (offensive), m20 (finale)
  - Story wraps binding stabilization, Chorus integration, new world order
- **3 multiplayer skirmish templates**:
  - Desert Clash (2P balanced start)
  - Twin Peaks (2P terrain-separated, center control)
  - Four Corners (4P Free-For-All)

## Test Coverage
- **289/301 tests passing** (12 skipped)
- Determinism verified through 600+ ticks (all systems: pathfinding, separation, combat, AI, economy)
- New mission files validated (7 tests in missions.test.ts)
- Data schema compliance: all units, weapons, structures, refinements validate

## Known Limitations & Next Steps

### Phase 3: Visual Polish & Tactical Systems (6–8 weeks, prioritized)
1. **Super-Weapons** (High-impact gameplay):
   - Ion Cannon: Area damage (2-tile radius) in region; 3-min cooldown
   - Resonance Device: Shardborn-exclusive; high damage; chain effect
   - Requires: super-weapon command type, area-effect damage system, cooldown UI

2. **Replay Save/Playback** (Feature parity with OpenRA):
   - Save: Command log + seed → deterministic replay
   - Playback: Read log, execute same commands frame-perfectly
   - UI: Play/pause, speed controls, timeline

3. **Enhanced Stealth/Cloaking** (Partial implementation):
   - Cloaking Field refinement partially wired
   - Needs: visibility mechanics, reveal-on-fire, cloak + combat state

4. **Faction Art Differentiation** (Visual polish):
   - Palette swaps per faction (Concord steel, Emberhand chitin, Shardborn crystal)
   - Already prepped in graphics component (factionStripe field)

### Phase 4: Content Polish (2–3 weeks, lower priority)
- 100+ skirmish maps (generate via procedural + template variation)
- Sound design & voiceovers (low-critical-path)
- Localization (future, not MVP)

## Architecture Notes
- **Deterministic by design**: All RNG seeded; no Date/Math.random; replays work
- **Pure sim**: Systems read/write state only; no DOM/network in tick loop
- **Modular data**: Units/weapons/structures/refinements in JSON; loaded + validated
- **AI FSM**: 7-state planner (Stabilize → Recover → Raid → Assault → Pressure → Develop → Expand)

## How to Continue
1. Pick Phase 3 priority (Super-weapons recommended for immediate gameplay impact)
2. Read existing command.ts/systems/ for pattern reference
3. All new features should maintain determinism (use state.tick for seeding, not Date/random)
4. Run `npm test` frequently; determinism.test.ts is the gold standard
5. New missions require briefing/debrief text + objective types (see m20_act4_genesis.json for template)

## Files Modified This Session
- `src/sim/systems/ai.ts`: Squad grouping, veterancy leader election, threat matrix
- `src/sim/systems/combatTargeting.ts`: Threat multipliers (turrets/mobile/harvesters)
- `src/sim/systems/damage.ts`: Veterancy armor bonus (-5% per rank)
- `data/missions/`: 3 new epilogue missions (m18–m20) + 3 skirmish maps
- `data/units.json`, `data/weapons.json`, `data/structures.json`, `data/refinements.json`: Expanded per Phase 1a–c

---

**Last Updated**: Phase 1d complete, ready for Phase 3.
**Test Status**: 289/301 passing, determinism verified.
**Commit**: `21d1b22` (Phase 1d: Campaign Epilogue + Multiplayer Maps)
