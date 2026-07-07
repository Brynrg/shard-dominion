// ── Main: bootstrap the game ──────────────────────────────────────────────────
// Creates sim state, entities, systems, and starts the renderer.
import { makeSimState } from './sim/state.js';
import { orderSystems } from './sim/loop.js';
import { makeMovementSystem } from './sim/systems/movement.js';
import { makeHarvestSystem } from './sim/systems/harvest.js';
import { makeCommandSystem } from './sim/systems/command.js';
import { makeConstructionSystem } from './sim/systems/construction.js';
import { makePowerSystem } from './sim/systems/power.js';
import { makeView } from './view/index.js';
import { makeInputHandlers, makeCommandQueue } from './view/input.js';
import { makeOnboarding } from './view/onboarding.js';
import { tileToWorldCenter, worldToScreen } from './sim/coords.js';
import { loadEconomyConstants } from './loaders/economyConstants.js';
import { loadStructures } from './loaders/structures.js';
import { loadWeapons } from './loaders/loader.js';
import { loadUnits } from './loaders/units.js';
import { makeCombatTargetingSystem } from './sim/systems/combatTargeting.js';
import { makeDamageSystem } from './sim/systems/damage.js';
import { makeVictorySystem } from './sim/systems/victory.js';
import { makeFogSystem } from './sim/systems/fog.js';
import { makeProductionSystem } from './sim/systems/production.js';
import { makeAiSystem } from './sim/systems/ai.js';
import economyConstantsData from '../data/economyConstants.json' with { type: 'json' };
import structuresData from '../data/structures.json' with { type: 'json' };
import weaponsData from '../data/weapons.json' with { type: 'json' };
import unitsData from '../data/units.json' with { type: 'json' };

// Map configuration
const MAP_WIDTH = 32;
const MAP_HEIGHT = 32;

// Expose debug hooks for liveness test
declare global {
  interface Window {
    __debugHarvesterScreenPos?: () => { x: number; y: number } | null;
    __debugEconomy?: () => { credits: number };
    __debugSelection?: () => number;
    __debugPower?: () => { supply: number; demand: number; powered: boolean };
    __debugBuildingCount?: () => { mcv: number; conyard: number; power_node: number; barracks: number };
    __debugConYardScreenPos?: () => { x: number; y: number } | null;
    __debugUnitCount?: () => { player: number; enemy: number };
    __debugVictory?: () => { over: boolean; winner: 'player' | 'enemy' | null };
    __debugMatch?: () => { enemyUnits: number; playerUnits: number; enemyCredits: number };
    __debugPlayerQueue?: () => number;
    __debugBriefing?: () => boolean;
    __debugSprites?: unknown; // the sprite bank, for the real-asset loader smoke test
  }
}

// Load economy constants
const economy = loadEconomyConstants(economyConstantsData);

// Load structures
const structures = loadStructures(structuresData);

// Load weapons
const weapons = loadWeapons(weaponsData);
// Load units
const units = loadUnits(unitsData);
const victorySystem = makeVictorySystem();

export function bootstrap(): void {
  // Create sim state
  const state = makeSimState({
    seed: 42,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
  });

  const cx = Math.floor(MAP_WIDTH / 2);
  const cy = Math.floor(MAP_HEIGHT / 2);

  // ── Economy seeding (P0c): a real, MATCH-SUSTAINING shard field ──
  // Every natural SHARD tile carries a workable base density, and a dense field is
  // planted next to the player base (east of the harvester) so continuous harvesting
  // funds a full match — enough credits to train an army, not just the S1 demo.
  for (let ty = 0; ty < state.grid.height; ty++) {
    for (let tx = 0; tx < state.grid.width; tx++) {
      if (state.grid.terrainAt({ tx, ty }) === 'SHARD') {
        state.shardDensity.set(`${tx},${ty}`, 300);
      }
    }
  }
  // A rich home field: a 3×3 cluster ~2 tiles east of the harvester (the densest
  // reachable, so the harvester works it first). ~9 × 800 ≈ 7,200 credits of income.
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = 0; dx <= 2; dx++) {
      state.shardDensity.set(`${cx + 2 + dx},${cy + dy}`, 800);
    }
  }

  // ── Warcraft-style opening: a base HUB + a worker, then you build up ──────────
  // Refinery = your resource hub (the harvester docks credits here). Starts with
  // enough cash to raise a Barracks (300) and train a few troops.
  state.store.create({
    position: tileToWorldCenter({ tx: cx, ty: cy }),
    building: { onSlab: true, buildProgress: 100, powered: true },
    faction: { team: 'player', faction: 'refinery' },
    economy: { credits: 700, refineryStorage: 700, maxStorage: economy.refineryStorageCapacity },
    health: { hp: 1500, maxHp: 1500 },
    armor: { armorClass: 'BUILDING' },
  });

  // Construction Yard already standing (the "town hall") — provides the build radius
  // so you can raise a Barracks with B from turn one. No MCV-deploy step needed.
  state.store.create({
    position: tileToWorldCenter({ tx: cx - 2, ty: cy }),
    building: { onSlab: true, buildProgress: 100, powered: true },
    faction: { team: 'player', faction: 'construction_yard' },
    construction: { queue: [], progress: 0, currentStructureId: null },
    power: { powerSupply: 0, powerDemand: 0, powered: true },
    health: { hp: 2000, maxHp: 2000 },
    armor: { armorClass: 'BUILDING' },
  });

  // Harvester (your worker) — one tile east of the refinery, auto-mining Shard.
  state.store.create({
    position: tileToWorldCenter({ tx: cx + 1, ty: cy }),
    movement: { target: null, path: [], speed: 10 },
    faction: { team: 'player', faction: 'harvester' },
    harvest: { state: 'SEEK', targetTile: null, targetRefinery: null, cargo: 0 },
  });

  // ── Match scene: player hub + worker + 2 starting troops vs an AI base ─────────
  // Two starting soldiers so you're not defenceless while you build a Barracks.
  for (const dx of [-3, -2]) {
    state.store.create({ position: tileToWorldCenter({ tx: cx + dx, ty: cy + 2 }),
      health: { hp: 20, maxHp: 20 }, armor: { armorClass: 'LIGHT' },
      movement: { target: null, path: [], speed: 12 },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
      faction: { team: 'player', faction: 'infantry' } });
  }
  // AI base ~10 tiles NE: bank (refinery w/ credits) + barracks (producer):
  state.store.create({ position: tileToWorldCenter({ tx: cx + 10, ty: cy - 8 }),
    building: { onSlab: true, buildProgress: 100, powered: true },
    faction: { team: 'enemy', faction: 'refinery' },
    economy: { credits: 600, refineryStorage: 600, maxStorage: 2000 },
    health: { hp: 1500, maxHp: 1500 },
    armor: { armorClass: 'BUILDING' } });
  state.store.create({ position: tileToWorldCenter({ tx: cx + 11, ty: cy - 7 }),
    building: { onSlab: true, buildProgress: 100, powered: true },
    faction: { team: 'enemy', faction: 'barracks' },
    production: { queue: [], progress: 0 },
    health: { hp: 800, maxHp: 800 },
    armor: { armorClass: 'BUILDING' } });

  // Create command queue (view writes, command system reads) + the command system.
  const commandQueue = makeCommandQueue();
  const commandSystem = makeCommandSystem(commandQueue, structures);

  // Create construction system
  const constructionSystem = makeConstructionSystem(structures, commandQueue);

  // Create power system
  const powerSystem = makePowerSystem();

  // Register systems (command runs FIRST per SYSTEM_ORDER)
  const fogSystem = makeFogSystem();
  const systems = orderSystems([
    commandSystem,
    makeMovementSystem(),
    makeHarvestSystem(economy),
    constructionSystem,
    powerSystem,
    makeCombatTargetingSystem(weapons),
    makeDamageSystem(weapons),
    makeProductionSystem(units),
    makeAiSystem(units, { team: 'enemy', unitId: 'infantry', armySize: 2, attackTile: { tx: cx, ty: cy } }),
    victorySystem,
    fogSystem,
  ]);

  // Get canvas
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) throw new Error('Canvas element not found');
  canvas.width = 800;
  canvas.height = 600;

  // Onboarding: mission briefing (sim paused until dismissed) + staged objectives.
  const onboarding = makeOnboarding();

  // Create the view — it reads the command system's confirmation markers and the
  // live selection box from input (both view-side; the sim stays screen-blind).
  const view = makeView({
    canvas,
    simState: state,
    systems,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
    confirmationMarkers: commandSystem.markers,
    getSelectionBox: () => input.getSelectionBox(),
    getPlacementMode: () => input.getPlacementMode(),
    structures,
    getVictory: () => victorySystem.result,
    weapons,
    getFog: () => ({ visible: fogSystem.visible, explored: fogSystem.explored }),
    onboarding,
    objectiveWorld: tileToWorldCenter({ tx: cx + 10, ty: cy - 8 }), // the enemy base = the goal
  });

  // Camera panning is a pure view action — never a sim command.
  const panCamera = (dx: number, dy: number): void => {
    const c = view.getCamera();
    view.setCamera({ x: c.x + dx, y: c.y + dy, zoom: c.zoom });
  };

  // Wire input, then start rendering (input must exist before the first render frame).
  const input = makeInputHandlers(canvas, view.getCamera(), commandQueue, panCamera, structures, {
    active: () => onboarding.briefingActive(),
    dismiss: () => onboarding.dismissBriefing(),
  }, {
    jump: (sx, sy) => view.minimapJump(sx, sy),
  });
  input.setSimState(state); // wire the sim-state ref used by the ConYard check (for 'B' placement)
  input.start();
  view.start();

  // Expose debug hook — a locator that reads post-render state through the SAME
  // contract transform the renderer uses (not a re-derived one).
  window.__debugHarvesterScreenPos = () => {
    const harvester = state.store.all().find(e => e.components.movement);
    if (!harvester || !harvester.components.position) return null;
    const { sx, sy } = worldToScreen(harvester.components.position, view.getCamera());
    return { x: sx, y: sy };
  };

  // Expose economy debug hook for liveness test
  window.__debugEconomy = () => {
    const refinery = state.store.all().find(e => e.components.building && e.components.economy);
    if (!refinery || !refinery.components.economy) return { credits: 0 };
    return { credits: refinery.components.economy.credits || 0 };
  };

  // Expose selection debug hook for S2 liveness test
  window.__debugSelection = () => {
    let count = 0;
    for (const e of state.store.all()) {
      if (e.components.selection?.selected) count++;
    }
    return count;
  };

  // Expose power debug hook for S3 liveness test
  window.__debugPower = () => {
    let supply = 0;
    let demand = 0;

    for (const e of state.store.all()) {
      const power = e.components.power;
      if (power) {
        supply += power.powerSupply;
        demand += power.powerDemand;
      }
    }

    return { supply, demand, powered: supply >= demand };
  };

  // Building-count + ConYard locator hooks for the S3 liveness gate.
  window.__debugBuildingCount = () => {
    const count = { mcv: 0, conyard: 0, power_node: 0, barracks: 0 };
    for (const e of state.store.all()) {
      const f = e.components.faction?.faction;
      if (e.components.faction?.team !== 'player') continue;
      if (f === 'mcv') count.mcv += 1;
      else if (f === 'construction_yard') count.conyard += 1;
      else if (f === 'power_node') count.power_node += 1;
      else if (f === 'barracks') count.barracks += 1;
    }
    return count;
  };
  window.__debugConYardScreenPos = () => {
    const cy = state.store.all().find(e => e.components.faction?.faction === 'construction_yard');
    if (!cy || !cy.components.position) return null;
    const { sx, sy } = worldToScreen(cy.components.position, view.getCamera());
    return { x: sx, y: sy };
  };

  // Expose unit count debug hook for S4A-5 liveness test
  window.__debugUnitCount = () => {
    let player = 0, enemy = 0;
    for (const e of state.store.all()) {
      if (!e.components.combat) continue;
      const h = e.components.health;
      if (!h || h.hp <= 0) continue;
      const t = e.components.faction?.team;
      if (t === 'player') player++;
      else if (t === 'enemy') enemy++;
    }
    return { player, enemy };
  };

  // Expose victory debug hook for S4A-5 liveness test
  window.__debugVictory = () => ({ over: victorySystem.result.over, winner: victorySystem.result.winner });

  // Expose match debug hook for S6A-3
  window.__debugMatch = () => {
    let enemyUnits = 0, playerUnits = 0;
    let enemyCredits = 0;
    for (const e of state.store.all()) {
      if (e.components.combat && (e.components.health?.hp ?? 0) > 0) {
        const t = e.components.faction?.team;
        if (t === 'player') playerUnits++;
        else if (t === 'enemy') enemyUnits++;
      }
      if (e.components.faction?.team === 'enemy' && e.components.economy) {
        enemyCredits = e.components.economy.credits || 0;
      }
    }
    return { enemyUnits, playerUnits, enemyCredits };
  };

  // Expose briefing state for the P1 onboarding gate.
  window.__debugBriefing = () => onboarding.briefingActive();

  // Expose the sprite bank so the real-asset load path can be smoke-tested.
  window.__debugSprites = view.spriteBank;

  // Expose player queue debug hook for P0b
  window.__debugPlayerQueue = () => {
    const barracks = state.store.all().find(e =>
      e.components.faction?.team === 'player' && e.components.production);
    return barracks?.components.production?.queue.length ?? 0;
  };
}

// Auto-bootstrap on load
if (typeof window !== 'undefined') {
  window.addEventListener('load', bootstrap);
}
