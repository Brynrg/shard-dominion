# Shard Dominion - Build Plan

**Shard Dominion** (working title) is a faithful, high-fidelity recreation of the core gameplay loop, depth, asymmetry, tension, and strategic richness of classic 1998 Westwood RTS gameplay — stripped of all specific IP, lore, names, and assets. It is a generic sci-fi RTS on a hostile alien world, preserving and polishing the best elements: meaningful economy management, concrete/power tradeoffs, asymmetric factions, tech progression, scouting/fog of war, harassment vs. turtling, neutral threats, and classic controls/UI feel.

## Core Vision
- Deep economy with vulnerable harvesters and storage.
- Mandatory concrete foundations with degradation mechanics.
- Power management critical to operations.
- Three asymmetric factions with shared core + unique units/powers.
- Classic RTS tension with rock-paper-scissors combat and counters.
- Titan Worms and resource events as neutral threats.
- Data-driven, modular architecture for easy balancing and extension.

## Theme
Hostile resource world **Aether Prime**. Resource: **Aether Shards**. Factions compete for extraction and military dominance.

### Factions
- **Vanguard Enclave** (balanced/long-range/air): Reliable, strong sustained fire and aerial support.
- **Forge Dominion** (heavy/brute): Tough armor, overwhelming firepower.
- **Phantom Collective** (speed/stealth/disruption): Hit-and-run, cloaking, temporary control.

## Key Mechanics
### Resources/Economy
- Harvesters gather from finite/slow-regen shard fields → deliver to Processor (Refinery) + Silos.
- Multiple harvesters + later Carryall logistics. Raiding harvesters starves enemy.

### Concrete & Power
- Buildings require Foundation Slabs for full HP and no degradation.
- Power Nodes generate power; deficit slows queues, disables radar/advanced defenses.

### Fog of War & Scouting
- Classic shroud + LOS reveal. Permanent explored areas.

### Base Building
- Construction Yard (from MCV) enables building.
- Grid placement, Repair Pad, Starport for purchases.

### Units & Combat
- Infantry (Light/Troopers/Engineers for capture).
- Vehicles (fast scouts, Combat Tanks with faction variants, Missile/Siege Tanks).
- Air units (Carryalls, later strike craft).
- Specials with risks (area damage friendly fire, stealth, temp control, saboteurs).

### Tech & Uniques
- Research Lab unlocks advanced + faction specials (e.g., sonic area, heavy behemoth, deviator control).
- Command Nexus for super units/powers.

### Neutral Threats
- Titan Worms on deep sand (lured by thumpers or vibration).
- Volatile Shard Blooms (explosive events).

### Controls & UI
- Classic select/move/attack with modern QoL (groups, rally, smart orders, minimap).

## Recommended Tech Stack
- Vite + TypeScript + Phaser 3 (tilemaps, sprites, input).
- A* pathfinding, spatial hashing, data-driven JSON configs.
- Entity/component system, phased updates.

## Phased Build Plan

### Phase 0: Setup & Skeleton
- Project init, scenes, basic tilemap, camera, input, entity manager.
- Milestone: Empty map with moving placeholder units.

### Phase 1: Terrain, Fog, Pathfinding
- Tile properties, fog/LOS, A* pathfinding.
- Milestone: Intelligent movement and exploration.

### Phase 2: Economy
- Harvesters, processors, credits.
- Milestone: Autonomous gathering and delivery.

### Phase 3: Base Building
- Placement, concrete slabs, power, Construction Yard queues.
- Milestone: Functional base with degradation/power effects.

### Phase 4: Units & Basic Combat
- Data-driven units, production, simple combat.
- Milestone: Produce and fight with basic counters.

### Phase 5: UI, Minimap, Orders, Repair
- Full sidebar, minimap, context orders, repair.
- Milestone: Polished playable loop.

### Phase 6: AI & Skirmish
- Rule-based AI with faction personalities.
- Skirmish menu and difficulties.
- Milestone: Engaging vs AI.

### Phase 7: Advanced Tech & Threats
- Tech unlocks, faction uniques, Carryalls, worms, blooms.
- Milestone: Full asymmetry and tension.

### Phase 8: Campaign & Missions
- Data-driven missions, objectives, briefings.
- Milestone: Short campaign.

### Phase 9: Polish & Balance
- Animations, audio, performance, extensive balancing.
- Milestone: Ready for release on SpeedrunGames.net.

## Data-Driven Design
Use JSON files for units, buildings, factions, missions. Example unit structure provided in original plan.

## Risks & Best Practices
- Phase gates with review.
- Data-driven balancing.
- Performance optimization early.
- Placeholders for visuals first.

Full original plan details (mechanics screenshots references, etc.) are in conversation history. Expand JSON examples or pseudocode as needed during implementation.

**Implementation Instruction**: Build phase-by-phase. Use strict TypeScript. Pause after each phase for review.