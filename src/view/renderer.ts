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
import type { Onboarding } from './onboarding.js';
import type { EntityId } from '../sim/ids.js';
import { makeSpriteBank, type SpriteBank } from './spritebank.js';

// ── Terrain palette (base + a darker/lighter pair for per-tile texturing) ──────
// Each tile gets base fill + deterministic grain/detail so the desert reads as a
// gritty surface instead of a flat pastel block (the P1 "not even Dune-2000" fix).
interface TerrainStyle { base: string; dark: string; light: string; }
const TERRAIN: Record<string, TerrainStyle> = {
  SAND:       { base: '#d9be86', dark: '#c9ac74', light: '#e7d19d' },
  DEEP_SAND:  { base: '#c9a566', dark: '#b8934f', light: '#dab97e' },
  DUNE:       { base: '#d8b979', dark: '#c2a061', light: '#ecd399' },
  ROCK:       { base: '#7a6650', dark: '#5f4f3c', light: '#96806a' },
  SHARD:      { base: '#7d6a9a', dark: '#5f5079', light: '#b49bd8' },
  IMPASSABLE: { base: '#3c3630', dark: '#2a2621', light: '#4d453c' },
};
const TERRAIN_FALLBACK: TerrainStyle = { base: '#888888', dark: '#666666', light: '#aaaaaa' };
// Terrain that reads as RAISED — casts a soft ambient shadow onto lower neighbours.
const RAISED_TERRAIN = new Set(['ROCK', 'IMPASSABLE']);

// Slab color (poured concrete foundation)
const SLAB_COLOR = '#6e6e73';

// ── Team accent palette (faction = outer stripe + tint; §11.1) ────────────────
interface TeamStyle { hull: string; hullDark: string; accent: string; stripe: string; }
const TEAM: Record<string, TeamStyle> = {
  player: { hull: '#3d7fd6', hullDark: '#28568f', accent: '#a7d6ff', stripe: '#00e5ff' },
  enemy:  { hull: '#d1503a', hullDark: '#8f3020', accent: '#ffb08f', stripe: '#ff4a3d' },
};
const NEUTRAL_TEAM: TeamStyle = { hull: '#9a9a9a', hullDark: '#6a6a6a', accent: '#d8d8d8', stripe: '#ffffff' };

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
}

export interface View {
  start(): void;
  stop(): void;
  getCamera(): Camera;
  setCamera(cam: Camera): void;
  /** The radar minimap rect in canvas pixels (for input hit-testing). */
  minimapRect(): { x: number; y: number; w: number; h: number };
  /** If (sx,sy) is inside the minimap, recentre the camera there and return true. */
  minimapJump(sx: number, sy: number): boolean;
  /** Hit-test the sidebar build buttons; returns "train:infantry" / "build:barracks" / null. */
  hudButtonAt(sx: number, sy: number): string | null;
  /** The sprite bank (exposed for the real-asset loader + tests). */
  readonly spriteBank: SpriteBank;
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
  let frame = 0; // monotonic render-frame counter, drives idle building animation

  // Use ctx as non-null after the check
  const context = ctx as CanvasRenderingContext2D;

  // Create HUD (clickable C&C-style build sidebar; getHover drives button highlight)
  const hud = makeHUD({ canvas, simState, camera, getHover, cargoCapacity });

  // Pre-bake the directional sprite bank once (S7-2). Units get DIRS fixed-lit
  // facings; buildings get a lit body. Animated accents are drawn live on top.
  const sprites = makeSpriteBank(TEAM, NEUTRAL_TEAM, weapons);
  // Best-effort: swap in any delivered real sprite sheets (docs/ART_ASSETS_SPEC.md).
  // No manifest / missing sheets → silently stays procedural. Exposed for testing.
  void sprites.loadManifest('art');
  void sprites.loadTerrain('art'); // seamless ground tileset (procedural fallback per-tile)

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

  function drawMinimap(): void {
    if (!mmTerrain) mmTerrain = bakeMinimapTerrain();
    const { x, y, w, h } = minimapRect();
    const fog = getFog?.();

    // Frame + backing.
    context.fillStyle = '#0a0d12';
    context.fillRect(x - 3, y - 16, w + 6, h + 19);
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
  // device, unlike middle-drag). Runs each frame from the cursor position.
  function edgeScroll(): void {
    if (onboarding?.briefingActive()) return;
    const cur = getHover?.();
    if (!cur) return;
    const WPP = TILE_SUBUNITS / TILE_SIZE_PX;
    const M = 28;                       // edge band (px)
    const spd = (11 * WPP) / camera.zoom; // world units / frame
    const W = canvas.width, H = canvas.height;
    let dx = 0, dy = 0;
    if (cur.sx <= M) dx = -spd; else if (cur.sx >= W - M) dx = spd;
    if (cur.sy <= M) dy = -spd; else if (cur.sy >= H - M) dy = spd;
    if (dx || dy) Object.assign(camera, { x: camera.x + dx, y: camera.y + dy, zoom: camera.zoom });
  }
  // Keep the view on (or just past) the map so you can't scroll into the void.
  function clampCamera(): void {
    const WPP = TILE_SUBUNITS / TILE_SIZE_PX;
    const visW = (canvas.width * WPP) / camera.zoom, visH = (canvas.height * WPP) / camera.zoom;
    const padX = visW * 0.35, padY = visH * 0.35;
    const loX = -padX, hiX = Math.max(loX, worldW - visW + padX);
    const loY = -padY, hiY = Math.max(loY, worldH - visH + padY);
    const x = Math.max(loX, Math.min(hiX, camera.x));
    const y = Math.max(loY, Math.min(hiY, camera.y));
    if (x !== camera.x || y !== camera.y) Object.assign(camera, { x, y, zoom: camera.zoom });
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
    for (const id of prevAlive.keys()) if (!alive.has(id)) { prevAlive.delete(id); prevCooldown.delete(id); prevHp.delete(id); prevHarvest.delete(id); }
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
  function stepDecals(): void {
    for (let i = decals.length - 1; i >= 0; i--) {
      const d = decals[i]!;
      d.life -= 1;
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
      context.fillStyle = '#14100c';
      context.beginPath();
      context.ellipse(p.sx, p.sy, r, r * 0.7, 0, 0, Math.PI * 2);
      context.fill();
      for (const c of d.chunks) {
        context.fillStyle = c.hue;
        context.fillRect(p.sx + c.dx * camera.zoom, p.sy + c.dy * camera.zoom, c.w * camera.zoom, c.h * camera.zoom);
      }
      context.restore();
    }
  }

  function stepParticles(): void {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (!p) continue;
      p.wx += p.vx * (TILE_SUBUNITS / TILE_SIZE_PX);
      p.wy += p.vy * (TILE_SUBUNITS / TILE_SIZE_PX);
      p.vx *= 0.9; p.vy *= 0.9;
      p.life -= 1;
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

  function drawSelectionRings() {
    for (const e of simState.store.all()) {
      if (!e.components.selection?.selected) continue;
      const pos = e.components.position;
      if (!pos) continue;

      const screenPos = worldToScreen(pos, camera);
      const size = TILE_SIZE_PX * 0.8 * camera.zoom;

      // Rally flag (FG-1): a selected producer shows where its units will gather —
      // dashed line from the building to a small pennant at the rally point.
      const rally = e.components.production?.rally;
      if (rally) {
        const r = worldToScreen(rally, camera);
        context.save();
        context.strokeStyle = 'rgba(120,255,160,0.75)';
        context.lineWidth = 1.5;
        context.setLineDash([4, 4]);
        context.beginPath();
        context.moveTo(screenPos.sx, screenPos.sy);
        context.lineTo(r.sx, r.sy);
        context.stroke();
        context.setLineDash([]);
        // Pennant: pole + triangular flag.
        context.beginPath();
        context.moveTo(r.sx, r.sy);
        context.lineTo(r.sx, r.sy - 14 * camera.zoom);
        context.stroke();
        context.fillStyle = 'rgba(120,255,160,0.9)';
        context.beginPath();
        context.moveTo(r.sx, r.sy - 14 * camera.zoom);
        context.lineTo(r.sx + 9 * camera.zoom, r.sy - 11 * camera.zoom);
        context.lineTo(r.sx, r.sy - 8 * camera.zoom);
        context.closePath();
        context.fill();
        context.restore();
      }

      // Draw selection ring
      context.strokeStyle = SELECTION_COLOR;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(screenPos.sx, screenPos.sy, size / 2 + 4, 0, Math.PI * 2);
      context.stroke();
    }
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
    const result = validatePlacement(simState, structure, placement.tile);
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

    const bannerText = victory.winner === 'player' ? 'VICTORY' : 'DEFEAT';
    const bannerColor = victory.winner === 'player' ? '#00ff00' : '#ff0000';

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

  function drawTerrain() {
    const { width, height } = simState.grid;
    const fog = getFog?.();
    for (let ty = 0; ty < height; ty++) {
      for (let tx = 0; tx < width; tx++) {
        const type = simState.grid.terrainAt({ tx, ty });
        const tileKey = `${tx},${ty}`;
        const isVisible = fog ? fog.visible.has(tileKey) : true;
        const isExplored = fog ? fog.explored.has(tileKey) : true;

        const tilePos = tileToWorldCenter({ tx, ty });
        const screenPos = worldToScreen(tilePos, camera);
        // Tile size scales with zoom (+1 overdraw avoids seam gaps from rounding).
        const TS = TILE_SIZE_PX * camera.zoom;
        const px = Math.floor(screenPos.sx - TS / 2);
        const py = Math.floor(screenPos.sy - TS / 2);
        const DS = Math.ceil(TS) + 1;

        if (!isExplored) {
          // Unexplored: solid near-black (no detail leaks the map shape).
          context.fillStyle = '#070707';
          context.fillRect(px, py, DS, DS);
          continue;
        }

        const style = TERRAIN[type] ?? TERRAIN_FALLBACK;
        // Explored-but-not-visible tiles are drawn dimmed (fog memory).
        const dim = isVisible ? 1 : 0.42;

        // Real seamless tile if delivered; else procedural texture (fallback).
        const density = simState.shardDensity.get(tileKey) ?? 0;
        const tile = sprites.getTerrainTile(type, tileHash(tx, ty, 7) < 0.5 ? 0 : 1, density);
        if (tile) {
          context.drawImage(tile, px, py, DS, DS);
          if (dim < 1) { // fog-memory dim overlay
            context.fillStyle = `rgba(6,8,11,${((1 - dim) * 0.62).toFixed(3)})`;
            context.fillRect(px, py, DS, DS);
          }
          continue;
        }

        // Procedural fallback: varied base fill + per-terrain detail + soft edges.
        const v = tileHash(tx, ty, 1);
        context.fillStyle = shade(mix(style.base, v < 0.5 ? style.dark : style.light, 0.22), dim);
        context.fillRect(px, py, DS, DS);
        drawTerrainDetail(type, style, tx, ty, px, py, dim);
        drawTerrainEdges(type, style, tx, ty, px, py, dim, width, height, fog);
      }
    }
  }

  // Blend each tile edge toward a differing neighbour + ambient shadow under raised
  // rock, so the terrain reads as continuous ground instead of a grid of squares.
  function drawTerrainEdges(
    type: string, style: TerrainStyle, tx: number, ty: number, px: number, py: number,
    dim: number, width: number, height: number, fog: { visible: Set<string>; explored: Set<string> } | undefined,
  ): void {
    const S = TILE_SIZE_PX, B = 6; // blend-strip width
    const sides: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of sides) {
      const nx = tx + dx, ny = ty + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (fog && !fog.explored.has(`${nx},${ny}`)) continue;
      const nt = simState.grid.terrainAt({ tx: nx, ty: ny });
      if (nt === type) continue;
      const nStyle = TERRAIN[nt] ?? TERRAIN_FALLBACK;

      // Feathered strip of the blended colour hugging the shared edge.
      context.fillStyle = shade(mix(style.base, nStyle.base, 0.5), dim);
      context.globalAlpha = 0.45;
      if (dx === 1) context.fillRect(px + S - B, py, B, S);
      else if (dx === -1) context.fillRect(px, py, B, S);
      else if (dy === 1) context.fillRect(px, py + S - B, S, B);
      else context.fillRect(px, py, S, B);

      // Ambient shadow cast FROM a raised neighbour ONTO this lower tile.
      if (RAISED_TERRAIN.has(nt) && !RAISED_TERRAIN.has(type)) {
        context.fillStyle = 'rgba(0,0,0,0.28)';
        context.globalAlpha = dim * 0.5;
        if (dx === 1) context.fillRect(px + S - 3, py, 3, S);
        else if (dx === -1) context.fillRect(px, py, 3, S);
        else if (dy === 1) context.fillRect(px, py + S - 3, S, 3);
        else context.fillRect(px, py, S, 3);
      }
      context.globalAlpha = 1;
    }
  }

  // Cheap deterministic grain/cracks/ridges/flecks per terrain type.
  function drawTerrainDetail(type: string, style: TerrainStyle, tx: number, ty: number, px: number, py: number, dim: number): void {
    const S = TILE_SIZE_PX;
    if (type === 'ROCK') {
      // Blocky facets + a couple of dark cracks.
      context.fillStyle = shade(style.dark, dim);
      for (let i = 0; i < 3; i++) {
        const hx = tileHash(tx, ty, 10 + i), hy = tileHash(tx, ty, 20 + i);
        context.fillRect(px + Math.floor(hx * (S - 8)), py + Math.floor(hy * (S - 8)), 4 + Math.floor(hx * 4), 3 + Math.floor(hy * 3));
      }
      context.fillStyle = shade(style.light, dim);
      context.fillRect(px + 2, py + 2, S - 4, 1);
    } else if (type === 'SHARD') {
      // Crystalline flecks that catch light (the resource — should draw the eye).
      for (let i = 0; i < 5; i++) {
        const hx = tileHash(tx, ty, 30 + i), hy = tileHash(tx, ty, 40 + i);
        context.fillStyle = shade(i % 2 ? style.light : '#e6d4ff', dim);
        const s = 2 + Math.floor(tileHash(tx, ty, 50 + i) * 2);
        context.fillRect(px + Math.floor(hx * (S - s)), py + Math.floor(hy * (S - s)), s, s);
      }
    } else if (type === 'DUNE') {
      // Wind ridges (a couple of light horizontal streaks + shadow under each).
      context.fillStyle = shade(style.light, dim);
      const r = Math.floor(tileHash(tx, ty, 60) * (S - 12)) + 4;
      context.fillRect(px + 3, py + r, S - 6, 2);
      context.fillStyle = shade(style.dark, dim);
      context.fillRect(px + 3, py + r + 2, S - 6, 1);
    } else {
      // SAND / DEEP_SAND / other: scattered grain speckles.
      for (let i = 0; i < 4; i++) {
        const hx = tileHash(tx, ty, 70 + i), hy = tileHash(tx, ty, 80 + i);
        context.fillStyle = shade(hx < 0.5 ? style.dark : style.light, dim);
        context.fillRect(px + Math.floor(hx * (S - 3)), py + Math.floor(hy * (S - 3)), 2, 2);
      }
    }
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
  // Multiply brightness (factor 1 = original, 0 = black) — used for fog dimming.
  function shade(hex: string, factor: number): string {
    const [r, g, b] = rgb(hex);
    return `#${toHex(r * factor)}${toHex(g * factor)}${toHex(b * factor)}`;
  }
  // Linear blend a→b by t in [0,1].
  function mix(a: string, b: string, t: number): string {
    const [ar, ag, ab] = rgb(a);
    const [br, bg, bb] = rgb(b);
    return `#${toHex(ar + (br - ar) * t)}${toHex(ag + (bg - ag) * t)}${toHex(ab + (bb - ab) * t)}`;
  }

  // Angle (radians) a unit should face: toward its combat target, else its move
  // target, else "up". Gives vehicles/troops real orientation instead of a static blob.
  function facingAngle(e: ReturnType<typeof simState.store.all>[number], pos: WorldPos): number {
    const combat = e.components.combat;
    if (combat?.targetId != null) {
      const t = simState.store.get(combat.targetId);
      const tp = t?.components.position;
      if (tp) return Math.atan2(tp.wy - pos.wy, tp.wx - pos.wx);
    }
    const mv = e.components.movement;
    if (mv?.target) return Math.atan2(mv.target.wy - pos.wy, mv.target.wx - pos.wx);
    return -Math.PI / 2; // face up
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

      if (e.components.building) {
        // Baked lit body (S7-2) + live animated accents on top.
        sprites.drawBuildingBody(context, kind, teamKey, sx, sy, frame, camera.zoom);
        drawBuildingAccents(kind, sx, sy, style, camera.zoom);
      } else {
        // Cargo glow (harvester) draws under the baked sprite, then the sprite.
        drawUnitUnderlay(e, kind, sx, sy, camera.zoom);
        sprites.drawUnit(context, kind, teamKey, undefined, facingAngle(e, interp), sx, sy, frame, camera.zoom);
      }
    }
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
    const S = TILE_SIZE_PX * scale, t = frame;
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
    frame += 1;
    edgeScroll();   // move mouse to a screen edge → scroll the view (C&C/RA)
    clampCamera();  // keep the view on the map after any pan/zoom
    // Clear canvas
    context.fillStyle = '#000000';
    context.fillRect(0, 0, canvas.width, canvas.height);

    drawTerrain();
    drawSlabs();
    drawDecals();
    drawProjectiles();
    drawEntities();
    drawParticles();
    drawRankChevrons();
    drawSelectionRings();
    drawBoxSelection();
    drawConfirmationMarkers();
    drawHealthBars();
    drawVictoryBanner();
    drawPlacementGhost();

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
      for (let i = 0; i < steps; i += 1) {
        runTick(simState, systems);
        detectCombatFx(); // read sim transitions (deaths, shots) → spawn view FX
      }
      accMs = remainderMs;
    }

    stepParticles();
    stepDecals();
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
    spriteBank: sprites,
    hudButtonAt: (sx, sy) => hud.buttonAt(sx, sy),
    minimapRect,
    minimapJump(sx: number, sy: number): boolean {
      if (onboarding?.briefingActive()) return false;
      const r = minimapRect();
      if (sx < r.x || sx > r.x + r.w || sy < r.y || sy > r.y + r.h) return false;
      centerOn(((sx - r.x) / r.w) * worldW, ((sy - r.y) / r.h) * worldH);
      return true;
    },
  };
}
