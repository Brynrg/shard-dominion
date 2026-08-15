// ── View: canvas renderer, camera, rAF driver ─────────────────────────────────
// Wall-clock + rAF live here; the sim itself never reads wall-clock.
import type { SimState } from '../sim/state.js';
import type { Camera, WorldPos, TilePos } from '../sim/coords.js';
import { worldToScreen, tileToWorldCenter, worldToTile } from '../sim/coords.js';
import { TILE_SIZE_PX, TILE_SUBUNITS } from '../sim/coords.js';
import { accumulate, runTick, STEP_MS, type SimSystem } from '../sim/loop.js';
import { makeHUD } from './hud.js';
import { validatePlacement, type ConfirmationMarker } from '../sim/systems/command.js';
import type { StructureDef } from '../loaders/structures.js';
import type { WeaponsFile } from '../loaders/schemas.js';
import type { Refinement } from '../loaders/refinements.js';
import type { Onboarding } from './onboarding.js';
import type { EntityId } from '../sim/ids.js';
import { makeSpriteBank, type SpriteBank, type UnitAnim } from './spritebank.js';
import {
  hashStr, shatterFacetRect, chamferedRectPath, hexFacetPath,
  jitteredLine, buildCrackNetwork, drawCrackNetwork, type CrackBranch,
} from './facet.js';

// ── Terrain palette — "Obsidian Bloom": basalt facet field. Ground steps stay
// within a cool #16141c-ish dark family (legible but moody); impassable rock goes
// warmer/darker toward #0c0b10; Shard resource keeps its own violet-crystal family
// (deliberately NOT magenta — magenta is reserved solely for the corruption/Avarice
// alarm so the two never read as the same signal). Each tile still gets baked
// grain/detail (bakeTerrain(), NOT per-frame — see the render-cost note there).
interface TerrainStyle { base: string; dark: string; light: string; }
const TERRAIN: Record<string, TerrainStyle> = {
  SAND:       { base: '#1e1a29', dark: '#171420', light: '#332c47' },
  DEEP_SAND:  { base: '#191623', dark: '#13111a', light: '#2b2439' },
  DUNE:       { base: '#211d2c', dark: '#191623', light: '#3a3350' },
  ROCK:       { base: '#141118', dark: '#0f0d12', light: '#221d29' },
  SHARD:      { base: '#241f36', dark: '#1a1626', light: '#4a3d68' },
  IMPASSABLE: { base: '#0c0b10', dark: '#08070b', light: '#17141d' },
};
const TERRAIN_FALLBACK: TerrainStyle = { base: '#222222', dark: '#161616', light: '#333333' };
// Terrain that reads as RAISED — casts a soft ambient shadow onto lower neighbours,
// and gets the grafted contour/elevation-hint pass at its edge (bakeTerrain()).
const RAISED_TERRAIN = new Set(['ROCK', 'IMPASSABLE']);
const CONTOUR_COLOR = '#8fe8ff'; // neutral cyan-white — passability hint, never confused with magenta corruption

// Slab color (poured concrete foundation)
const SLAB_COLOR = '#6e6e73';

// ── Team accent palette — "Obsidian Bloom" faction shape language (§ FACTION
// SHAPE LANGUAGE): default 1v1 is Concord (player) vs Emberhand (enemy); XP-3
// faction skins can override either side to Shardborn via playerPalette/enemyPalette
// upstream. Kept in sync with scripts/art-gen/kit.mjs PALETTES.
interface TeamStyle { hull: string; hullDark: string; accent: string; stripe: string; }
const TEAM: Record<string, TeamStyle> = {
  player: { hull: '#c7d6e8', hullDark: '#2a2f38', accent: '#4fd6ff', stripe: '#4fd6ff' }, // Concord
  enemy:  { hull: '#ff6a2b', hullDark: '#211a17', accent: '#ffb23e', stripe: '#ffb23e' }, // Emberhand
};
const NEUTRAL_TEAM: TeamStyle = { hull: '#8a8f98', hullDark: '#33363c', accent: '#ffcf4a', stripe: '#ffffff' };

// ── Grafted designator tag lookup (faction id → 2-letter stencil code) ────────
const DESIGNATOR: Record<string, string> = {
  construction_yard: 'CY', barracks: 'BK', refinery: 'RF', power_node: 'PW',
  war_factory: 'WF', defense_turret: 'DT', aa_turret: 'AA', radar: 'RD',
  processing_plant: 'PP', skypad: 'SK', wall: 'WL', gate: 'GT', bunker: 'BN',
  infirmary: 'IF', machine_shop: 'MS', derrick: 'DK', relay: 'RL', wreck: 'WK',
  concrete_slab: 'SL', generic_structure: 'GN',
  assault_tank: 'AT', scout_vehicle: 'SV', longbow: 'LB', skimmer_apc: 'AP',
  gunship: 'GS', harvester: 'HV', infantry: 'IN', rocket_trooper: 'RT', vehicle: 'VH',
  warden: 'WD', ghostwalker: 'GW', vane: 'VN', riftmaw: 'RM',
};
function designatorFor(kind: string): string { return DESIGNATOR[kind] ?? kind.slice(0, 2).toUpperCase(); }

// Selection ring color
const SELECTION_COLOR = '#ffff00';

// Confirmation marker color
const CONFIRMATION_COLOR = '#00ff00';

// Placement ghost colors
const VALID_GHOST_COLOR = 'rgba(0, 255, 0, 0.5)';
const INVALID_GHOST_COLOR = 'rgba(255, 0, 0, 0.5)';

export interface ViewConfig {
  canvas: HTMLCanvasElement;
  simState: SimState;
  systems: readonly SimSystem[];
  mapWidth: number;
  mapHeight: number;
  /** Live confirmation markers owned by the command system (view draws them). */
  confirmationMarkers?: readonly ConfirmationMarker[];
  /** The live drag rectangle in SCREEN pixels from input (view draws it). */
  getSelectionBox?: () => { x: number; y: number; width: number; height: number } | null;
  /** Placement mode info from input (structureId + tile). */
  getPlacementMode?: () => { structureId: string; tile: TilePos } | null;
  /** Structures lookup for placement validation. */
  structures?: StructureDef[];
  /** Victory result accessor for rendering VICTORY/DEFEAT banner. */
  getVictory?: () => { over: boolean; winner: 'player' | 'enemy' | null } | null;
  /** Weapons lookup for combat unit glyph rendering. */
  weapons?: WeaponsFile;
  /** Fog accessor: returns visible and explored tile sets. If undefined, treat all visible (no regression). */
  getFog?: () => { visible: Set<string>; explored: Set<string> };
  /** Onboarding overlay (briefing + objectives). While its briefing is active the
   *  sim is paused so the player reads the mission before anything moves. */
  onboarding?: Onboarding;
  /** World position of the objective (enemy base). Marked on the radar + pointed to
   *  by an off-screen arrow so the goal is always obvious. */
  objectiveWorld?: WorldPos;
  /** Cursor position (canvas px) for hover-highlighting the sidebar build buttons. */
  getHover?: () => { sx: number; sy: number } | null;
  /** Harvester cargo capacity (economyConstants) — passed to the HUD cargo bar. */
  cargoCapacity?: number;
  /** Audio engine — the FX diff emits sound events alongside particles (view-only). */
  audio?: {
    shot(rocket: boolean): void; explosion(big: boolean): void; trainReady(): void;
    dock(): void; baseUnderAttack(): void; harvesterUnderAttack(): void;
  };
  /** Sim time scale: 1 = normal, 0 = paused, 2 = double speed. Render continues. */
  getTimeScale?: () => number;
  /** Lockstep (FG-7): return false to HOLD the sim at this tick (waiting on the
   *  remote bundle). Render continues; accumulated time is discarded. */
  canRunTick?: (tick: number) => boolean;
  /** Lockstep (FG-7): called immediately BEFORE each tick runs — the injection
   *  point for scheduled local+remote command bundles. */
  onBeforeTick?: (tick: number) => void;
  /** Lockstep (FG-7): called immediately AFTER a tick ran (bundle flush + hash). */
  onAfterTick?: (tick: number) => void;
  /** The side this screen belongs to (FG-7 seats; default 'player'). */
  viewerTeam?: 'player' | 'enemy';
  /** Live mute state for the HUD chip (M toggles). */
  isMuted?: () => boolean;
  /** Faction-adjusted unit price (QA BUG-2): label + affordability match what's charged. */
  unitCost?: (base: number) => number;
  /** Structure power demand lookup (QA BUG-4): drives the ⚡ low-power warning on build buttons. */
  powerDemandOf?: (structureId: string) => number;
  /** Phase C1: the sidebar is generated from these (see view/buildMenu.ts). */
  hudUnits?: readonly import('../loaders/units.js').UnitDef[];
  hudStructures?: readonly import('../loaders/structures.js').StructureDef[];
  hasStructure?: (structureId: string) => boolean;
  refinementBlocked?: (r: import('../loaders/refinements.js').Refinement) => 'prereq' | 'tier' | 'faction' | null;
  /** XP-3: viewer's faction id (asymmetric build menu). */
  playerFactionId?: string;
  refinements?: readonly Refinement[];
  /** XP-5: Shardstorm active (view tint + HUD chip). */
  isStorm?: () => boolean;
  /** Faction palettes (FG-6): override the default team styles. */
  playerPalette?: { hull: string; hullDark: string; accent: string; stripe: string };
  enemyPalette?: { hull: string; hullDark: string; accent: string; stripe: string };
  /** Enemy faction id (XP-3 skins: delivered faction re-renders beat team paint). */
  enemyFactionId?: string;
  /** A11y colorblind assist: draw team shape markers (○ own / ▲ hostile) on units. */
  getTeamShapes?: () => boolean;
}

export interface View {
  start(): void;
  stop(): void;
  getCamera(): Camera;
  setCamera(cam: Camera): void;
  /** Center the camera on a world position (mission boot centers on the HQ). */
  centerOn(wx: number, wy: number): void;
  /** The radar minimap rect in canvas pixels (for input hit-testing). */
  minimapRect(): { x: number; y: number; w: number; h: number };
  /** If (sx,sy) is inside the minimap, recentre the camera there and return true. */
  minimapJump(sx: number, sy: number): boolean;
  /** Hit-test the sidebar build buttons; returns "train:infantry" / "build:barracks" / null. */
  hudButtonAt(sx: number, sy: number): string | null;
  hudAnyButtonAt(sx: number, sy: number): string | null;
  hudDeniedAt(sx: number, sy: number): 'funds' | 'tier' | 'prereq' | 'cells' | 'busy' | null;
  /** Switch the sidebar tab (XP-1: STRUCT / UNITS). */
  hudSetTab(tab: 'base' | 'def' | 'units' | 'tech'): void;
  /** The live rect of a sidebar button by action id (gates + tools). */
  hudButtonRect(action: string): { x: number; y: number; w: number; h: number } | null;
  /** The sprite bank (exposed for the real-asset loader + tests). */
  readonly spriteBank: SpriteBank;
  /** Playable battlefield in canvas pixels (excludes the command sidebar + objective banner). */
  battlefieldRect(): { x: number; y: number; w: number; h: number };
}

export function makeView(cfg: ViewConfig): View {
  const { canvas, simState, systems, mapWidth, mapHeight, confirmationMarkers, getSelectionBox, getPlacementMode, structures = [], getVictory, getFog, weapons = { matrix: {}, weapons: {} }, onboarding, objectiveWorld, getHover, cargoCapacity, audio, getTimeScale } = cfg;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  // Initial camera centered on the map
  const mapCenterWorld = tileToWorldCenter({ tx: Math.floor(mapWidth / 2), ty: Math.floor(mapHeight / 2) });
  const camera: Camera = {
    x: mapCenterWorld.wx - (canvas.width / 2) * (TILE_SUBUNITS / TILE_SIZE_PX),
    y: mapCenterWorld.wy - (canvas.height / 2) * (TILE_SUBUNITS / TILE_SIZE_PX),
    zoom: 1,
  };

  let running = false;
  let accMs = 0;
  let lastTime = performance.now();
  /** 60 Hz-equivalent animation tick derived from elapsed view wall-clock (not rAF count). */
  let animTick = 0;
  let frameDtMs = 1000 / 60;
  /** View-owned last heading per entity — never written to SimState. */
  const headingById = new Map<EntityId, number>();

  // Use ctx as non-null after the check
  const context = ctx as CanvasRenderingContext2D;

  // Create HUD (clickable C&C-style build sidebar; getHover drives button highlight)
  const hud = makeHUD({ canvas, simState, camera, getHover, cargoCapacity, viewerTeam: cfg.viewerTeam, isMuted: cfg.isMuted, unitCost: cfg.unitCost, powerDemandOf: cfg.powerDemandOf, playerFactionId: cfg.playerFactionId, isStorm: cfg.isStorm, refinements: cfg.refinements, units: cfg.hudUnits, structures: cfg.hudStructures, hasStructure: cfg.hasStructure, refinementBlocked: cfg.refinementBlocked });

  // Pre-bake the directional sprite bank once (S7-2). Units get DIRS fixed-lit
  // facings; buildings get a lit body. Animated accents are drawn live on top.
  const teamStyles: Record<string, TeamStyle> = {
    player: cfg.playerPalette ?? TEAM.player!,
    enemy: cfg.enemyPalette ?? TEAM.enemy!,
  };
  const sprites = makeSpriteBank(teamStyles, NEUTRAL_TEAM, weapons);
  // XP-3 faction skins: delivered faction re-renders beat plain team paint.
  sprites.setFactionIds({
    player: cfg.playerFactionId ?? 'concord',
    enemy: cfg.enemyFactionId ?? 'concord',
  });
  // Best-effort: swap in any delivered real sprite sheets (docs/ART_ASSETS_SPEC.md).
  // No manifest / missing sheets → silently stays procedural. Exposed for testing.
  void sprites.loadManifest('art');
  // Seamless ground tileset (procedural fallback per-tile). Loads async — if the
  // terrain bake already ran off the fallback, force a rebake once the real tiles
  // land so they don't wait for the next map reload.
  void sprites.loadTerrain('art').then(() => { terrainBaked = null; });

  // ── Radar minimap (bottom-left) ─────────────────────────────────────────────
  const MM = { size: 168, margin: 12 };
  const worldW = mapWidth * TILE_SUBUNITS, worldH = mapHeight * TILE_SUBUNITS;
  let mmTerrain: HTMLCanvasElement | null = null; // cached terrain layer (baked once)

  function minimapRect(): { x: number; y: number; w: number; h: number } {
    return { x: MM.margin, y: canvas.height - MM.size - MM.margin, w: MM.size, h: MM.size };
  }

  // Bake the static terrain into an off-screen canvas at map resolution once; the
  // live layer (fog + blips + viewport) is drawn over a scaled blit each frame.
  function bakeMinimapTerrain(): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = mapWidth; cv.height = mapHeight;
    const c = cv.getContext('2d') as CanvasRenderingContext2D;
    for (let ty = 0; ty < mapHeight; ty++) {
      for (let tx = 0; tx < mapWidth; tx++) {
        const style = TERRAIN[simState.grid.terrainAt({ tx, ty })] ?? TERRAIN_FALLBACK;
        c.fillStyle = style.base;
        c.fillRect(tx, ty, 1, 1);
      }
    }
    return cv;
  }

  // XP-1: the minimap needs a living, POWERED radar on the viewer's side.
  function viewerHasRadar(): boolean {
    for (const e of simState.store.all()) {
      if (e.components.faction?.team !== (cfg.viewerTeam ?? 'player')) continue;
      if (e.components.faction?.faction !== 'radar') continue;
      if ((e.components.health?.hp ?? 0) <= 0) continue;
      if (e.components.power && e.components.power.powered === false) continue;
      return true;
    }
    return false;
  }
  // Hex-faceted radar frame (Obsidian Bloom HUD chrome), replacing the plain rect
  // backing — the CONTENT rect (x,y,w,h: terrain/fog/blips/viewport) is unchanged,
  // this only re-skins the decorative outer backing so minimapRect() hit-testing
  // and minimapJump() stay exactly as before.
  function drawRadarFrame(x: number, y: number, w: number, h: number): void {
    context.save();
    hexFacetPath(context, x - 3, y - 16, w + 6, h + 19);
    context.fillStyle = '#0a0d12';
    context.fill();
    context.strokeStyle = '#e8ecf2';
    context.globalAlpha = 0.4;
    context.lineWidth = 1;
    context.stroke();
    context.restore();
  }

  function drawMinimap(): void {
    if (!mmTerrain) mmTerrain = bakeMinimapTerrain();
    const { x, y, w, h } = minimapRect();
    if (!viewerHasRadar()) {
      // No radar → static-dark panel (classic C&C: the map is a reward for tech).
      drawRadarFrame(x, y, w, h);
      context.fillStyle = '#8fb7c9'; context.font = '11px monospace'; context.textAlign = 'left';
      context.textBaseline = 'alphabetic';
      context.fillText('RADAR', x, y - 5);
      context.fillStyle = '#05070a';
      context.fillRect(x, y, w, h);
      context.fillStyle = '#4a5a68'; context.font = 'bold 11px monospace';
      context.fillText('NO RADAR', x + w / 2 - 28, y + h / 2 - 2);
      context.font = '10px monospace';
      context.fillText('build one (J, T2)', x + w / 2 - 44, y + h / 2 + 12);
      return;
    }
    const fog = getFog?.();

    // Frame + backing.
    drawRadarFrame(x, y, w, h);
    context.fillStyle = '#8fb7c9'; context.font = '11px monospace'; context.textAlign = 'left';
    context.textBaseline = 'alphabetic';
    context.fillText('RADAR', x, y - 5);

    // Terrain (nearest-neighbour scale so tiles stay crisp).
    const smooth = context.imageSmoothingEnabled;
    context.imageSmoothingEnabled = false;
    context.drawImage(mmTerrain, x, y, w, h);
    context.imageSmoothingEnabled = smooth;

    // Fog: darken explored, black-out unexplored.
    if (fog) {
      const cw = w / mapWidth, ch = h / mapHeight;
      for (let ty = 0; ty < mapHeight; ty++) {
        for (let tx = 0; tx < mapWidth; tx++) {
          const key = `${tx},${ty}`;
          if (fog.explored.has(key)) { if (fog.visible.has(key)) continue; context.fillStyle = 'rgba(0,0,0,0.45)'; }
          else context.fillStyle = '#05070a';
          context.fillRect(x + tx * cw, y + ty * ch, Math.ceil(cw), Math.ceil(ch));
        }
      }
    }

    // Entity blips (skip anything the player can't see).
    for (const e of simState.store.all()) {
      const pos = e.components.position;
      if (!pos) continue;
      const t = worldToTile(pos);
      if (fog && !fog.visible.has(`${t.tx},${t.ty}`)) continue;
      const team = e.components.faction?.team;
      const isBldg = !!e.components.building;
      context.fillStyle = team === 'player' ? '#5fd0ff' : team === 'enemy' ? '#ff5a4a' : '#d8d8d8';
      const bx = x + (pos.wx / worldW) * w, by = y + (pos.wy / worldH) * h;
      const s = isBldg ? 3 : 2;
      context.fillRect(bx - s / 2, by - s / 2, s, s);
    }

    // Objective marker: the enemy base you must destroy (always shown — it's the goal).
    if (objectiveWorld) {
      const ox = x + (objectiveWorld.wx / worldW) * w, oy = y + (objectiveWorld.wy / worldH) * h;
      context.fillStyle = '#ff4a3d';
      context.beginPath(); context.moveTo(ox, oy - 5); context.lineTo(ox + 5, oy); context.lineTo(ox, oy + 5); context.lineTo(ox - 5, oy); context.closePath(); context.fill();
      context.strokeStyle = '#ffd34d'; context.lineWidth = 1; context.stroke();
    }

    // Viewport rectangle (where the main camera is looking). Width scales with zoom.
    const WPP = TILE_SUBUNITS / TILE_SIZE_PX;
    const vx = x + (camera.x / worldW) * w;
    const vy = y + (camera.y / worldH) * h;
    const vw = (canvas.width * WPP / camera.zoom / worldW) * w;
    const vh = (canvas.height * WPP / camera.zoom / worldH) * h;
    context.strokeStyle = '#ffffff'; context.lineWidth = 1;
    context.strokeRect(x + Math.max(0, vx - x), y + Math.max(0, vy - y), Math.min(w, vw), Math.min(h, vh));
    context.strokeStyle = '#00e5ff'; context.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
  }

  // Off-screen pointer to the objective (enemy base) — a red chevron at the screen
  // edge + "ENEMY BASE" label, so the player always knows where the goal is.
  function drawObjectivePointer(): void {
    if (!objectiveWorld) return;
    if (getVictory?.()?.over) return;
    const s = worldToScreen(objectiveWorld, camera);
    const W = canvas.width, H = canvas.height;
    const onScreen = s.sx >= 0 && s.sx <= W && s.sy >= 0 && s.sy <= H;
    if (onScreen) return; // you can see the base — no arrow needed
    const cxp = W / 2, cyp = H / 2;
    const ang = Math.atan2(s.sy - cyp, s.sx - cxp);
    const px = Math.max(44, Math.min(W - 220, s.sx)); // keep clear of the right HUD
    const py = Math.max(44, Math.min(H - 44, s.sy));
    context.save();
    context.translate(px, py);
    context.rotate(ang);
    context.fillStyle = '#ff4a3d';
    context.beginPath(); context.moveTo(13, 0); context.lineTo(-9, -10); context.lineTo(-9, 10); context.closePath(); context.fill();
    context.strokeStyle = '#ffd34d'; context.lineWidth = 1.5; context.stroke();
    context.restore();
    context.fillStyle = '#ffd34d'; context.font = 'bold 11px monospace'; context.textAlign = 'center'; context.textBaseline = 'top';
    context.fillText('ENEMY BASE', px, py + 12);
    context.textBaseline = 'alphabetic';
  }

  // Recentre the camera on a world point (clamped so the view stays on the map).
  function centerOn(wx: number, wy: number): void {
    const halfW = (canvas.width / 2) * (TILE_SUBUNITS / TILE_SIZE_PX);
    const halfH = (canvas.height / 2) * (TILE_SUBUNITS / TILE_SIZE_PX);
    Object.assign(camera, { x: wx - halfW, y: wy - halfH, zoom: camera.zoom });
  }

  // ── Camera navigation (C&C/RA): edge-scroll + clamp to the map ──────────────
  // Move the cursor to a screen edge → the view scrolls that way (works on any
  // device, unlike middle-drag). Speed is elapsed-time based so 30/60/120 Hz
  // displays pan at the same world units per second.
  let edgeSince = 0; // wall-clock when the cursor entered the edge band (0 = not in it)
  const EDGE_SCROLL_WU_PER_SEC = 11 * (TILE_SUBUNITS / TILE_SIZE_PX) * 60; // matches prior 60 Hz feel
  function edgeScroll(dtMs: number): void {
    if (onboarding?.briefingActive()) return;
    const cur = getHover?.();
    if (!cur) { edgeSince = 0; return; }
    // Dead zones (QA polish): hovering the COMMAND sidebar or the radar must not
    // scroll — the old 28px band overlapped the build buttons.
    const p = hud.panelRect();
    if (cur.sx >= p.x && cur.sx <= p.x + p.w && cur.sy >= p.y && cur.sy <= p.y + p.h) { edgeSince = 0; return; }
    const mm = minimapRect();
    if (cur.sx >= mm.x && cur.sx <= mm.x + mm.w && cur.sy >= mm.y && cur.sy <= mm.y + mm.h) { edgeSince = 0; return; }
    const M = 16;                       // edge band (px) — was 28; too grabby (QA)
    const W = canvas.width, H = canvas.height;
    const inBand = cur.sx <= M || cur.sx >= W - M || cur.sy <= M || cur.sy >= H - M;
    if (!inBand) { edgeSince = 0; return; }
    // Dwell: scroll only after ~180ms in the band, so drifting across an edge on the
    // way to a button doesn't yank the view.
    const now = performance.now();
    if (edgeSince === 0) { edgeSince = now; return; }
    if (now - edgeSince < 180) return;
    // Depth into the band (0 at the inner edge, 1 at the screen edge) tames overshoot.
    const depthX = cur.sx <= M ? (M - cur.sx) / M : cur.sx >= W - M ? (cur.sx - (W - M)) / M : 0;
    const depthY = cur.sy <= M ? (M - cur.sy) / M : cur.sy >= H - M ? (cur.sy - (H - M)) / M : 0;
    const spd = (EDGE_SCROLL_WU_PER_SEC / camera.zoom) * (dtMs / 1000);
    let dx = 0, dy = 0;
    if (cur.sx <= M) dx = -spd * (0.45 + 0.55 * depthX);
    else if (cur.sx >= W - M) dx = spd * (0.45 + 0.55 * depthX);
    if (cur.sy <= M) dy = -spd * (0.45 + 0.55 * depthY);
    else if (cur.sy >= H - M) dy = spd * (0.45 + 0.55 * depthY);
    if (dx || dy) Object.assign(camera, { x: camera.x + dx, y: camera.y + dy, zoom: camera.zoom });
  }
  // Keep the view on the map. A viewport larger than the map centres that axis
  // instead of sliding into a black void; ordinary pan may peek a quarter-tile.
  function clampCamera(): void {
    const WPP = TILE_SUBUNITS / TILE_SIZE_PX;
    const visW = (canvas.width * WPP) / camera.zoom, visH = (canvas.height * WPP) / camera.zoom;
    const pad = TILE_SUBUNITS * 0.25;
    let x = camera.x, y = camera.y;
    if (visW >= worldW) x = (worldW - visW) / 2;
    else x = Math.max(-pad, Math.min(worldW - visW + pad, camera.x));
    if (visH >= worldH) y = (worldH - visH) / 2;
    else y = Math.max(-pad, Math.min(worldH - visH + pad, camera.y));
    if (x !== camera.x || y !== camera.y) Object.assign(camera, { x, y, zoom: camera.zoom });
  }

  function battlefieldRect(): { x: number; y: number; w: number; h: number } {
    const p = hud.panelRect();
    const top = 40; // objective banner strip
    return { x: 0, y: top, w: Math.max(0, p.x), h: Math.max(0, canvas.height - top) };
  }

  // ── Combat FX (view-only juice) ─────────────────────────────────────────────
  // Muzzle flashes when a unit fires and explosions when one dies. Detected by
  // diffing sim state frame-to-frame (no sim/contract changes). The view MAY use
  // wall-clock + randomness (the sim may not) — particles live here, not in sim.
  interface Particle {
    wx: number; wy: number; vx: number; vy: number;
    life: number; max: number; size: number; kind: 'flash' | 'debris' | 'ring' | 'beam' | 'spark';
    hue: string;
    bx?: number; by?: number; // beam endpoint (world), for 'beam' tracers
  }
  const particles: Particle[] = [];
  const prevAlive = new Map<EntityId, { wx: number; wy: number; team: string; big: boolean }>();
  const prevCooldown = new Map<EntityId, number>();
  const firingUntil = new Map<EntityId, number>();     // render-frame deadline for the §0.6 fire strip
  const prevHp = new Map<EntityId, number>();          // player damage → under-attack alerts
  const prevHarvest = new Map<EntityId, string>();     // DOCK→SEEK transition → deposit chime
  let fxSeeded = false;

  function spawnExplosion(wx: number, wy: number, big: boolean): void {
    const n = big ? 22 : 12;
    particles.push({ wx, wy, vx: 0, vy: 0, life: big ? 26 : 16, max: big ? 26 : 16, size: big ? 30 : 17, kind: 'ring', hue: '#ffd36b' });
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (big ? 3.2 : 2.1) * (0.4 + Math.random());
      particles.push({
        wx, wy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 14 + Math.random() * 16, max: 30, size: (big ? 4 : 3) * (0.6 + Math.random()),
        kind: 'debris', hue: Math.random() < 0.5 ? '#ff8a3d' : (Math.random() < 0.5 ? '#ffd36b' : '#7a6650'),
      });
    }
  }
  function spawnMuzzle(wx: number, wy: number, ang: number, rocket: boolean): void {
    const sp = rocket ? 2.6 : 3.4;
    particles.push({
      wx, wy, vx: Math.cos(ang) * sp * 0.3, vy: Math.sin(ang) * sp * 0.3,
      life: rocket ? 9 : 5, max: rocket ? 9 : 5, size: rocket ? 6 : 5, kind: 'flash',
      hue: rocket ? '#ffce54' : '#fff2b0',
    });
    for (let i = 0; i < (rocket ? 5 : 3); i++) {
      const j = ang + (Math.random() - 0.5) * 0.7;
      particles.push({
        wx, wy, vx: Math.cos(j) * sp, vy: Math.sin(j) * sp,
        life: 5 + Math.random() * 6, max: 11, size: 1.6 + Math.random() * 1.6, kind: 'debris',
        hue: '#ffb04a',
      });
    }
  }
  // A brief tracer streak from the muzzle to the target (sells "firing").
  function spawnTracer(x1: number, y1: number, x2: number, y2: number, hue: string): void {
    particles.push({ wx: x1, wy: y1, vx: 0, vy: 0, bx: x2, by: y2, life: 4, max: 4, size: 1.6, kind: 'beam', hue });
  }
  // Purple Shard flecks kicked up while a harvester is mining ("harvesting").
  function spawnHarvestSpark(wx: number, wy: number): void {
    particles.push({
      wx, wy, vx: (Math.random() - 0.5) * 0.7, vy: -1.2 * (0.5 + Math.random()),
      life: 12 + Math.random() * 12, max: 24, size: 1.6 + Math.random() * 1.8, kind: 'spark',
      hue: Math.random() < 0.5 ? '#c9a6ff' : '#e6d4ff',
    });
  }

  // Diff sim state each tick: find deaths (id gone) → explosion; find shots
  // (cooldown jumped back up) → muzzle flash at the barrel toward the target.
  function detectCombatFx(): void {
    const alive = new Set<EntityId>();
    for (const e of simState.store.all()) {
      alive.add(e.id);
      const pos = e.components.position;
      if (!pos) continue;
      const team = e.components.faction?.team ?? 'neutral';
      const big = !!e.components.building;
      prevAlive.set(e.id, { wx: pos.wx, wy: pos.wy, team, big });

      // Muzzle: cooldown rose since last tick ⇒ this unit just fired.
      const cd = e.components.combat?.cooldownRemaining ?? 0;
      const prev = prevCooldown.get(e.id) ?? 0;
      if (fxSeeded && cd > prev + 0.001 && e.components.combat) {
        const rocket = e.components.combat.weaponId
          ? weapons?.weapons[e.components.combat.weaponId]?.type === 'ROCKET' : false;
        const ang = facingAngle(e, pos);
        const muzWx = pos.wx + Math.cos(ang) * TILE_SUBUNITS * 0.35;
        const muzWy = pos.wy + Math.sin(ang) * TILE_SUBUNITS * 0.35;
        spawnMuzzle(muzWx, muzWy, ang, rocket);
        firingUntil.set(e.id, animTick + 24); // ~0.4s window for the fire-strip pose
        audio?.shot(rocket);
        // Tracer to the target so a shot reads clearly.
        const tgtId = e.components.combat.targetId;
        const tp = tgtId != null ? simState.store.get(tgtId)?.components.position : null;
        if (tp) spawnTracer(muzWx, muzWy, tp.wx, tp.wy, rocket ? '#ffce54' : '#fff2b0');
      }
      // ── Audio-readability cues (schema's cue set, finally implemented) ──────
      if (fxSeeded && team === 'player') {
        // A brand-new player unit (not seeded at boot) ⇒ training complete.
        if (!prevCooldown.has(e.id) && !big && (e.components.combat || e.components.harvest)) audio?.trainReady();
        // Player entity LOST hp since last tick ⇒ under attack (engine self-throttles).
        const hp = e.components.health?.hp;
        if (hp != null) {
          const ph = prevHp.get(e.id);
          if (ph != null && hp < ph) {
            if (e.components.faction?.faction === 'harvester') audio?.harvesterUnderAttack();
            else if (big) audio?.baseUnderAttack();
          }
          prevHp.set(e.id, hp);
        }
        // Harvester finished depositing (DOCK → SEEK) ⇒ credits chime.
        const hs = e.components.harvest?.state;
        if (hs) {
          if (prevHarvest.get(e.id) === 'DOCK' && hs === 'SEEK') audio?.dock();
          prevHarvest.set(e.id, hs);
        }
      }
      // Harvesting: kick up Shard flecks while a harvester is actively mining.
      if (fxSeeded && e.components.harvest?.state === 'HARVEST' && Math.random() < 0.4) {
        spawnHarvestSpark(pos.wx + (Math.random() - 0.5) * TILE_SUBUNITS * 0.5, pos.wy + (Math.random() - 0.5) * TILE_SUBUNITS * 0.3);
      }
      prevCooldown.set(e.id, cd);
    }
    // Deaths: anything we saw last tick that's gone now.
    if (fxSeeded) {
      for (const [id, info] of prevAlive) {
        if (!alive.has(id)) { spawnExplosion(info.wx, info.wy, info.big); spawnDecal(info.wx, info.wy, info.big); audio?.explosion(info.big); }
      }
    }
    for (const id of prevAlive.keys()) if (!alive.has(id)) { prevAlive.delete(id); prevCooldown.delete(id); prevHp.delete(id); prevHarvest.delete(id); firingUntil.delete(id); }
    fxSeeded = true;
  }

  // ── Death decals (FG-1 "death feel"): scorch + wreck marks that persist and
  // fade where things died, drawn UNDER entities. View-only; frame-based life.
  interface Decal { wx: number; wy: number; big: boolean; life: number; max: number;
    chunks: { dx: number; dy: number; w: number; h: number; hue: string }[] }
  const decals: Decal[] = [];
  function spawnDecal(wx: number, wy: number, big: boolean): void {
    const chunks = [];
    const n = big ? 7 : 3;
    for (let i = 0; i < n; i++) {
      chunks.push({
        dx: (Math.random() - 0.5) * (big ? 22 : 10),
        dy: (Math.random() - 0.5) * (big ? 18 : 8),
        w: 2 + Math.random() * (big ? 6 : 3),
        h: 2 + Math.random() * (big ? 5 : 3),
        hue: Math.random() < 0.5 ? '#3a332c' : '#57493a',
      });
    }
    const max = big ? 1400 : 700; // frames (~23s / ~12s at 60fps)
    decals.push({ wx, wy, big, life: max, max, chunks });
    if (decals.length > 60) decals.shift(); // cap
  }
  function stepDecals(tickAmt: number): void {
    for (let i = decals.length - 1; i >= 0; i--) {
      const d = decals[i]!;
      d.life -= tickAmt;
      if (d.life <= 0) decals.splice(i, 1);
    }
  }
  function drawDecals(): void {
    for (const d of decals) {
      const p = worldToScreen({ wx: d.wx, wy: d.wy }, camera);
      const a = Math.min(0.55, (d.life / d.max) * 0.7);
      const r = (d.big ? 16 : 8) * camera.zoom;
      context.save();
      context.globalAlpha = a;
      // Prefer scorched terrain stamps when loaded; fall back to procedural ellipse.
      const stamp = sprites.getNamedTerrainTile(d.big ? 'scorched' : 'scorched_2')
        ?? sprites.getNamedTerrainTile('scorched');
      if (stamp) {
        const sz = r * 2.4;
        context.drawImage(stamp, p.sx - sz / 2, p.sy - sz * 0.35, sz, sz * 0.7);
      } else {
        context.fillStyle = '#14100c';
        context.beginPath();
        context.ellipse(p.sx, p.sy, r, r * 0.7, 0, 0, Math.PI * 2);
        context.fill();
      }
      for (const c of d.chunks) {
        context.fillStyle = c.hue;
        context.fillRect(p.sx + c.dx * camera.zoom, p.sy + c.dy * camera.zoom, c.w * camera.zoom, c.h * camera.zoom);
      }
      context.restore();
    }
  }

  function stepParticles(tickAmt: number): void {
    const WPP = TILE_SUBUNITS / TILE_SIZE_PX;
    const damp = Math.pow(0.9, tickAmt);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (!p) continue;
      p.wx += p.vx * WPP * tickAmt;
      p.wy += p.vy * WPP * tickAmt;
      p.vx *= damp; p.vy *= damp;
      p.life -= tickAmt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawParticles(): void {
    for (const p of particles) {
      const s = worldToScreen({ wx: p.wx, wy: p.wy }, camera);
      const t = Math.max(0, p.life / p.max);
      context.globalAlpha = p.kind === 'ring' ? t * 0.6 : (p.kind === 'beam' ? t * 0.85 : t);
      if (p.kind === 'ring') {
        context.strokeStyle = p.hue;
        context.lineWidth = 2.5;
        context.beginPath();
        context.arc(s.sx, s.sy, p.size * (1 - t) + 3, 0, Math.PI * 2);
        context.stroke();
      } else if (p.kind === 'flash') {
        context.fillStyle = p.hue;
        context.beginPath();
        context.arc(s.sx, s.sy, p.size * (0.6 + t * 0.6), 0, Math.PI * 2);
        context.fill();
      } else if (p.kind === 'beam') {
        // Tracer line muzzle → target.
        const e = worldToScreen({ wx: p.bx ?? p.wx, wy: p.by ?? p.wy }, camera);
        context.strokeStyle = p.hue; context.lineWidth = p.size;
        context.beginPath(); context.moveTo(s.sx, s.sy); context.lineTo(e.sx, e.sy); context.stroke();
      } else if (p.kind === 'spark') {
        context.fillStyle = p.hue;
        context.beginPath(); context.arc(s.sx, s.sy, p.size * (0.5 + t * 0.6), 0, Math.PI * 2); context.fill();
      } else {
        context.fillStyle = p.hue;
        context.fillRect(s.sx - p.size / 2, s.sy - p.size / 2, p.size, p.size);
      }
    }
    context.globalAlpha = 1;
  }

  // Draw selection rings around selected entities
  // Veterancy chevrons (FG-5): gold marks above ranked units; cyan halo = the hero.
  function drawRankChevrons() {
    for (const e of simState.store.all()) {
      const pos = e.components.position;
      if (!pos) continue;
      const isHero = e.components.faction?.faction === 'warden';
      const rank = e.components.experience?.rank ?? 0;
      if (!isHero && rank <= 0) continue;
      const p = worldToScreen(pos, camera);
      if (isHero) {
        context.strokeStyle = 'rgba(0,229,255,0.65)';
        context.lineWidth = 1.5;
        context.beginPath();
        context.arc(p.sx, p.sy, 14 * camera.zoom, 0, Math.PI * 2);
        context.stroke();
      }
      context.strokeStyle = '#ffd34d';
      context.lineWidth = 2 * camera.zoom;
      for (let r = 0; r < rank; r++) {
        const y = p.sy - (16 + r * 5) * camera.zoom;
        context.beginPath();
        context.moveTo(p.sx - 4 * camera.zoom, y);
        context.lineTo(p.sx, y - 3 * camera.zoom);
        context.lineTo(p.sx + 4 * camera.zoom, y);
        context.stroke();
      }
    }
  }

  // Colorblind assist (a11y): when enabled, every UNIT carries a shape that tells
  // its side without hue — viewer's own = ○ above the chassis, hostile = ▲.
  // Dual-stroked (dark under light) so it reads on any hull or terrain.
  function drawTeamShapeMarkers() {
    if (!cfg.getTeamShapes?.()) return;
    const viewer = cfg.viewerTeam ?? 'player';
    for (const e of simState.store.all()) {
      const pos = e.components.position;
      const team = e.components.faction?.team;
      if (!pos || !team || e.components.building) continue;
      if ((e.components.health?.hp ?? 1) <= 0) continue;
      const p = worldToScreen(pos, camera);
      const r = 3.5 * camera.zoom;
      const y = p.sy - 11 * camera.zoom;
      for (const [stroke, width] of [['rgba(0,0,0,0.85)', 3.5], ['#ffffff', 1.5]] as const) {
        context.strokeStyle = stroke;
        context.lineWidth = width * camera.zoom;
        context.beginPath();
        if (team === viewer) {
          context.arc(p.sx, y, r, 0, Math.PI * 2);
        } else {
          context.moveTo(p.sx, y - r);
          context.lineTo(p.sx + r, y + r);
          context.lineTo(p.sx - r, y + r);
          context.closePath();
        }
        context.stroke();
      }
    }
  }

  function drawSelectionRings() {
    const selected: Array<ReturnType<typeof simState.store.all>[number]> = [];
    for (const e of simState.store.all()) {
      if (e.components.selection?.selected && e.components.position) selected.push(e);
    }
    const nSel = selected.length;
    const showTags = nSel > 0 && nSel <= 4;
    const zRing = Math.min(camera.zoom, 1.25);
    const lineW = Math.min(2.25, 1.2 + 0.4 * zRing);

    // Deduplicate queued routes: one path from the selected-group centroid.
    const queued = selected.filter(e => {
      const mv = e.components.movement;
      return !!mv?.target && (mv.orderQueue?.length ?? 0) > 0;
    });
    const bf = battlefieldRect();
    if (queued.length > 0) {
      context.save();
      context.beginPath();
      context.rect(bf.x, bf.y, bf.w, bf.h);
      context.clip();
      const attack = queued.some(e => e.components.movement?.attackMove ||
        (e.components.movement?.orderQueue ?? []).some(w => w.attackMove));
      let sx = 0, sy = 0;
      for (const e of queued) {
        const p = worldToScreen(e.components.position!, camera);
        sx += p.sx; sy += p.sy;
      }
      sx /= queued.length; sy /= queued.length;
      const maxLegs = queued.reduce((m, e) => Math.max(m, 1 + (e.components.movement?.orderQueue?.length ?? 0)), 0);
      const stops: { sx: number; sy: number }[] = [];
      for (let i = 0; i < maxLegs; i++) {
        let wx = 0, wy = 0, c = 0;
        for (const e of queued) {
          const mv = e.components.movement!;
          const w = i === 0 ? mv.target : mv.orderQueue?.[i - 1];
          if (!w) continue;
          wx += w.wx; wy += w.wy; c += 1;
        }
        if (c === 0) break;
        stops.push(worldToScreen({ wx: wx / c, wy: wy / c }, camera));
      }
      context.strokeStyle = attack ? 'rgba(255,140,60,0.75)' : 'rgba(255,255,0,0.55)';
      context.fillStyle = attack ? 'rgba(255,140,60,0.85)' : 'rgba(255,255,0,0.75)';
      context.lineWidth = lineW;
      context.setLineDash([5, 5]);
      context.beginPath();
      context.moveTo(sx, sy);
      for (const s of stops) context.lineTo(s.sx, s.sy);
      context.stroke();
      context.setLineDash([]);
      for (const s of stops) {
        context.beginPath();
        context.arc(s.sx, s.sy, Math.min(3.5, 2.5 * zRing), 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    }

    for (const e of selected) {
      const pos = e.components.position!;
      const screenPos = worldToScreen(pos, camera);
      const size = TILE_SIZE_PX * 0.8 * zRing;

      // Rally flag (FG-1): a selected producer shows where its units will gather —
      // dashed line from the building to a small pennant at the rally point.
      const rally = e.components.production?.rally;
      if (rally) {
        const r = worldToScreen(rally, camera);
        context.save();
        context.beginPath();
        context.rect(bf.x, bf.y, bf.w, bf.h);
        context.clip();
        context.strokeStyle = 'rgba(120,255,160,0.75)';
        context.lineWidth = lineW;
        context.setLineDash([4, 4]);
        context.beginPath();
        context.moveTo(screenPos.sx, screenPos.sy);
        context.lineTo(r.sx, r.sy);
        context.stroke();
        context.setLineDash([]);
        // Pennant: pole + triangular flag.
        context.beginPath();
        context.moveTo(r.sx, r.sy);
        context.lineTo(r.sx, r.sy - 14 * zRing);
        context.stroke();
        context.fillStyle = 'rgba(120,255,160,0.9)';
        context.beginPath();
        context.moveTo(r.sx, r.sy - 14 * zRing);
        context.lineTo(r.sx + 9 * zRing, r.sy - 11 * zRing);
        context.lineTo(r.sx, r.sy - 8 * zRing);
        context.closePath();
        context.fill();
        context.restore();
      }

      // Draw selection ring (capped so zoom cannot dominate the sprite).
      context.strokeStyle = SELECTION_COLOR;
      context.lineWidth = lineW;
      const ringR = Math.min(size / 2 + 3, TILE_SIZE_PX * 0.55);
      context.beginPath();
      context.arc(screenPos.sx, screenPos.sy, ringR, 0, Math.PI * 2);
      context.stroke();

      const kind = e.components.faction?.faction;
      if (showTags && kind) drawDesignatorTag(designatorFor(kind), screenPos.sx, screenPos.sy, ringR);
    }
  }

  // Anchored at the NE point of the selection ring, chamfered like the HUD chrome.
  function drawDesignatorTag(code: string, cx: number, cy: number, ringR: number): void {
    const ax = cx + ringR * Math.SQRT1_2, ay = cy - ringR * Math.SQRT1_2;
    const w = 22, h = 14;
    context.save();
    chamferedRectPath(context, ax - 2, ay - h, w, h, 3);
    context.fillStyle = 'rgba(8,9,12,0.82)';
    context.fill();
    context.strokeStyle = SELECTION_COLOR;
    context.lineWidth = 1;
    context.stroke();
    context.fillStyle = '#e8ecf2';
    context.font = 'bold 9px monospace';
    context.textAlign = 'left';
    context.textBaseline = 'middle';
    context.fillText(code, ax + 2, ay - h / 2 + 1);
    context.restore();
  }

  // Draw the live box-selection rectangle (screen pixels, provided by input).
  function drawBoxSelection() {
    const box = getSelectionBox?.();
    if (!box || (box.width === 0 && box.height === 0)) return;
    const { x, y, width, height } = box;

    context.strokeStyle = SELECTION_COLOR;
    context.lineWidth = 2;
    context.setLineDash([5, 5]);
    context.strokeRect(x, y, width, height);
    context.setLineDash([]);

    // Fill with semi-transparent color
    context.fillStyle = 'rgba(255, 255, 0, 0.2)';
    context.fillRect(x, y, width, height);
  }

  // Draw confirmation markers (owned by the command system, passed in via cfg).
  function drawConfirmationMarkers() {
    if (!confirmationMarkers || confirmationMarkers.length === 0) return;

    for (const marker of confirmationMarkers) {
      const screenPos = worldToScreen(marker.target, camera);
      const progress = marker.remaining / 10; // 10 ticks lifetime

      context.strokeStyle = CONFIRMATION_COLOR;
      context.lineWidth = 2;
      context.globalAlpha = progress;
      context.beginPath();
      context.arc(screenPos.sx, screenPos.sy, 10, 0, Math.PI * 2);
      context.stroke();
      context.globalAlpha = 1;
    }
  }

  // Draw health bars above units with hp < maxHp
  function drawHealthBars() {
    for (const e of simState.store.all()) {
      const health = e.components.health;
      if (!health || health.hp >= health.maxHp) continue;
      const pos = e.components.position;
      if (!pos) continue;

      const screenPos = worldToScreen(pos, camera);
      const barWidth = TILE_SIZE_PX * 0.8 * camera.zoom;
      const barHeight = 4;
      const barX = screenPos.sx - barWidth / 2;
      const barY = screenPos.sy - TILE_SIZE_PX * 0.5 * camera.zoom;

      // Red background
      context.fillStyle = '#ff0000';
      context.fillRect(barX, barY, barWidth, barHeight);

      // Green fill based on hp/maxHp
      const hpRatio = Math.max(0, Math.min(1, health.hp / health.maxHp));
      context.fillStyle = '#00ff00';
      context.fillRect(barX, barY, barWidth * hpRatio, barHeight);
    }
  }

  // Draw slab tiles
  function drawSlabs() {
    const { width, height } = simState.grid;
    for (let ty = 0; ty < height; ty++) {
      for (let tx = 0; tx < width; tx++) {
        // Check if this tile has a slab entity
        let hasSlab = false;
        for (const e of simState.store.all()) {
          const pos = e.components.position;
          if (!pos) continue;
          const entityTile = worldToTile(pos);
          if (entityTile.tx === tx && entityTile.ty === ty) {
            const faction = e.components.faction;
            if (faction?.faction === 'concrete_slab') {
              hasSlab = true;
              break;
            }
          }
        }

        if (hasSlab) {
          const tilePos = tileToWorldCenter({ tx, ty });
          const screenPos = worldToScreen(tilePos, camera);
          const ss = TILE_SIZE_PX * camera.zoom;
          context.fillStyle = SLAB_COLOR;
          context.fillRect(
            Math.floor(screenPos.sx - ss / 2),
            Math.floor(screenPos.sy - ss / 2),
            Math.ceil(ss) + 1,
            Math.ceil(ss) + 1,
          );
        }
      }
    }
  }

  // Draw placement ghost
  function drawPlacementGhost() {
    const placement = getPlacementMode?.();
    if (!placement || !structures) return;

    const structure = structures.find((s) => s.id === placement.structureId);
    if (!structure) return;

    // Validity + reason come from the ONE contract validator (no duplicated rules).
    const result = validatePlacement(simState, structure, placement.tile, cfg.viewerTeam ?? 'player');
    const valid = result.valid;
    const reason = result.reason ?? '';

    // Draw ghost
    const ghostColor = valid ? VALID_GHOST_COLOR : INVALID_GHOST_COLOR;
    const tilePos = tileToWorldCenter(placement.tile);
    const screenPos = worldToScreen(tilePos, camera);
    const size = TILE_SIZE_PX * structure.footprint.w * camera.zoom;

    context.fillStyle = ghostColor;
    context.fillRect(
      Math.floor(screenPos.sx - size / 2),
      Math.floor(screenPos.sy - size / 2),
      size,
      size,
    );

    // Draw border
    context.strokeStyle = valid ? '#00ff00' : '#ff0000';
    context.lineWidth = 2;
    context.strokeRect(
      Math.floor(screenPos.sx - size / 2),
      Math.floor(screenPos.sy - size / 2),
      size,
      size,
    );

    // Draw reason text if invalid
    if (!valid && reason) {
      context.fillStyle = '#ffffff';
      context.font = '12px monospace';
      context.textBaseline = 'top';
      context.fillText(reason, screenPos.sx - size / 2, screenPos.sy - size / 2 - 15);
    }
  }

  // Draw VICTORY/DEFEAT banner
  function drawVictoryBanner() {
    const victory = getVictory?.();
    if (!victory || !victory.over) return;

    const viewer = cfg.viewerTeam ?? 'player';
    const bannerText = victory.winner === viewer ? 'VICTORY' : 'DEFEAT';
    const bannerColor = victory.winner === viewer ? '#00ff00' : '#ff0000';

    context.fillStyle = 'rgba(0, 0, 0, 0.7)';
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = bannerColor;
    context.font = 'bold 60px monospace';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(bannerText, canvas.width / 2, canvas.height / 2);
  }

  // Deterministic per-tile hash in [0,1) (stable across frames — texture doesn't crawl).
  function tileHash(tx: number, ty: number, salt: number): number {
    let h = (tx * 374761393 + ty * 668265263 + salt * 2246822519) >>> 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    h = (h ^ (h >>> 16)) >>> 0;
    return h / 4294967296;
  }

  // ── Terrain: baked ONCE at map load, blitted every frame ──────────────────────
  // RENDER-COST DISCIPLINE: the old implementation re-ran per-tile fill + jittered
  // detail + edge-blend for every VISIBLE tile every frame — real jitter/triangulation
  // recompute at 60fps. Obsidian Bloom bakes the whole static field (base fill +
  // shatterFacet grain + edge blends + the grafted contour/elevation-hint pass) into
  // one offscreen canvas here; drawTerrain() below just blits a camera-transformed
  // view of it. Only the fog-of-war overlay (flat alpha rects, no jitter) stays
  // per-frame — cheap, and it has to (fog changes tick to tick).
  let terrainBaked: HTMLCanvasElement | null = null;

  function bakeTerrain(): HTMLCanvasElement {
    const { width, height } = simState.grid;
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, width * TILE_SIZE_PX);
    cv.height = Math.max(1, height * TILE_SIZE_PX);
    const c = cv.getContext('2d') as CanvasRenderingContext2D;
    for (let ty = 0; ty < height; ty++) {
      for (let tx = 0; tx < width; tx++) {
        const type = simState.grid.terrainAt({ tx, ty });
        const tileKey = `${tx},${ty}`;
        const px = tx * TILE_SIZE_PX, py = ty * TILE_SIZE_PX, S = TILE_SIZE_PX;
        const density = simState.shardDensity.get(tileKey) ?? 0;
        const tile = sprites.getTerrainTile(type, tileHash(tx, ty, 7) < 0.5 ? 0 : 1, density);
        if (tile) {
          c.drawImage(tile, px, py, S, S);
        } else {
          // Procedural fallback: shatterFacet basalt field + per-terrain detail.
          const style = TERRAIN[type] ?? TERRAIN_FALLBACK;
          const v = tileHash(tx, ty, 1);
          c.fillStyle = mix(style.base, v < 0.5 ? style.dark : style.light, 0.22);
          c.fillRect(px, py, S, S);
          shatterFacetRect(c, px, py, S, S, {
            seed: hashStr(`terrain|${tx}|${ty}`), facetScale: Math.max(16, Math.round(S * 0.55)),
            baseColor: style.base, valueJitter: 0.12, jitter: 0.4,
          });
          bakeTerrainDetail(c, type, style, tx, ty, px, py);
        }
        bakeTerrainEdges(c, type, tx, ty, px, py, width, height);
      }
    }
    return cv;
  }

  // Blend each tile edge toward a differing neighbour + ambient shadow under raised
  // rock + the grafted contour/elevation-hint pass: a jittered neutral cyan-white
  // line paralleling any RAISED_TERRAIN boundary (reuses the SAME jitteredLine the
  // corruption cracks use, just recolored — "passable vs not" readable at a glance,
  // zero new primitives). Baked once, not per-frame.
  function bakeTerrainEdges(c: CanvasRenderingContext2D, type: string, tx: number, ty: number, px: number, py: number, width: number, height: number): void {
    const style = TERRAIN[type] ?? TERRAIN_FALLBACK;
    const S = TILE_SIZE_PX, B = 6;
    const sides: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of sides) {
      const nx = tx + dx, ny = ty + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const nt = simState.grid.terrainAt({ tx: nx, ty: ny });
      if (nt === type) continue;
      const nStyle = TERRAIN[nt] ?? TERRAIN_FALLBACK;

      c.fillStyle = mix(style.base, nStyle.base, 0.5);
      c.globalAlpha = 0.45;
      if (dx === 1) c.fillRect(px + S - B, py, B, S);
      else if (dx === -1) c.fillRect(px, py, B, S);
      else if (dy === 1) c.fillRect(px, py + S - B, S, B);
      else c.fillRect(px, py, S, B);

      const raisedHere = RAISED_TERRAIN.has(type), raisedThere = RAISED_TERRAIN.has(nt);
      if (raisedThere && !raisedHere) {
        c.fillStyle = 'rgba(0,0,0,0.28)';
        c.globalAlpha = 0.5;
        if (dx === 1) c.fillRect(px + S - 3, py, 3, S);
        else if (dx === -1) c.fillRect(px, py, 3, S);
        else if (dy === 1) c.fillRect(px, py + S - 3, S, 3);
        else c.fillRect(px, py, S, 3);
      }
      c.globalAlpha = 1;

      // Contour hint, drawn once per pair (from the raised side only).
      if (raisedHere && !raisedThere) {
        const seed = hashStr(`contour|${tx}|${ty}|${dx}|${dy}`);
        const opts = { seed, amplitude: 3, segments: 5, color: CONTOUR_COLOR, alpha: 0.22, lineWidth: 1.4 };
        if (dx === 1) jitteredLine(c, px + S, py, px + S, py + S, opts);
        else if (dx === -1) jitteredLine(c, px, py, px, py + S, opts);
        else if (dy === 1) jitteredLine(c, px, py + S, px + S, py + S, opts);
        else jitteredLine(c, px, py, px + S, py, opts);
      }
    }
  }

  // Cheap deterministic grain/cracks/ridges/flecks per terrain type (baked).
  function bakeTerrainDetail(c: CanvasRenderingContext2D, type: string, style: TerrainStyle, tx: number, ty: number, px: number, py: number): void {
    const S = TILE_SIZE_PX;
    if (type === 'ROCK' || type === 'IMPASSABLE') {
      c.fillStyle = style.dark;
      for (let i = 0; i < 3; i++) {
        const hx = tileHash(tx, ty, 10 + i), hy = tileHash(tx, ty, 20 + i);
        c.fillRect(px + Math.floor(hx * (S - 8)), py + Math.floor(hy * (S - 8)), 4 + Math.floor(hx * 4), 3 + Math.floor(hy * 3));
      }
      c.fillStyle = style.light;
      c.fillRect(px + 2, py + 2, S - 4, 1);
    } else if (type === 'SHARD') {
      // Crystalline flecks — violet-teal, deliberately not magenta (corruption stays uncontested).
      for (let i = 0; i < 5; i++) {
        const hx = tileHash(tx, ty, 30 + i), hy = tileHash(tx, ty, 40 + i);
        c.fillStyle = i % 2 ? style.light : '#8fe8d4';
        const s = 2 + Math.floor(tileHash(tx, ty, 50 + i) * 2);
        c.fillRect(px + Math.floor(hx * (S - s)), py + Math.floor(hy * (S - s)), s, s);
      }
    } else if (type === 'DUNE') {
      c.fillStyle = style.light;
      const r = Math.floor(tileHash(tx, ty, 60) * (S - 12)) + 4;
      c.fillRect(px + 3, py + r, S - 6, 2);
      c.fillStyle = style.dark;
      c.fillRect(px + 3, py + r + 2, S - 6, 1);
    } else {
      for (let i = 0; i < 4; i++) {
        const hx = tileHash(tx, ty, 70 + i), hy = tileHash(tx, ty, 80 + i);
        c.fillStyle = hx < 0.5 ? style.dark : style.light;
        c.fillRect(px + Math.floor(hx * (S - 3)), py + Math.floor(hy * (S - 3)), 2, 2);
      }
    }
  }

  // Blit the baked field through the camera transform, then the per-frame fog
  // overlay (flat rects only — no jitter recompute, so this part staying live is fine).
  function drawTerrain(): void {
    if (!terrainBaked) terrainBaked = bakeTerrain();
    const worldToBakedPx = TILE_SIZE_PX / TILE_SUBUNITS;
    context.save();
    context.setTransform(
      camera.zoom, 0, 0, camera.zoom,
      -camera.x * worldToBakedPx * camera.zoom, -camera.y * worldToBakedPx * camera.zoom,
    );
    context.drawImage(terrainBaked, 0, 0);
    context.restore();

    const fog = getFog?.();
    if (!fog) return;
    const { width, height } = simState.grid;
    for (let ty = 0; ty < height; ty++) {
      for (let tx = 0; tx < width; tx++) {
        const tileKey = `${tx},${ty}`;
        const isVisible = fog.visible.has(tileKey);
        const isExplored = fog.explored.has(tileKey);
        if (isExplored && isVisible) continue; // fully lit — nothing to overlay
        const tilePos = tileToWorldCenter({ tx, ty });
        const screenPos = worldToScreen(tilePos, camera);
        const TS = TILE_SIZE_PX * camera.zoom;
        const px = Math.floor(screenPos.sx - TS / 2);
        const py = Math.floor(screenPos.sy - TS / 2);
        const DS = Math.ceil(TS) + 1;
        context.fillStyle = isExplored ? 'rgba(6,8,11,0.62)' : '#070707';
        context.fillRect(px, py, DS, DS);
      }
    }
  }

  // ── Corruption / Avarice (grafted War Room idea): a bounded, localized crack-
  // network alarm at over-harvested Shard nodes. There is no sim "Avarice" field —
  // this derives a purely VIEW-side metric from the existing shardDensity ledger
  // (1 - current/initialAtLoad), which keeps it presentation-only per the sim/view
  // boundary (§1 AGENTS.md — no new SimState field, no sim system touched). Crack
  // GEOMETRY is cached per tile and only regenerated when the Avarice BUCKET changes
  // ("incremental redraw only on tiles whose Avarice value changed"); the pulse/
  // colour intensity are live per-frame off the cached geometry (cheap — a redraw,
  // not a re-triangulation). Magenta (#c23ff0→#6b1a8f) is reserved solely for this
  // signal — Shard's resource glow stays violet-teal (bakeTerrainDetail above) so
  // the two never read as the same alarm.
  const initialShardDensity = new Map(simState.shardDensity);
  interface CorruptionEntry { bucket: number; seed: number; branches: CrackBranch[]; }
  const corruptionCache = new Map<string, CorruptionEntry>();
  const AVARICE_THRESHOLD = 0.18;
  const AVARICE_BUCKETS = 8;
  const CORRUPTION_REACH_TILES = 2.2; // hard cap — never blanket the visible map

  function avariceAt(tileKey: string): number {
    const initial = initialShardDensity.get(tileKey) ?? 0;
    if (initial <= 0) return 0;
    const current = simState.shardDensity.get(tileKey) ?? 0;
    return Math.max(0, Math.min(1, 1 - current / initial));
  }

  function drawCorruption(): void {
    if (initialShardDensity.size === 0) return;
    const fog = getFog?.();
    const now = Date.now();
    for (const tileKey of initialShardDensity.keys()) {
      const avarice = avariceAt(tileKey);
      if (avarice < AVARICE_THRESHOLD) { corruptionCache.delete(tileKey); continue; }
      if (fog && !fog.visible.has(tileKey)) continue; // don't leak the alarm through fog
      const sep = tileKey.indexOf(',');
      const tx = Number(tileKey.slice(0, sep)), ty = Number(tileKey.slice(sep + 1));
      const tilePos = tileToWorldCenter({ tx, ty });
      const s = worldToScreen(tilePos, camera);
      if (s.sx < -100 || s.sx > canvas.width + 100 || s.sy < -100 || s.sy > canvas.height + 100) continue;

      const bucket = Math.min(AVARICE_BUCKETS - 1, Math.floor(avarice * AVARICE_BUCKETS));
      let entry = corruptionCache.get(tileKey);
      if (!entry || entry.bucket !== bucket) {
        const seed = hashStr(`avarice|${tileKey}`) ^ (bucket * 0x1000193);
        const reach = TILE_SIZE_PX * (0.6 + CORRUPTION_REACH_TILES * (bucket / (AVARICE_BUCKETS - 1)));
        entry = { bucket, seed, branches: buildCrackNetwork(seed, 0, 0, reach, avarice) };
        corruptionCache.set(tileKey, entry);
      }
      const pulse = 0.5 + 0.5 * Math.sin(now / 420 + (entry.seed % 1000) * 0.01);
      context.save();
      context.translate(s.sx, s.sy);
      context.scale(camera.zoom, camera.zoom);
      // Crystal lattice underlay under Avarice cracks (view-only; PNG already loaded).
      const lattice = sprites.getNamedTerrainTile(bucket % 2 ? 'crystal_lattice_2' : 'crystal_lattice')
        ?? sprites.getNamedTerrainTile('crystal_lattice');
      if (lattice) {
        const reach = TILE_SIZE_PX * (0.6 + CORRUPTION_REACH_TILES * (bucket / (AVARICE_BUCKETS - 1)));
        const side = reach * 2.2;
        context.globalAlpha = 0.18 + avarice * 0.35;
        context.drawImage(lattice, -side / 2, -side / 2, side, side);
        context.globalAlpha = 1;
      }
      drawCrackNetwork(context, entry.branches, { colorCore: '#c23ff0', colorEdge: '#6b1a8f', intensity: avarice, pulse, baseWidth: 1.6 });
      context.restore();
    }
  }

  // ── QA silhouette toggle (?silhouette=1 or window.__debugSilhouette=true): flat
  // grayscale render, no color/glow — a same-day tool for judging readability
  // independent of palette (VALIDATION GATE eye-fatigue / silhouette checks).
  const SILHOUETTE_QS = (() => {
    try { return new URLSearchParams(window.location.search).get('silhouette') === '1'; } catch { return false; }
  })();
  function silhouetteActive(): boolean {
    return SILHOUETTE_QS || (globalThis as unknown as { __debugSilhouette?: boolean }).__debugSilhouette === true;
  }

  // ── Color helpers ─────────────────────────────────────────────────────────
  function rgb(hex: string): [number, number, number] {
    // Accept both #rgb shorthand and #rrggbb (shorthand → NaN channels otherwise).
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function toHex(n: number): string {
    return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  }
  // Linear blend a→b by t in [0,1].
  function mix(a: string, b: string, t: number): string {
    const [ar, ag, ab] = rgb(a);
    const [br, bg, bb] = rgb(b);
    return `#${toHex(ar + (br - ar) * t)}${toHex(ag + (bg - ag) * t)}${toHex(ab + (bb - ab) * t)}`;
  }

  // Angle (radians) a unit should face. Combat targeting first; otherwise the
  // next path waypoint; otherwise observed interpolated travel. Idle keeps the
  // last view-owned heading (never snaps north). Large turns are eased in the view.
  function desiredFacing(
    e: ReturnType<typeof simState.store.all>[number],
    pos: WorldPos,
    interp: WorldPos,
    prevPos: WorldPos | undefined,
  ): number | null {
    const combat = e.components.combat;
    if (combat?.targetId != null) {
      const t = simState.store.get(combat.targetId);
      const tp = t?.components.position;
      if (tp) return Math.atan2(tp.wy - pos.wy, tp.wx - pos.wx);
    }
    const mv = e.components.movement;
    const wp = mv?.path[0];
    if (wp) return Math.atan2(wp.wy - interp.wy, wp.wx - interp.wx);
    if (prevPos) {
      const dx = interp.wx - prevPos.wx, dy = interp.wy - prevPos.wy;
      if (dx * dx + dy * dy > 1) return Math.atan2(dy, dx);
    }
    return null;
  }

  function lerpAngle(from: number, to: number, t: number): number {
    let d = to - from;
    const TAU = Math.PI * 2;
    d = ((d + Math.PI) % TAU + TAU) % TAU - Math.PI;
    return from + d * t;
  }

  function facingAngle(
    e: ReturnType<typeof simState.store.all>[number],
    pos: WorldPos,
    interp?: WorldPos,
    prevPos?: WorldPos,
  ): number {
    const want = desiredFacing(e, pos, interp ?? pos, prevPos);
    const prev = headingById.get(e.id);
    if (want == null) return prev ?? -Math.PI / 2;
    if (prev == null) {
      headingById.set(e.id, want);
      return want;
    }
    const t = 1 - Math.exp(-10 * (frameDtMs / 1000));
    const next = lerpAngle(prev, want, t);
    headingById.set(e.id, next);
    return next;
  }

  function pruneHeadings(): void {
    const alive = new Set<EntityId>();
    for (const e of simState.store.all()) alive.add(e.id);
    for (const id of headingById.keys()) if (!alive.has(id)) headingById.delete(id);
  }

  // Shells in flight (FG-3): a bright tracer dot + short motion trail.
  function drawProjectiles() {
    for (const e of simState.store.all()) {
      const proj = e.components.projectile;
      const pos = e.components.position;
      if (!proj || !pos) continue;
      const p = worldToScreen(pos, camera);
      const dx = proj.target.wx - pos.wx, dy = proj.target.wy - pos.wy;
      const len = Math.hypot(dx, dy) || 1;
      const tx = p.sx - (dx / len) * 10 * camera.zoom;
      const ty = p.sy - (dy / len) * 10 * camera.zoom;
      context.strokeStyle = 'rgba(255,214,90,0.7)';
      context.lineWidth = 2 * camera.zoom;
      context.beginPath(); context.moveTo(tx, ty); context.lineTo(p.sx, p.sy); context.stroke();
      context.fillStyle = '#ffe9a8';
      context.beginPath(); context.arc(p.sx, p.sy, 2.4 * camera.zoom, 0, Math.PI * 2); context.fill();
    }
  }

  function drawEntities() {
    const fog = getFog?.();
    // Draw buildings first (units render on top of their footprints).
    const ordered = [...simState.store.all()].sort((a, b) =>
      (a.components.building ? 0 : 1) - (b.components.building ? 0 : 1));

    for (const e of ordered) {
      const pos = e.components.position;
      if (!pos) continue;
      // Shells in flight draw separately (drawProjectiles), not as units.
      if (e.components.projectile) continue;
      // Stealth (XP-3): the foe's cloaked units are INVISIBLE; your own render
      // ghosted so you can still command them.
      const cloaked = e.components.stealth?.cloaked === true;
      const mine = e.components.faction?.team === (cfg.viewerTeam ?? 'player');
      if (cloaked && !mine) continue;
      if (cloaked && mine) { context.globalAlpha = 0.45; }
      // TP-3: construction sites render as translucent scaffolding.
      const siteProgress = e.components.building?.buildProgress ?? 100;
      if (e.components.building && siteProgress < 100) context.globalAlpha = 0.55;

      // Hide entities in unseen fog (player units always sit in visible tiles).
      if (fog) {
        const t = worldToTile(pos);
        if (!fog.visible.has(`${t.tx},${t.ty}`)) continue;
      }

      // Interpolate for smooth movement.
      const prevPos = simState.prevPositions.get(e.id);
      const alpha = Math.min(1, accMs / STEP_MS);
      const interp: WorldPos = prevPos
        ? { wx: prevPos.wx + (pos.wx - prevPos.wx) * alpha, wy: prevPos.wy + (pos.wy - prevPos.wy) * alpha }
        : pos;
      const { sx, sy } = worldToScreen(interp, camera);

      const team = e.components.faction?.team;
      const teamKey = team ?? 'neutral';
      const style = (team && TEAM[team]) ? TEAM[team] : NEUTRAL_TEAM;
      const kind = e.components.faction?.faction ?? '';

      // Hunter events (Riftmaw = the planet's punishing hunter, always neutral):
      // a live achromatic filter swaps the draw to grayscale + drops any colour
      // glow, so an awakened hunter reads as a distinct alarm silhouette rather
      // than another faction unit. The QA silhouette toggle takes priority when on.
      const isHunter = kind === 'riftmaw';
      const entityFilter = silhouetteActive() ? 'grayscale(1) saturate(0) brightness(0.6) contrast(1.35)'
        : isHunter ? 'grayscale(1) brightness(0.92)' : 'none';
      if (entityFilter !== 'none') context.filter = entityFilter;

      if (e.components.building) {
        // Baked lit body (S7-2) + live animated accents on top.
        sprites.drawBuildingBody(context, kind, teamKey, sx, sy, Math.floor(animTick), camera.zoom);
        drawBuildingAccents(kind, sx, sy, style, camera.zoom);
        if (siteProgress < 100) { // TP-3: site progress bar
          const bw2 = 30 * camera.zoom;
          context.fillStyle = 'rgba(10,14,20,0.8)';
          context.fillRect(sx - bw2 / 2, sy - 26 * camera.zoom, bw2, 4);
          context.fillStyle = '#ffd34d';
          context.fillRect(sx - bw2 / 2, sy - 26 * camera.zoom, bw2 * (siteProgress / 100), 4);
        }
      } else {
        // Cargo glow (harvester) draws under the baked sprite, then the sprite.
        if (e.components.movement?.flying) {
          // Air (XP-5): lift the sprite + a soft ground shadow sells altitude.
          context.fillStyle = 'rgba(0,0,0,0.30)';
          context.beginPath();
          context.ellipse(sx, sy + 6 * camera.zoom, 10 * camera.zoom, 4 * camera.zoom, 0, 0, Math.PI * 2);
          context.fill();
          drawUnitUnderlay(e, kind, sx, sy - 14 * camera.zoom, camera.zoom);
          sprites.drawUnit(context, kind, teamKey, undefined, facingAngle(e, interp, interp, prevPos), sx, sy - 14 * camera.zoom, Math.floor(animTick), camera.zoom, unitAnim(e, pos, prevPos));
        } else {
          drawUnitUnderlay(e, kind, sx, sy, camera.zoom);
          sprites.drawUnit(context, kind, teamKey, undefined, facingAngle(e, interp, interp, prevPos), sx, sy, Math.floor(animTick), camera.zoom, unitAnim(e, pos, prevPos));
        }
      }
      if (entityFilter !== 'none') context.filter = 'none';
      context.globalAlpha = 1; // reset the stealth ghosting (XP-3)
    }
  }

  // What a unit is doing right now, for §0.6 animation-strip selection: firing
  // (window set by the muzzle detector) beats moving (interpolation delta) beats idle.
  function unitAnim(e: ReturnType<typeof simState.store.all>[number], pos: WorldPos, prevPos: WorldPos | undefined): UnitAnim {
    if ((firingUntil.get(e.id) ?? 0) > animTick) return 'firing';
    const moving = !!prevPos && Math.abs(pos.wx - prevPos.wx) + Math.abs(pos.wy - prevPos.wy) > 0.01;
    return moving ? 'moving' : 'idle';
  }

  // Harvester ore-load glow, drawn UNDER the baked sprite so the crystal cargo
  // reads through the hopper (the only per-instance unit state we surface visually).
  function drawUnitUnderlay(e: ReturnType<typeof simState.store.all>[number], kind: string, sx: number, sy: number, scale: number): void {
    if (kind !== 'harvester') return;
    const cargo = e.components.harvest?.cargo ?? 0;
    if (cargo <= 0) return;
    context.save();
    context.globalAlpha = Math.min(0.85, 0.3 + cargo / 700);
    context.fillStyle = '#c9a6ff';
    context.beginPath();
    context.ellipse(sx, sy - 2, TILE_SIZE_PX * 0.26 * scale, TILE_SIZE_PX * 0.2 * scale, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  // Live animated accents drawn ON TOP of a building's baked body (the baked body
  // carries the static silhouette + shading; only motion lives here).
  function drawBuildingAccents(kind: string, sx: number, sy: number, style: TeamStyle, scale: number): void {
    const S = TILE_SIZE_PX * scale, t = Math.floor(animTick);
    const big = kind === 'construction_yard' || kind === 'refinery';
    const halfH = (big ? S * 1.2 : S * 0.82) / 2;
    const top = sy - halfH * 0.6; // baked body is roughly centred; top-ish anchor

    if (kind === 'refinery') {
      const puff = (t % 90) / 90;                       // exhaust rising + fading
      context.globalAlpha = (1 - puff) * 0.4;
      context.fillStyle = '#cfc6bb';
      context.beginPath(); context.arc(sx - S * 0.28, top - puff * 16, 3 + puff * 5, 0, Math.PI * 2); context.fill();
      context.globalAlpha = 1;
    } else if (kind === 'construction_yard') {
      context.strokeStyle = mix(style.accent, '#000', 0.1); context.lineWidth = 2.5;   // crane arm
      context.beginPath(); context.moveTo(sx - S * 0.5, top + 4); context.lineTo(sx + S * 0.55, top - S * 0.28); context.stroke();
      const hook = sx - S * 0.5 + (Math.sin(t * 0.04) * 0.5 + 0.5) * (S * 1.05);        // sweeping hook
      context.strokeStyle = '#3a352a'; context.lineWidth = 1.5;
      context.beginPath(); context.moveTo(hook, top); context.lineTo(hook, top + S * 0.3); context.stroke();
      context.fillStyle = (t % 40) < 20 ? '#ff4a3d' : '#5a1a14';                        // beacon blink
      context.beginPath(); context.arc(sx + S * 0.55, top - S * 0.28, 3, 0, Math.PI * 2); context.fill();
    } else if (kind === 'power_node') {
      context.strokeStyle = mix(style.accent, '#000', 0.1); context.lineWidth = 2;      // mast
      context.beginPath(); context.moveTo(sx, top); context.lineTo(sx, top - S * 0.34); context.stroke();
      context.fillStyle = (t % 60) < 30 ? '#00e5ff' : '#0a5563';                        // pulse
      context.fillRect(sx - 2, top - S * 0.34 - 3, 4, 4);
    }
  }

  function render() {
    pruneHeadings();
    edgeScroll(frameDtMs);   // move mouse to a screen edge → scroll the view (C&C/RA)
    clampCamera();  // keep the view on the map after any pan/zoom
    // Clear canvas
    context.fillStyle = '#000000';
    context.fillRect(0, 0, canvas.width, canvas.height);

    drawTerrain();
    drawSlabs();
    drawCorruption(); // bounded Avarice crack-network alarm, ground layer
    drawDecals();
    drawProjectiles();
    drawEntities();
    drawParticles();
    drawRankChevrons();
    drawTeamShapeMarkers();
    drawSelectionRings();
    drawBoxSelection();
    drawConfirmationMarkers();
    drawHealthBars();
    drawVictoryBanner();
    drawPlacementGhost();
    // Shardstorm tint (XP-5): the world turns violet while the storm howls.
    if (cfg.isStorm?.()) {
      context.fillStyle = 'rgba(140,100,220,0.10)';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    // The mission briefing owns the whole screen — hide the HUD behind it so the
    // COMMAND panel doesn't bleed past the briefing frame.
    const briefing = onboarding?.briefingActive() ?? false;
    if (!briefing) { drawObjectivePointer(); hud.draw(); drawMinimap(); }

    // Onboarding overlays (briefing + objective banner) sit on top of everything.
    if (onboarding) {
      onboarding.update(simState, confirmationMarkers ?? []);
      onboarding.draw(context, canvas);
    }
  }

  function loop(now: number) {
    if (!running) return;

    const dt = now - lastTime;
    lastTime = now;
    frameDtMs = Math.max(0, Math.min(dt, 100));
    animTick += (frameDtMs * 60) / 1000;

    // Pause the sim while the mission briefing is up — the field freezes so the
    // player reads the brief before any unit moves (and the dismiss-click grabs
    // keyboard focus). Rendering continues so the briefing overlay still draws.
    if (onboarding?.briefingActive()) {
      lastTime = now; // don't let paused time pile into a catch-up burst on resume
      accMs = 0;
    } else {
      // Contract fixed-timestep: accumulate() decides how many whole ticks to run;
      // runTick() snapshots prev positions, runs systems in SYSTEM_ORDER, and bumps
      // the tick. The leftover remainder is the interpolation alpha for render().
      // Time scale (FG-1): 0 = paused (render continues, sim frozen), 2 = 2× speed.
      // Scaling wall-time BEFORE accumulate keeps the sim's fixed 20 Hz ticks intact —
      // determinism is untouched; only how many ticks elapse per wall-second changes.
      const scale = getTimeScale?.() ?? 1;
      const { steps, remainderMs } = accumulate(accMs, dt * scale);
      let ran = 0;
      for (let i = 0; i < steps; i += 1) {
        // Lockstep hold (FG-7): don't run past the last confirmed tick; drop the
        // leftover accumulation so the sim doesn't burst-catch-up on release.
        if (cfg.canRunTick && !cfg.canRunTick(simState.tick)) break;
        const tickNow = simState.tick;
        cfg.onBeforeTick?.(tickNow);
        runTick(simState, systems);
        detectCombatFx(); // read sim transitions (deaths, shots) → spawn view FX
        cfg.onAfterTick?.(tickNow);
        ran += 1;
      }
      accMs = ran === steps ? remainderMs : 0;
    }

    stepParticles(frameDtMs * 60 / 1000);
    stepDecals(frameDtMs * 60 / 1000);
    render();
    requestAnimationFrame(loop);
  }

  return {
    start() {
      if (running) return;
      running = true;
      lastTime = performance.now();
      requestAnimationFrame(loop);
    },
    stop() {
      running = false;
    },
    getCamera() {
      return camera;
    },
    setCamera(cam: Camera) {
      Object.assign(camera, cam);
    },
    /** Center the camera on a world position (mission boot: the player's HQ —
     *  the default map-center start leaves corner-start maps staring at fog). */
    centerOn(wx: number, wy: number) {
      centerOn(wx, wy);
    },
    spriteBank: sprites,
    battlefieldRect,
    hudButtonAt: (sx, sy) => hud.buttonAt(sx, sy),
    hudAnyButtonAt: (sx, sy) => hud.anyButtonAt(sx, sy),
    hudDeniedAt: (sx, sy) => hud.deniedAt(sx, sy),
    hudSetTab: (tab) => hud.setTab(tab),
    hudButtonRect: (action) => hud.rectOf(action),
    minimapRect,
    minimapJump(sx: number, sy: number): boolean {
      if (onboarding?.briefingActive()) return false;
      if (!viewerHasRadar()) return false; // XP-1: dark radar doesn't navigate
      const r = minimapRect();
      if (sx < r.x || sx > r.x + r.w || sy < r.y || sy > r.y + r.h) return false;
      centerOn(((sx - r.x) / r.w) * worldW, ((sy - r.y) / r.h) * worldH);
      return true;
    },
  };
}
