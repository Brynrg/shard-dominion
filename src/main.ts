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
import { tileToWorldCenter, worldToScreen } from './sim/coords.js';
import { loadEconomyConstants } from './loaders/economyConstants.js';
import { loadStructures } from './loaders/structures.js';
import { loadWeapons } from './loaders/loader.js';
import { makeCombatTargetingSystem } from './sim/systems/combatTargeting.js';
import { makeDamageSystem } from './sim/systems/damage.js';
import { makeVictorySystem } from './sim/systems/victory.js';
import { makeFogSystem } from './sim/systems/fog.js';
import economyConstantsData from '../data/economyConstants.json' with { type: 'json' };
import structuresData from '../data/structures.json' with { type: 'json' };
import weaponsData from '../data/weapons.json' with { type: 'json' };

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
    __debugBuildingCount?: () => { mcv: number; conyard: number; power_node: number };
    __debugConYardScreenPos?: () => { x: number; y: number } | null;
    __debugUnitCount?: () => { player: number; enemy: number };
    __debugVictory?: () => { over: boolean; winner: 'player' | 'enemy' | null };
  }
}

// Load economy constants
const economy = loadEconomyConstants(economyConstantsData);

// Load structures
const structures = loadStructures(structuresData);

// Load weapons
const weapons = loadWeapons(weaponsData);
const victorySystem = makeVictorySystem();

export function bootstrap(): void {
  // Create sim state
  const state = makeSimState({
    seed: 42,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
  });

  // ── Demo seeding (S1): make one full harvest→deposit cycle visible fast ──
  // Blanket every shard tile with a LOW density so none dominates the harvester's
  // "densest reachable" search, then plant one rich source tile right next to the
  // harvester so it harvests, returns, and deposits within the liveness window.
  for (let ty = 0; ty < state.grid.height; ty++) {
    for (let tx = 0; tx < state.grid.width; tx++) {
      if (state.grid.terrainAt({ tx, ty }) === 'SHARD') {
        state.shardDensity.set(`${tx},${ty}`, 20);
      }
    }
  }

  const cx = Math.floor(MAP_WIDTH / 2);
  const cy = Math.floor(MAP_HEIGHT / 2);

  // Refinery at center (starts with 500 credits; storage mirrors the credits pool).
  state.store.create({
    position: tileToWorldCenter({ tx: cx, ty: cy }),
    building: { onSlab: true, buildProgress: 100, powered: true },
    faction: { team: 'player', faction: 'refinery' },
    economy: { credits: 500, refineryStorage: 500, maxStorage: economy.refineryStorageCapacity },
  });

  // Rich source tile two tiles east → the densest reachable, so the harvester picks it.
  state.shardDensity.set(`${cx + 2},${cy}`, 200);

  // Harvester one tile east of the refinery, seeking.
  state.store.create({
    position: tileToWorldCenter({ tx: cx + 1, ty: cy }),
    movement: { target: null, path: [], speed: 10 }, // 10 world units per tick
    faction: { team: 'player', faction: 'harvester' },
    harvest: { state: 'SEEK', targetTile: null, targetRefinery: null, cargo: 0 },
  });

  // MCV at center (deployable to Construction Yard)
  state.store.create({
    position: tileToWorldCenter({ tx: cx - 2, ty: cy }),
    faction: { team: 'player', faction: 'mcv' },
  });

  // ── Demo seeding (S4A-5): player + enemy combat units that fight on load ──
  // Rifle range is 4.0 tiles → 64 world units. Seed 3 tiles apart so they're in range.
  state.store.create({
    position: tileToWorldCenter({ tx: cx - 4, ty: cy + 4 }),
    health: { hp: 20, maxHp: 20 },
    armor: { armorClass: 'LIGHT' },
    combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
    faction: { team: 'player', faction: 'infantry' },
  });
  // Enemy starts weaker so the demo resolves decisively (player wins) rather than a
  // mutual-kill draw — makes the VICTORY banner testable.
  state.store.create({
    position: tileToWorldCenter({ tx: cx - 1, ty: cy + 4 }),
    health: { hp: 12, maxHp: 12 },
    armor: { armorClass: 'LIGHT' },
    combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
    faction: { team: 'enemy', faction: 'infantry' },
  });

  // Create command queue (view writes, command system reads) + the command system.
  const commandQueue = makeCommandQueue();
  const commandSystem = makeCommandSystem(commandQueue, structures);

  // Create construction system
  const constructionSystem = makeConstructionSystem(structures, commandQueue);

  // Create power system
  const powerSystem = makePowerSystem();

  // Register systems (command runs FIRST per SYSTEM_ORDER)
  const systems = orderSystems([
    commandSystem,
    makeMovementSystem(),
    makeHarvestSystem(economy),
    constructionSystem,
    powerSystem,
    makeCombatTargetingSystem(weapons),
    makeDamageSystem(weapons),
    victorySystem,
    makeFogSystem(),
  ]);

  // Get canvas
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) throw new Error('Canvas element not found');
  canvas.width = 800;
  canvas.height = 600;

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
  });

  // Camera panning is a pure view action — never a sim command.
  const panCamera = (dx: number, dy: number): void => {
    const c = view.getCamera();
    view.setCamera({ x: c.x + dx, y: c.y + dy, zoom: c.zoom });
  };

  // Wire input, then start rendering (input must exist before the first render frame).
  const input = makeInputHandlers(canvas, view.getCamera(), commandQueue, panCamera, structures);
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
    const count = { mcv: 0, conyard: 0, power_node: 0 };
    for (const e of state.store.all()) {
      const f = e.components.faction?.faction;
      if (f === 'mcv') count.mcv += 1;
      else if (f === 'construction_yard') count.conyard += 1;
      else if (f === 'power_node') count.power_node += 1;
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
}

// Auto-bootstrap on load
if (typeof window !== 'undefined') {
  window.addEventListener('load', bootstrap);
}
