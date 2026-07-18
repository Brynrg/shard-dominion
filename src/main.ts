// ── Main: bootstrap the game ──────────────────────────────────────────────────
// Creates sim state, entities, systems, and starts the renderer.
import { makeSimState } from './sim/state.js';
import { orderSystems } from './sim/loop.js';
import { makeMovementSystem } from './sim/systems/movement.js';
import { makeHarvestSystem } from './sim/systems/harvest.js';
import { makeResearchSystem } from './sim/systems/research.js';
import { makeHeroSystem } from './sim/systems/hero.js';
import { makeRegenSystem } from './sim/systems/regen.js';
import { loadRefinements } from './loaders/refinements.js';
import refinementsData from '../data/refinements.json' with { type: 'json' };
import { makeCommandSystem, validatePlacement } from './sim/systems/command.js';
import { makeConstructionSystem } from './sim/systems/construction.js';
import { makePowerSystem } from './sim/systems/power.js';
import { makeView } from './view/index.js';
import { makeInputHandlers, makeCommandQueue } from './view/input.js';
import { makeOnboarding } from './view/onboarding.js';
import { makeAnnouncer, makeA11ySettings } from './view/a11y.js';
import { makeEva } from './view/eva.js';
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
import { makeStealthSystem } from './sim/systems/stealth.js';
import { isStormActive } from './sim/systems/planetEvent.js';
import { makeProjectileSystem } from './sim/systems/projectile.js';
import { makePlanetEventSystem } from './sim/systems/planetEvent.js';
import { seedFromMission } from './sim/seedMission.js';
import { teamTier } from './sim/tech.js';
import { teamCredits, grantCredits as grantCredits2 } from './sim/ledger.js';
import { makeTeamFactions, modCost, type FactionId } from './sim/factions.js';
import { makeLockstep, type Lockstep } from './net/lockstep.js';
import { stateHash } from './sim/state.js';
import { runTick as simRunTick } from './sim/loop.js';
import { loadMission } from './loaders/missions.js';
import { showTitleMenu, showEndScreen, showPauseMenu, showMissionSelect, showSkirmishSetup, showMultiplayerSetup, showDevMenu, showDeployment, showChoice, showCredits, markCompleted, addBonus, takeBonus, loadProgress, recordCampaignCarry } from './view/menu.js';
import { makeAudioEngine } from './view/audio.js';
import economyConstantsData from '../data/economyConstants.json' with { type: 'json' };
import structuresData from '../data/structures.json' with { type: 'json' };
import weaponsData from '../data/weapons.json' with { type: 'json' };
import unitsData from '../data/units.json' with { type: 'json' };
import skirmishData from '../data/missions/skirmish.json' with { type: 'json' };
import skirmishBadlandsData from '../data/missions/skirmish_badlands.json' with { type: 'json' };
import m1FirstLightData from '../data/missions/m1_first_light.json' with { type: 'json' };
import m2Data from '../data/missions/m2_lifeblood.json' with { type: 'json' };
import m3Data from '../data/missions/m3_hold_the_line.json' with { type: 'json' };
import m4Data from '../data/missions/m4_the_vein.json' with { type: 'json' };
import m5Data from '../data/missions/m5_iron_ash.json' with { type: 'json' };
import m6Data from '../data/missions/m6_ashen_warlord.json' with { type: 'json' };
import m7Data from '../data/missions/m7_the_turn.json' with { type: 'json' };
import m8Data from '../data/missions/m8_ashfall.json' with { type: 'json' };
import m9Data from '../data/missions/m9_the_exchange.json' with { type: 'json' };
import m10Data from '../data/missions/m10_stormline.json' with { type: 'json' };
import m11Data from '../data/missions/m11_cauterize.json' with { type: 'json' };
import m12Data from '../data/missions/m12_renegade.json' with { type: 'json' };
import m13Data from '../data/missions/m13_choir_of_glass.json' with { type: 'json' };
import m14Data from '../data/missions/m14_first_vein.json' with { type: 'json' };
import m15Data from '../data/missions/m15_aftershock.json' with { type: 'json' };
import m16Data from '../data/missions/m16_ash_court.json' with { type: 'json' };
import m17Data from '../data/missions/m17_aethers_verdict.json' with { type: 'json' };

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
    __debugAudio?: () => { state: string; played: number; muted: boolean };
    __debugTimeScale?: () => number;
    __debugTick?: () => number;
    __debugTier?: () => { player: number; enemy: number };
    __debugButtonRect?: (action: string) => { x: number; y: number; w: number; h: number } | null;
    __debugTriggersFired?: () => string[];
    __debugStorm?: () => boolean;
    __debugCells?: () => { player: number; enemy: number };
    __debugResonance?: () => { player: number; enemy: number };
    __debugForceEnd?: (winner: 'player' | 'enemy') => void;
    __debugMessages?: () => { speaker: string; text: string }[];
    __debugRiftmaws?: () => number;
    __debugMp?: () => { seat: number; desynced: boolean; peerLeft: boolean };
    __debugUnitScreenPos?: (kind: string) => { x: number; y: number } | null;
    __debugSprites?: unknown; // the sprite bank, for the real-asset loader smoke test
    __debugCamera?: () => { x: number; y: number; zoom: number };
    __debugA11y?: () => { teamShapes: boolean; lastAnnouncement: string };
    __debugEva?: () => { last: string; voice: boolean };
    __debugPlacement?: () => { structureId: string; tile: { tx: number; ty: number } } | null;
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
// Load refinements (economy depth: team-wide researched upgrades)
const refinements = loadRefinements(refinementsData);

/** Multiplayer session (FG-7), set by the pre-boot handshake before bootstrap runs. */
let mpSession: { lockstep: Lockstep; seat: number } | null = null;

export function bootstrap(missionRaw: unknown = skirmishData): void {
  const mission = loadMission(missionRaw);
  const params = new URLSearchParams(location.search);
  const mp = mpSession;
  const viewerTeam: 'player' | 'enemy' = (mp?.seat ?? 0) % 2 === 1 ? 'enemy' : 'player'; // TP-4: seats pair by parity (2v2)

  // ── Factions (FG-6): mission defaults, URL ?faction= overrides the player. ──
  const playerFaction = (params.get('faction') as FactionId | null) ?? mission.player.factionId ?? 'concord';
  const teamFactions = makeTeamFactions(playerFaction, mission.enemies[0]?.factionId ?? 'concord');

  // ── Difficulty (FG-6): scales the AI's tempo + thresholds, never its economy. ──
  const difficulty = params.get('difficulty') ?? 'normal';
  const D = difficulty === 'easy' ? { int: 2, av: 1.5, esc: 0.5, raid: -1, grace: 3600 }
    : difficulty === 'hard' ? { int: 0.5, av: 0.7, esc: 1.5, raid: 1, grace: 480 }
    : { int: 1, av: 1, esc: 1, raid: 0, grace: 1500 };

  // Create sim state from the mission map.
  const state = makeSimState({
    seed: mission.map.seed,
    mapWidth: mission.map.width,
    mapHeight: mission.map.height,
  });

  // Seed fields + both sides from the mission definition (replaces the old hardcoded
  // seeding; skirmish.json reproduces the original valley).
  const meta = seedFromMission(state, mission, { units, structures, economy }, teamFactions);

  // Secondary-objective reward (FG-4) + TP-4: on a CONTINUE boot, replay the saved
  // boot-state (the bonus was consumed on the original run) so the command-log
  // replays over identical starting conditions.
  const isContinue = params.get('continue') === '1';
  let savedBoot: { bonus?: number; deployment?: { squads: number; credits: number }; choice?: string | null } = {};
  if (isContinue) {
    try { savedBoot = (JSON.parse(localStorage.getItem('shardDominion.save') ?? '{}') as { boot?: typeof savedBoot }).boot ?? {}; } catch { /* ignore */ }
  }
  const bonus = isContinue ? (savedBoot.bonus ?? 0) : takeBonus(mission.id);
  if (bonus > 0) grantCredits2(state, 'player', bonus, true);
  const bootState = { bonus, deployment: { squads: 0, credits: 0 }, choice: null as string | null };

  // ── Audio (FG-1): procedural WebAudio engine — resumed on the briefing click. ──
  const audio = makeAudioEngine();

  // ── Pause + game speed (FG-1): view-level; sim ticks stay a fixed 20 Hz. ──────
  let paused = false;
  let speed = 1;
  let closePauseMenu: (() => void) | null = null;

  // Create command queue (view writes, command system reads) + the command system.
  // FG-6: every pushed intent is RECORDED with its tick — the command log IS the
  // save file (determinism: replaying the log reproduces the match exactly).
  const rawQueue = makeCommandQueue();
  const intentLog: { t: number; i: Parameters<typeof rawQueue.push>[0] }[] = [];
  const commandQueue: typeof rawQueue = mp ? {
    // Multiplayer: local intents are scheduled + broadcast, never applied directly.
    push: (i) => mp.lockstep.submit(i, state.tick),
    drain: () => rawQueue.drain(),
  } : {
    push: (i) => { intentLog.push({ t: state.tick, i }); rawQueue.push(i); },
    drain: () => rawQueue.drain(),
  };
  const commandSystem = makeCommandSystem(commandQueue, structures, ['warden', 'vane'], refinements);

  // Create construction system
  const constructionSystem = makeConstructionSystem(structures, commandQueue);

  // Create power system
  const powerSystem = makePowerSystem();

  // Register systems (command runs FIRST per SYSTEM_ORDER; 'mission' objectives run in
  // their reserved slot). One AI per enemy side; victory still owns culling.
  const fogSystem = makeFogSystem(viewerTeam);
  const victorySystem = makeVictorySystem(units);
  // XP-6: the finale CHOICE — read what the panel stored; filter branch objectives.
  if (params.get('continue') === '1' && mission.choice) {
    // TP-4: a continued finale restores its saved branch before objectives filter.
    try {
      const sc = (JSON.parse(localStorage.getItem('shardDominion.save') ?? '{}') as { boot?: { choice?: string | null } }).boot?.choice;
      if (sc) localStorage.setItem(`shardDominion.choice.${mission.id}`, sc);
    } catch { /* ignore */ }
  }
  // The active branch: a mission with its own `choice` reads its per-mission key;
  // an Act III `inheritsChoice` mission reads the stable campaign key (set at M14).
  const bootChoice = mission.choice
    ? localStorage.getItem(`shardDominion.choice.${mission.id}`)
    : (mission.inheritsChoice ? localStorage.getItem('shardDominion.choice.campaign') : null);
  const liveObjectives = mission.objectives.filter(o => !o.onlyIfChoice || o.onlyIfChoice === bootChoice);
  const objectivesSystem = makeObjectivesSystem(liveObjectives, mission.failure, mission.triggers, units, teamFactions, bootChoice);
  const aiSystems = mp ? [] : mission.enemies.map(e => {
    const base = { team: 'enemy' as const, attackTile: meta.playerStartTile, ...(e.ai ?? {}) };
    return makeAiSystem(units, {
      ...base,
      evalInterval: Math.max(2, Math.round((base.evalInterval ?? 10) * D.int)),
      assaultValue: Math.round((base.assaultValue ?? 500) * D.av),
      assaultEscalationPerMin: Math.round((base.assaultEscalationPerMin ?? 60) * D.esc),
      raidUnitCap: Math.max(1, (base.raidUnitCap ?? 2) + D.raid),
      graceTicks: base.graceTicks ?? D.grace,
    }, structures, refinements);
  });
  const planetSystem = makePlanetEventSystem(units, refinements, teamFactions);
  const systems = orderSystems([
    commandSystem,
    makeMovementSystem(),
    makeHarvestSystem(economy, teamFactions, refinements),
    makeResearchSystem(),
    constructionSystem,
    powerSystem,
    makeCombatTargetingSystem(weapons),
    makeProjectileSystem(weapons),
    makeDamageSystem(weapons, refinements),
    makeHeroSystem(units),
    makeRegenSystem(teamFactions),
    makeProductionSystem(units, teamFactions, mission.id.startsWith('m') ? (loadProgress().heroKills ?? 0) : 0),
    makeStealthSystem(),
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

  // Accessibility (view-level): screen-reader announcer + persisted settings.
  const a11y = makeA11ySettings();
  const announcer = makeAnnouncer();
  // EVA (v0.52, research-driven): Westwood-style event announcements — top-centre
  // text flash + synthesized voice. Every EVA line also reaches the aria-live
  // announcer so screen readers hear identical feedback.
  const eva = makeEva(canvas, () => audio.isMuted());
  const evaSay = (line: string, dedupeMs?: number): void => {
    eva.announce(line, dedupeMs === undefined ? undefined : { dedupeMs });
    announcer.announce(line, dedupeMs ?? 8000);
  };

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
    // TP-5: the goal marker derives from the FIRST PRIMARY OBJECTIVE (the audit:
    // it always pointed at the first enemy base, misdirecting hold/reach/economy
    // missions). Region objectives point at their region; destroy objectives at the
    // first matching seeded target; anything else falls back to the enemy base.
    objectiveWorld: (() => {
      const prime = mission.objectives.find(o => (o.primary ?? true) && (!o.onlyIfChoice || o.onlyIfChoice === bootChoice));
      if (prime && (prime.type === 'hold' || prime.type === 'reach')) return tileToWorldCenter({ tx: prime.region.tx, ty: prime.region.ty });
      if (prime && prime.type === 'destroy' && prime.kind) {
        const seeded = mission.enemies.flatMap(e => [...e.buildings, ...e.units]).find(p => p.type === prime.kind);
        if (seeded) return tileToWorldCenter({ tx: seeded.tx, ty: seeded.ty });
      }
      return tileToWorldCenter(meta.objectiveTile);
    })(),
    getHover: () => input.getCursor(),                               // sidebar hover highlight
    cargoCapacity: economy.cargoCapacity,                            // HUD cargo-bar denominator
    audio,                                                           // FX diff emits SFX
    getTimeScale: () => (paused ? 0 : speed),                        // pause/speed (FG-1)
    playerFactionId: teamFactions.player.id,
    refinements,                                                     // economy depth: TECH tab
    playerPalette: teamFactions.player.palette,                      // faction colours (FG-6)
    enemyPalette: teamFactions.enemy.palette,
    enemyFactionId: teamFactions.enemy.id,                           // XP-3 faction skins
    viewerTeam,                                                      // MP seat (FG-7)
    isMuted: () => audio.isMuted(),                                  // HUD mute chip
    isStorm: () => isStormActive(state.tick),                        // XP-5 weather
    getTeamShapes: () => a11y.getTeamShapes(),                       // a11y shape markers
    unitCost: (base) => modCost(base, teamFactions.player),          // faction pricing on labels (QA BUG-2)
    powerDemandOf: (id) => structures.find(st => st.id === id)?.powerDemand ?? 0, // ⚡ warning (QA BUG-4)
    canRunTick: mp ? (t) => mp.lockstep.canRun(t) : undefined,
    onBeforeTick: mp ? (t) => { for (const i of mp.lockstep.takeDue(t)) rawQueue.push(i); } : undefined,
    onAfterTick: mp ? (t) => mp.lockstep.afterTick(t, stateHash(state)) : undefined,
  });

  // Camera panning is a pure view action — never a sim command.
  const panCamera = (dx: number, dy: number): void => {
    const c = view.getCamera();
    view.setCamera({ x: c.x + dx, y: c.y + dy, zoom: c.zoom });
  };

  // Wire input, then start rendering (input must exist before the first render frame).
  const input = makeInputHandlers(canvas, view.getCamera(), commandQueue, panCamera, structures, {
    active: () => onboarding.briefingActive(),
    dismiss: () => {
      audio.resume(); audio.startMusic(); onboarding.dismissBriefing();
      announcer.announce(`Mission started: ${mission.name}. ${mission.briefing?.objectives?.[0] ?? ''}`);
    },
  }, {
    jump: (sx, sy) => view.minimapJump(sx, sy),
  }, {
    buttonAt: (sx, sy) => view.hudButtonAt(sx, sy),
    deniedAt: (sx, sy) => view.hudDeniedAt(sx, sy),
    setTab: (tab) => view.hudSetTab(tab),
  }, {
    click: () => audio.click(), select: () => audio.select(), ack: () => audio.ack(), place: () => audio.place(),
    denied: (reason) => {
      audio.denied();
      evaSay(reason === 'funds' ? 'Insufficient funds'
        : reason === 'tier' ? 'HQ upgrade required'
        : reason === 'cells' ? 'Insufficient Cells'
        : reason === 'placement' ? 'Cannot deploy there'
        : 'Production structure required', 1500);
    },
  }, teamFactions.player.id === 'emberhand' ? 'vane' : 'warden', viewerTeam,
  (structureId, tile) => {
    const def = structures.find(st => st.id === structureId);
    return def ? validatePlacement(state, def, tile, viewerTeam).valid : false;
  });
  // ── Continue (FG-6): replay the saved command log tick-for-tick, then go live.
  // Determinism makes the fast-forward EXACT (same mission + same log → same state).
  if (params.get('continue') === '1') {
    try {
      const raw = localStorage.getItem('shardDominion.save');
      if (raw) {
        const save = JSON.parse(raw) as { missionId: string; tick: number; log: { t: number; i: Parameters<typeof rawQueue.push>[0] }[] };
        if (save.missionId === mission.id) {
          onboarding.dismissBriefing(); // straight back into the fight
          let li = 0;
          for (let t = 0; t < save.tick; t++) {
            while (li < save.log.length && save.log[li]!.t === t) { rawQueue.push(save.log[li]!.i); intentLog.push(save.log[li]!); li++; }
            simRunTick(state, systems);
          }
        }
      }
    } catch { /* corrupt save → fresh start */ }
  }

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
        getTeamShapes: () => a11y.getTeamShapes(),
        setTeamShapes: (on) => a11y.setTeamShapes(on),
        getEvaVoice: () => eva.getVoiceEnabled(),
        setEvaVoice: (on) => eva.setVoiceEnabled(on),
        onSave: () => {
          try {
            bootState.choice = mission.choice ? localStorage.getItem(`shardDominion.choice.${mission.id}`) : null;
            const payload = {
              version: 2, missionId: mission.id, faction: playerFaction, difficulty,
              tick: state.tick, log: intentLog,
              boot: bootState, // TP-4: bonus + deployment + choice reproduce on continue
            };
            localStorage.setItem('shardDominion.save', JSON.stringify(payload));
            // XP-7 replay history: last 5 saves, newest first.
            try {
              const hist = JSON.parse(localStorage.getItem('shardDominion.saves') ?? '[]') as { label: string; payload: unknown }[];
              hist.unshift({ label: `${mission.name} · tick ${state.tick}`, payload });
              localStorage.setItem('shardDominion.saves', JSON.stringify(hist.slice(0, 5)));
            } catch { /* ignore */ }
          } catch { /* storage unavailable */ }
        },
      });
    } else {
      closePauseMenu?.();
      closePauseMenu = null;
    }
  };
  const SPEEDS = [0.5, 1, 1.5, 2];
  const onHotkey = (e: KeyboardEvent): void => {
    if (onboarding.briefingActive()) return;      // briefing owns the screen
    if (e.key === 'm' || e.key === 'M') { audio.setMuted(!audio.isMuted()); return; }
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

  // ── EVA + a11y event watcher (view-level, wall-clock — the sim never sees it).
  // Once a second, diff the viewer's side and announce the transitions (Westwood
  // vocabulary, v0.52): match end, under attack, low power, unit ready,
  // construction complete, new construction options (tier-up), storage full.
  const evaPrev = { over: false, baseHp: -1, harvesters: -1, powered: true, army: -1, builtCount: -1, tier: -1, storageFull: false };
  window.setInterval(() => {
    if (onboarding.briefingActive()) return;
    const res = missionResult();
    if (res.over && !evaPrev.over) evaSay(res.winner === viewerTeam ? 'Victory. Mission complete.' : 'Defeat.', 0);
    evaPrev.over = res.over;
    if (res.over) return;
    let baseHp = 0, army = 0, harvesters = 0, supply = 0, demand = 0, builtCount = 0, tier = 1;
    let storage = 0, maxStorage = 0;
    for (const e of state.store.all()) {
      if (e.components.faction?.team !== viewerTeam) continue;
      // Base-under-attack tracks STRUCTURE hp only (RA: the base alarm never
      // fires for field skirmishes — units trading fire is normal, not an alarm).
      if (e.components.building) baseHp += Math.max(0, e.components.health?.hp ?? 0);
      if (e.components.combat && !e.components.building && (e.components.health?.hp ?? 0) > 0) army++;
      if (e.components.harvest && (e.components.health?.hp ?? 1) > 0) harvesters++;
      const pw = e.components.power;
      if (pw) { supply += pw.powerSupply; demand += pw.powerDemand; }
      const b = e.components.building;
      if (b && (b.buildProgress ?? 100) >= 100 && (e.components.health?.hp ?? 1) > 0) builtCount++;
      const t = e.components.tech;
      if (t && t.tier > tier) tier = t.tier;
      const eco = e.components.economy;
      if (b && eco) { storage += eco.refineryStorage ?? 0; maxStorage += eco.maxStorage ?? 0; }
    }
    if (evaPrev.baseHp >= 0 && baseHp < evaPrev.baseHp - 10) evaSay('Base under attack.', 15000);
    evaPrev.baseHp = baseHp;
    // Losing the economy engine is THE pivotal event — it gets its own line.
    if (evaPrev.harvesters >= 0 && harvesters < evaPrev.harvesters) evaSay('Harvester lost.', 0);
    evaPrev.harvesters = harvesters;
    const powered = supply >= demand;
    if (!powered && evaPrev.powered) evaSay('Low power. Build a Power Node.', 20000);
    evaPrev.powered = powered;
    if (evaPrev.army >= 0 && army > evaPrev.army) evaSay('Unit ready.');
    evaPrev.army = army;
    if (evaPrev.builtCount >= 0 && builtCount > evaPrev.builtCount) evaSay('Construction complete.');
    evaPrev.builtCount = builtCount;
    if (evaPrev.tier >= 1 && tier > evaPrev.tier) evaSay('New construction options.', 0);
    evaPrev.tier = tier;
    const storageFull = maxStorage > 0 && storage >= maxStorage;
    if (storageFull && !evaPrev.storageFull) evaSay('Storage full. Shard is being lost.', 30000);
    evaPrev.storageFull = storageFull;
  }, 1000);

  // ── The Choice (XP-6): the finale asks before anything moves. Reload applies it.
  if (mission.choice && !bootChoice) {
    showChoice(mission.choice.prompt, mission.choice.options, (id) => {
      localStorage.setItem(`shardDominion.choice.${mission.id}`, id);
      // Persist under a stable key too, so Act III (inheritsChoice) branches on it.
      localStorage.setItem('shardDominion.choice.campaign', id);
      location.reload();
    });
  }

  // ── Deployment (XP-3): campaign missions offer the Veteran Reserve. The panel
  // overlays the (paused) briefing; spends apply live to the seeded match. ──────
  const applyVetSquad = (): void => {
    for (const dx of [0, 1]) {
      state.store.create({
        position: tileToWorldCenter({ tx: meta.playerStartTile.tx + dx, ty: meta.playerStartTile.ty + 2 }),
        health: { hp: 20, maxHp: 20 }, armor: { armorClass: 'LIGHT' },
        movement: { target: null, path: [], speed: 12 },
        combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
        experience: { kills: 3, rank: 1 },
        faction: { team: 'player', faction: 'infantry' },
      });
    }
  };
  if (isContinue) {
    // TP-4: reproduce the ORIGINAL boot's deployment spends exactly — no panel.
    for (let i = 0; i < (savedBoot.deployment?.squads ?? 0); i++) applyVetSquad();
    if (savedBoot.deployment?.credits) grantCredits2(state, 'player', savedBoot.deployment.credits, true);
  } else if (mission.id.startsWith('m')) {
    const reserve = loadProgress().reserve ?? 0;
    if (reserve > 0) {
      showDeployment(reserve, {
        vetSquad: () => { applyVetSquad(); bootState.deployment.squads += 1; },
        credits: () => { grantCredits2(state, 'player', 200, true); bootState.deployment.credits += 200; },
      });
    }
  }

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
      // XP-3 persistence: the hero's kills + surviving veterans carry forward.
      let heroKills = 0; let vets = 0;
      for (const e of state.store.all()) {
        if (e.components.faction?.team !== 'player') continue;
        if ((e.components.health?.hp ?? 0) <= 0) continue;
        const kills = e.components.experience?.kills ?? 0;
        const kind = e.components.faction?.faction ?? '';
        if (kind === 'warden' || kind === 'vane') heroKills = Math.max(heroKills, kills);
        else if (kills >= 3) vets += 1;
      }
      recordCampaignCarry(heroKills, Math.min(3, vets));
      // Bank secondary-objective rewards for the NEXT mission (FG-4).
      if (mission.next) {
        for (const rw of mission.rewards) {
          const obj = objectivesSystem.result.objectives.find(o => o.id === rw.ifObjectiveComplete);
          if (obj?.complete) addBonus(mission.next, rw.grant.nextMissionCredits);
        }
      }
    }
    // The finale rolls credits on a win; retry/menu clears the stored choice.
    if (mission.choice) localStorage.removeItem(`shardDominion.choice.${mission.id}`);
    // The campaign FINALE is data-driven: the campaign mission with no `next`.
    // (Was hardcoded to M14; Act III now chains past it to the true ending.)
    const isFinale = mission.next === null && CAMPAIGN.some(m => m.id === mission.id);
    if (won && isFinale) {
      showCredits(() => { location.search = ''; });
      return;
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
    // TP-2/TP-5: the VIEWER team's whole ledger (QA: this used to return the first
    // bank of ANY team — after your refinery died it reported the enemy's money).
    return { credits: teamCredits(state, viewerTeam) };
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

  // A11y debug hook (liveness gate): toggle state + the last announcement.
  window.__debugA11y = () => ({ teamShapes: a11y.getTeamShapes(), lastAnnouncement: announcer.last() });
  // Placement-mode debug hook (v0.54 gate): is the ghost still in hand?
  window.__debugPlacement = () => input.getPlacementMode();
  // EVA debug hook (v0.52 gate): last line + voice toggle state.
  window.__debugEva = () => ({ last: eva.last(), voice: eva.getVoiceEnabled() });

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

  // Multiplayer status (FG-7): peer departure = victory; desync halts loudly.
  if (mp) {
    window.__debugMp = () => ({ seat: mp.seat, ...mp.lockstep.status() });
    const mpWatch = window.setInterval(() => {
      const st = mp.lockstep.status();
      if (st.peerLeft) {
        window.clearInterval(mpWatch);
        view.stop();
        showEndScreen({ won: true, missionName: 'Multiplayer', debrief: ['Your opponent has left the battlefield.'], onMenu: () => { location.search = ''; } });
      } else if (st.desynced) {
        window.clearInterval(mpWatch);
        view.stop();
        showEndScreen({ won: false, missionName: 'Multiplayer', debrief: ['DESYNC DETECTED — the simulations diverged.', 'This should be impossible; please report it.'], onMenu: () => { location.search = ''; } });
      }
    }, 500);
  }

  // Riftmaw awakenings counter (FG-5 gate).
  window.__debugRiftmaws = () => planetSystem.debugRiftmaws();

  // Trigger comm messages (FG-4 gate).
  window.__debugMessages = () => objectivesSystem.messages.map(m => ({ speaker: m.speaker, text: m.text }));

  // XP-1: tech tier + sidebar rect hooks (gates use these).
  window.__debugTier = () => ({ player: teamTier(state, 'player'), enemy: teamTier(state, 'enemy') });
  window.__debugButtonRect = (action: string) => view.hudButtonRect(action);
  window.__debugTriggersFired = () => objectivesSystem.firedTriggerIds();
  window.__debugStorm = () => isStormActive(state.tick);
  // XP-2: Cells + Resonance telemetry.
  window.__debugCells = () => {
    const sum = (team: 'player' | 'enemy') => state.store.all()
      .filter(e => e.components.faction?.team === team && e.components.economy)
      .reduce((n, e) => n + (e.components.economy!.cells ?? 0), 0);
    return { player: sum('player'), enemy: sum('enemy') };
  };
  window.__debugResonance = () => {
    const sum = (team: 'player' | 'enemy') => state.store.all()
      .filter(e => e.components.faction?.team === team && e.components.economy)
      .reduce((n, e) => n + (e.components.economy!.minedTotal ?? 0), 0);
    return { player: sum('player'), enemy: sum('enemy') };
  };

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
  skirmish_badlands: skirmishBadlandsData,
  m1_first_light: m1FirstLightData,
  m2_lifeblood: m2Data,
  m3_hold_the_line: m3Data,
  m4_the_vein: m4Data,
  m5_iron_ash: m5Data,
  m6_ashen_warlord: m6Data,
  m7_the_turn: m7Data,
  m8_ashfall: m8Data,
  m9_the_exchange: m9Data,
  m10_stormline: m10Data,
  m11_cauterize: m11Data,
  m12_renegade: m12Data,
  m13_choir_of_glass: m13Data,
  m14_first_vein: m14Data,
  m15_aftershock: m15Data,
  m16_ash_court: m16Data,
  m17_aethers_verdict: m17Data,
};
/** Campaign order (linear unlock: each mission unlocks the next). */
const CAMPAIGN: { id: string; name: string; order: number }[] = [
  { id: 'm1_first_light', name: 'First Light', order: 1 },
  { id: 'm2_lifeblood', name: 'Lifeblood', order: 2 },
  { id: 'm3_hold_the_line', name: 'Hold the Line', order: 3 },
  { id: 'm4_the_vein', name: 'The Vein', order: 4 },
  { id: 'm5_iron_ash', name: 'Iron & Ash', order: 5 },
  { id: 'm6_ashen_warlord', name: 'The Ashen Warlord', order: 6 },
  { id: 'm7_the_turn', name: 'The Turn', order: 7 },
  { id: 'm8_ashfall', name: 'Act II · Ashfall', order: 8 },
  { id: 'm9_the_exchange', name: 'Act II · The Exchange', order: 9 },
  { id: 'm10_stormline', name: 'Act II · Stormline', order: 10 },
  { id: 'm11_cauterize', name: 'Act II · Cauterize', order: 11 },
  { id: 'm12_renegade', name: 'Act II · The Renegade', order: 12 },
  { id: 'm13_choir_of_glass', name: 'Act II · Choir of Glass', order: 13 },
  { id: 'm14_first_vein', name: 'Act II · The First Vein', order: 14 },
  { id: 'm15_aftershock', name: 'Act III · Aftershock', order: 15 },
  { id: 'm16_ash_court', name: 'Act III · The Ash Court', order: 16 },
  { id: 'm17_aethers_verdict', name: 'FINALE · Aether\'s Verdict', order: 17 },
];

function openMissionSelect(): void {
  const progress = loadProgress();
  const entries = CAMPAIGN.map((m, i) => ({
    ...m,
    completed: progress.completed.includes(m.id),
    unlocked: i === 0 || progress.completed.includes(CAMPAIGN[i - 1]!.id),
  }));
  // BACK returns through openTitle() so SKIRMISH always routes via the setup screen
  // (a divergent inline callback here used to bypass it — QA BUG-1).
  showMissionSelect(entries, id => { location.search = `?mission=${id}`; }, () => openTitle());
}

// Title menu: Campaign → mission select; Skirmish → setup (map/faction/difficulty).
const SKIRMISH_MAPS = [
  { id: 'skirmish', name: 'The Valley' },
  { id: 'skirmish_badlands', name: 'Badlands' },
];
function openTitle(): void {
  showTitleMenu(id => {
    if (id === '__campaign__') { openMissionSelect(); return; }
    if (id === '__multiplayer__') {
      showMultiplayerSetup({
        onStart: (relay, room, mode) => {
          const q = new URLSearchParams({ mp: '1', room, relay });
          if (mode === '2v2') q.set('mode', '2v2');
          location.search = `?${q.toString()}`;
        },
        onBack: () => openTitle(),
      });
      return;
    }
    showSkirmishSetup({
      maps: SKIRMISH_MAPS,
      onStart: (mapId, faction, difficulty) => { location.search = `?mission=${mapId}&faction=${faction}&difficulty=${difficulty}`; },
      onBack: () => openTitle(),
    });
  }, '__campaign__');
}

function startMultiplayer(params: URLSearchParams): void {
  const relay = params.get('relay') ?? `ws://${location.hostname}:8787`;
  const room = params.get('room') ?? 'duel';
  const missionId = params.get('mission') ?? 'skirmish';
  const size = params.get('mode') === '2v2' ? 4 : 2; // XP-7
  // Waiting room (v0.54): show status + the invite link while the room fills —
  // a blank screen here made the field test feel broken before it began.
  const wait = document.createElement('div');
  wait.id = 'sd-mp-wait';
  wait.style.cssText = 'position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:rgba(4,6,10,0.96);z-index:40;color:#cfe0ee;font-family:monospace;text-align:center;';
  const inviteUrl = `${location.origin}${location.pathname}?${new URLSearchParams({ mp: '1', room, relay, ...(size === 4 ? { mode: '2v2' } : {}) }).toString()}`;
  wait.innerHTML =
    `<div style="font-size:30px;font-weight:bold;color:#ffd34d;letter-spacing:2px;">MULTIPLAYER</div>` +
    `<div id="sd-mp-status" style="font-size:14px;color:#8fb7c9;">Connecting to relay…</div>` +
    `<div style="font-size:11px;color:#9fd8a9;max-width:600px;word-break:break-all;padding:8px 12px;background:rgba(10,14,20,0.85);border:1px solid #2a3a4a;border-radius:4px;">INVITE: ${inviteUrl}</div>`;
  const backBtn = document.createElement('button');
  backBtn.textContent = 'BACK TO MENU';
  backBtn.style.cssText = 'font-family:monospace;font-size:12px;padding:6px 14px;cursor:pointer;background:rgba(20,26,34,0.9);color:#cfe0ee;border:1px solid #3a4a5a;border-radius:4px;';
  backBtn.onclick = () => { location.search = ''; };
  wait.appendChild(backBtn);
  document.body.appendChild(wait);
  const status = (t: string): void => { const e = document.getElementById('sd-mp-status'); if (e) e.textContent = t; };
  const ws = new WebSocket(relay);
  let seat = -1;
  const listeners: ((msg: string) => void)[] = [];
  ws.onmessage = (ev) => {
    const raw = String(ev.data);
    let msg: { type?: string; slot?: number } = {};
    try { msg = JSON.parse(raw); } catch { /* forwarded frame */ }
    if (msg.type === 'joined') {
      seat = msg.slot ?? 0;
      status(`In room '${room}' as seat ${seat + 1}/${size} — waiting for the other ${size - 1 === 1 ? 'player' : 'players'}… send them the invite link.`);
      return;
    }
    if (msg.type === 'start') {
      wait.remove();
      const lockstep = makeLockstep(seat, {
        send: (m) => ws.send(m),
        onMessage: (cb) => listeners.push(cb),
      }, size);
      mpSession = { lockstep, seat };
      bootstrap(MISSIONS[missionId] ?? MISSIONS.skirmish);
      return;
    }
    for (const cb of listeners) cb(raw);
  };
  ws.onopen = () => ws.send(JSON.stringify({ type: 'join', room, size }));
  ws.onclose = () => {
    if (seat === -1) status('Relay unreachable or the room is full. Check the relay address (node server/relay.mjs) and try again.');
    };
}

if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    const params = new URLSearchParams(location.search);
    const missionId = params.get('mission');
    if (params.get('mp') === '1') { startMultiplayer(params); return; }
    // Mission kit (XP-1): '__dev__' boots the mission JSON staged in localStorage
    // (by the ?dev=1 panel or a test); ?dev=1 opens the kit panel.
    if (missionId === '__dev__') {
      const raw = localStorage.getItem('shardDominion.devMission');
      if (raw) { try { bootstrap(JSON.parse(raw)); return; } catch { /* fall through */ } }
    }
    if (params.get('dev') === '1' || params.get('editor') === '1') { // XP-7: ?editor=1 = public alias
      showDevMenu({
        missions: Object.keys(MISSIONS).map(id => ({ id, name: id })),
        onLaunch: (id) => { location.search = `?mission=${id}`; },
        validate: (raw) => {
          try { loadMission(JSON.parse(raw)); return null; }
          catch (e) { return e instanceof Error ? e.message : String(e); }
        },
        onLaunchJson: (raw) => {
          localStorage.setItem('shardDominion.devMission', raw);
          location.search = '?mission=__dev__';
        },
      });
      return;
    }
    if (missionId && MISSIONS[missionId]) bootstrap(MISSIONS[missionId]);
    else openTitle();
  });
}
