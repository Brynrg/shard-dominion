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
import { makeObjectivesSystem } from './sim/systems/objectives.js';
import { makeProjectileSystem } from './sim/systems/projectile.js';
import { makePlanetEventSystem } from './sim/systems/planetEvent.js';
import { seedFromMission } from './sim/seedMission.js';
import { loadMission } from './loaders/missions.js';
import { showTitleMenu, showEndScreen, showPauseMenu, showMissionSelect, markCompleted, addBonus, takeBonus, loadProgress } from './view/menu.js';
import { makeAudioEngine } from './view/audio.js';
import economyConstantsData from '../data/economyConstants.json' with { type: 'json' };
import structuresData from '../data/structures.json' with { type: 'json' };
import weaponsData from '../data/weapons.json' with { type: 'json' };
import unitsData from '../data/units.json' with { type: 'json' };
import skirmishData from '../data/missions/skirmish.json' with { type: 'json' };
import m1FirstLightData from '../data/missions/m1_first_light.json' with { type: 'json' };
import m2Data from '../data/missions/m2_lifeblood.json' with { type: 'json' };
import m3Data from '../data/missions/m3_hold_the_line.json' with { type: 'json' };
import m4Data from '../data/missions/m4_the_vein.json' with { type: 'json' };
import m5Data from '../data/missions/m5_iron_ash.json' with { type: 'json' };
import m6Data from '../data/missions/m6_ashen_warlord.json' with { type: 'json' };

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
    __debugBuildingCount?: () => { mcv: number; conyard: number; power_node: number; barracks: number; refinery: number; defense_turret: number };
    __debugConYardScreenPos?: () => { x: number; y: number } | null;
    __debugUnitCount?: () => { player: number; enemy: number };
    __debugVictory?: () => { over: boolean; winner: 'player' | 'enemy' | null };
    __debugMatch?: () => { enemyUnits: number; playerUnits: number; enemyCredits: number };
    __debugPlayerQueue?: () => number;
    __debugHarvesterCount?: () => number;
    __debugAiState?: () => string;
    __debugEconomyTeams?: () => Record<'player' | 'enemy', { credits: number; harvesters: number; army: number; armyValue: number }>;
    __debugBriefing?: () => boolean;
    __debugObjectives?: () => { text: string; primary: boolean; complete: boolean }[];
    __debugAudio?: () => { state: string; played: number };
    __debugTimeScale?: () => number;
    __debugTick?: () => number;
    __debugForceEnd?: (winner: 'player' | 'enemy') => void;
    __debugMessages?: () => { speaker: string; text: string }[];
    __debugRiftmaws?: () => number;
    __debugUnitScreenPos?: (kind: string) => { x: number; y: number } | null;
    __debugSprites?: unknown; // the sprite bank, for the real-asset loader smoke test
    __debugCamera?: () => { x: number; y: number; zoom: number };
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

export function bootstrap(missionRaw: unknown = skirmishData): void {
  const mission = loadMission(missionRaw);

  // Create sim state from the mission map.
  const state = makeSimState({
    seed: mission.map.seed,
    mapWidth: mission.map.width,
    mapHeight: mission.map.height,
  });

  // Seed fields + both sides from the mission definition (replaces the old hardcoded
  // seeding; skirmish.json reproduces the original valley).
  const meta = seedFromMission(state, mission, { units, structures, economy });

  // Secondary-objective reward (FG-4): apply any banked bonus credits for this mission.
  const bonus = takeBonus(mission.id);
  if (bonus > 0) {
    const bank = state.store.all().find(e => e.components.faction?.team === 'player' && e.components.economy)?.components.economy;
    if (bank) bank.credits += bonus;
  }

  // ── Audio (FG-1): procedural WebAudio engine — resumed on the briefing click. ──
  const audio = makeAudioEngine();

  // ── Pause + game speed (FG-1): view-level; sim ticks stay a fixed 20 Hz. ──────
  let paused = false;
  let speed = 1;
  let closePauseMenu: (() => void) | null = null;

  // Create command queue (view writes, command system reads) + the command system.
  const commandQueue = makeCommandQueue();
  const commandSystem = makeCommandSystem(commandQueue, structures);

  // Create construction system
  const constructionSystem = makeConstructionSystem(structures, commandQueue);

  // Create power system
  const powerSystem = makePowerSystem();

  // Register systems (command runs FIRST per SYSTEM_ORDER; 'mission' objectives run in
  // their reserved slot). One AI per enemy side; victory still owns culling.
  const fogSystem = makeFogSystem();
  const victorySystem = makeVictorySystem();
  const objectivesSystem = makeObjectivesSystem(mission.objectives, mission.failure, mission.triggers, units);
  const aiSystems = mission.enemies.map(e => makeAiSystem(units, { team: 'enemy', attackTile: meta.playerStartTile, ...(e.ai ?? {}) }));
  const planetSystem = makePlanetEventSystem(units);
  const systems = orderSystems([
    commandSystem,
    makeMovementSystem(),
    makeHarvestSystem(economy),
    constructionSystem,
    powerSystem,
    makeCombatTargetingSystem(weapons),
    makeProjectileSystem(weapons),
    makeDamageSystem(weapons),
    makeProductionSystem(units),
    ...aiSystems,
    planetSystem,
    objectivesSystem,
    victorySystem,
    fogSystem,
  ]);

  // Mission win/lose (authoritative for the view) derived from the objective system.
  const missionResult = (): { over: boolean; winner: 'player' | 'enemy' | null } => {
    const r = objectivesSystem.result;
    return { over: r.won || r.lost, winner: r.won ? 'player' : (r.lost ? 'enemy' : null) };
  };

  // Get canvas
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) throw new Error('Canvas element not found');
  canvas.width = 800;
  canvas.height = 600;

  // Onboarding: per-mission briefing (sim paused until dismissed) + objective banner.
  const onboarding = makeOnboarding(mission.briefing, () => objectivesSystem.result.objectives, () => objectivesSystem.messages);

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
    getVictory: () => missionResult(),
    weapons,
    getFog: () => ({ visible: fogSystem.visible, explored: fogSystem.explored }),
    onboarding,
    objectiveWorld: tileToWorldCenter(meta.objectiveTile), // the mission objective = the goal marker
    getHover: () => input.getCursor(),                               // sidebar hover highlight
    cargoCapacity: economy.cargoCapacity,                            // HUD cargo-bar denominator
    audio,                                                           // FX diff emits SFX
    getTimeScale: () => (paused ? 0 : speed),                        // pause/speed (FG-1)
  });

  // Camera panning is a pure view action — never a sim command.
  const panCamera = (dx: number, dy: number): void => {
    const c = view.getCamera();
    view.setCamera({ x: c.x + dx, y: c.y + dy, zoom: c.zoom });
  };

  // Wire input, then start rendering (input must exist before the first render frame).
  const input = makeInputHandlers(canvas, view.getCamera(), commandQueue, panCamera, structures, {
    active: () => onboarding.briefingActive(),
    dismiss: () => { audio.resume(); audio.startMusic(); onboarding.dismissBriefing(); },
  }, {
    jump: (sx, sy) => view.minimapJump(sx, sy),
  }, {
    buttonAt: (sx, sy) => view.hudButtonAt(sx, sy),
  }, audio);
  input.setSimState(state); // wire the sim-state ref used by the ConYard check (for 'B' placement)
  input.start();
  view.start();

  // ── Pause menu + hotkeys (FG-1): P/Esc pause, −/+ game speed. View-level only —
  // the time scale gates tick accumulation; the sim itself never sees wall-clock.
  const togglePause = (): void => {
    if (missionResult().over) return;            // the debrief owns the end state
    paused = !paused;
    if (paused) {
      audio.resume();                             // pause can be the first gesture
      closePauseMenu = showPauseMenu({
        onResume: () => togglePause(),
        onRestart: () => location.reload(),
        onMenu: () => { location.search = ''; },
        audio,
        getSpeed: () => speed,
        setSpeed: (sp) => { speed = sp; },
      });
    } else {
      closePauseMenu?.();
      closePauseMenu = null;
    }
  };
  const SPEEDS = [0.5, 1, 1.5, 2];
  const onHotkey = (e: KeyboardEvent): void => {
    if (onboarding.briefingActive()) return;      // briefing owns the screen
    if (e.key === 'p' || e.key === 'P') { togglePause(); }
    else if (e.key === 'Escape') {
      // Placement/attack-move cancel wins (input handles it); else toggle pause.
      if (!input.getPlacementMode() && !input.getAttackMoveMode()) togglePause();
    } else if (!paused && (e.key === '+' || e.key === '=')) {
      speed = SPEEDS[Math.min(SPEEDS.indexOf(speed) + 1, SPEEDS.length - 1)] ?? 1;
    } else if (!paused && e.key === '-') {
      speed = SPEEDS[Math.max(SPEEDS.indexOf(speed) - 1, 0)] ?? 1;
    }
  };
  // Capture phase: fires BEFORE input's bubble-phase keydown, so Escape-while-placing
  // sees placement still active and yields to input's cancel instead of also pausing.
  window.addEventListener('keydown', onHotkey, { capture: true });

  // ── Mission end → debrief screen + navigation ──────────────────────────────
  // Poll the mission result; when the match is decided, stop the sim, record campaign
  // progress on a win, and show the debrief with Next / Retry / Menu (reload-based nav).
  const endWatch = window.setInterval(() => {
    const r = missionResult();
    if (!r.over) return;
    window.clearInterval(endWatch);
    view.stop();
    closePauseMenu?.(); closePauseMenu = null; paused = false;
    const won = r.winner === 'player';
    audio.matchEnd(won);
    if (won && mission.id !== 'skirmish') {
      markCompleted(mission.id);
      // Bank secondary-objective rewards for the NEXT mission (FG-4).
      if (mission.next) {
        for (const rw of mission.rewards) {
          const obj = objectivesSystem.result.objectives.find(o => o.id === rw.ifObjectiveComplete);
          if (obj?.complete) addBonus(mission.next, rw.grant.nextMissionCredits);
        }
      }
    }
    const nextId = mission.next && MISSIONS[mission.next] ? mission.next : null;
    showEndScreen({
      won,
      missionName: mission.name,
      debrief: won ? mission.debrief.win : mission.debrief.lose,
      onNext: won && nextId ? () => { location.search = `?mission=${nextId}`; } : undefined,
      onRetry: !won ? () => location.reload() : undefined,
      onMenu: () => { location.search = ''; },
    });
  }, 400);

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
    const count = { mcv: 0, conyard: 0, power_node: 0, barracks: 0, refinery: 0, defense_turret: 0 };
    for (const e of state.store.all()) {
      const f = e.components.faction?.faction;
      if (e.components.faction?.team !== 'player') continue;
      if (f === 'mcv') count.mcv += 1;
      else if (f === 'construction_yard') count.conyard += 1;
      else if (f === 'power_node') count.power_node += 1;
      else if (f === 'barracks') count.barracks += 1;
      else if (f === 'refinery') count.refinery += 1;
      else if (f === 'defense_turret') count.defense_turret += 1;
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
  window.__debugVictory = () => missionResult();

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

  // Expose the camera for the edge-scroll / zoom liveness gate.
  window.__debugCamera = () => view.getCamera();

  // Expose player queue debug hook for P0b
  window.__debugPlayerQueue = () => {
    const barracks = state.store.all().find(e =>
      e.components.faction?.team === 'player' && e.components.production);
    return barracks?.components.production?.queue.length ?? 0;
  };

  // Count living player Harvesters (harvest FSM, not combat) — for the
  // Harvester-from-Refinery gate (turn-one production, no Barracks needed).
  window.__debugHarvesterCount = () => {
    let n = 0;
    for (const e of state.store.all()) {
      if (e.components.faction?.team === 'player' &&
          e.components.faction?.faction === 'harvester' &&
          (e.components.health?.hp ?? 1) > 0) n++;
    }
    return n;
  };

  // The AI's current FSM plan (Stabilize/Develop/Pressure/Raid/Assault/Recover/Expand).
  window.__debugAiState = () => aiSystems[0]?.debugState() ?? 'none';

  // Current mission objective texts + completion (for the campaign liveness gate).
  window.__debugObjectives = () => objectivesSystem.result.objectives.map(o => ({ text: o.text, primary: o.primary, complete: o.complete }));

  // First living player unit of a kind → its screen position (FG-1 command gate).
  window.__debugUnitScreenPos = (kind: string) => {
    const u = state.store.all().find(e =>
      e.components.faction?.team === 'player' && e.components.faction?.faction === kind &&
      (e.components.health?.hp ?? 1) > 0 && e.components.position);
    if (!u) return null;
    const { sx, sy } = worldToScreen(u.components.position!, view.getCamera());
    return { x: sx, y: sy };
  };

  // Riftmaw awakenings counter (FG-5 gate).
  window.__debugRiftmaws = () => planetSystem.debugRiftmaws();

  // Trigger comm messages (FG-4 gate).
  window.__debugMessages = () => objectivesSystem.messages.map(m => ({ speaker: m.speaker, text: m.text }));

  // Audio + time-scale + tick hooks (FG-1 gates).
  window.__debugAudio = () => audio.debug();
  window.__debugTimeScale = () => (paused ? 0 : speed);
  window.__debugTick = () => state.tick;

  // Test-only: force the mission to end so the debrief/flow can be exercised in a gate.
  window.__debugForceEnd = (winner) => {
    objectivesSystem.result.won = winner === 'player';
    objectivesSystem.result.lost = winner === 'enemy';
  };

  // E10 economy telemetry: per-team snapshot for balance tuning (income is real, so
  // watching credits + harvesters + army over time proves the AI economy is alive).
  window.__debugEconomyTeams = () => {
    const out = {
      player: { credits: 0, harvesters: 0, army: 0, armyValue: 0 },
      enemy: { credits: 0, harvesters: 0, army: 0, armyValue: 0 },
    };
    const cost = (id: string): number => units.find(u => u.id === id)?.cost ?? 0;
    for (const e of state.store.all()) {
      const team = e.components.faction?.team;
      if (team !== 'player' && team !== 'enemy') continue;
      const row = out[team];
      if (e.components.economy) row.credits += e.components.economy.credits;
      if (e.components.faction?.faction === 'harvester' && (e.components.health?.hp ?? 0) > 0) row.harvesters++;
      if (e.components.combat && (e.components.health?.hp ?? 0) > 0) {
        row.army++;
        row.armyValue += cost(e.components.faction?.faction ?? '');
      }
    }
    return out;
  };
}

// ── Entry: mission registry + router ──────────────────────────────────────────
// `?mission=<id>` boots that match directly (deep-linkable; the liveness gates use it);
// with no param, the title menu chooses Campaign (Mission 1) or Skirmish.
const MISSIONS: Record<string, unknown> = {
  skirmish: skirmishData,
  m1_first_light: m1FirstLightData,
  m2_lifeblood: m2Data,
  m3_hold_the_line: m3Data,
  m4_the_vein: m4Data,
  m5_iron_ash: m5Data,
  m6_ashen_warlord: m6Data,
};
/** Campaign order (linear unlock: each mission unlocks the next). */
const CAMPAIGN: { id: string; name: string; order: number }[] = [
  { id: 'm1_first_light', name: 'First Light', order: 1 },
  { id: 'm2_lifeblood', name: 'Lifeblood', order: 2 },
  { id: 'm3_hold_the_line', name: 'Hold the Line', order: 3 },
  { id: 'm4_the_vein', name: 'The Vein', order: 4 },
  { id: 'm5_iron_ash', name: 'Iron & Ash', order: 5 },
  { id: 'm6_ashen_warlord', name: 'The Ashen Warlord', order: 6 },
];

function openMissionSelect(): void {
  const progress = loadProgress();
  const entries = CAMPAIGN.map((m, i) => ({
    ...m,
    completed: progress.completed.includes(m.id),
    unlocked: i === 0 || progress.completed.includes(CAMPAIGN[i - 1]!.id),
  }));
  showMissionSelect(entries, id => { location.search = `?mission=${id}`; }, () => {
    showTitleMenu(id => (id === '__campaign__' ? openMissionSelect() : (location.search = `?mission=${id}`)), '__campaign__');
  });
}

// Title menu: Campaign opens the mission-select screen; Skirmish boots directly.
function openTitle(): void {
  showTitleMenu(id => (id === '__campaign__' ? openMissionSelect() : (location.search = `?mission=${id}`)), '__campaign__');
}

if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    const missionId = new URLSearchParams(location.search).get('mission');
    if (missionId && MISSIONS[missionId]) bootstrap(MISSIONS[missionId]);
    else openTitle();
  });
}
