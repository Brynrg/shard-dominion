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
}

export interface View {
  start(): void;
  stop(): void;
  getCamera(): Camera;
  setCamera(cam: Camera): void;
}

export function makeView(cfg: ViewConfig): View {
  const { canvas, simState, systems, mapWidth, mapHeight, confirmationMarkers, getSelectionBox, getPlacementMode, structures = [], getVictory, getFog, weapons = { matrix: {}, weapons: {} }, onboarding } = cfg;
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

  // Use ctx as non-null after the check
  const context = ctx as CanvasRenderingContext2D;

  // Create HUD
  const hud = makeHUD({ canvas, simState, camera });

  // Draw selection rings around selected entities
  function drawSelectionRings() {
    for (const e of simState.store.all()) {
      if (!e.components.selection?.selected) continue;
      const pos = e.components.position;
      if (!pos) continue;

      const screenPos = worldToScreen(pos, camera);
      const size = TILE_SIZE_PX * 0.8;

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
      const barWidth = TILE_SIZE_PX * 0.8;
      const barHeight = 4;
      const barX = screenPos.sx - barWidth / 2;
      const barY = screenPos.sy - TILE_SIZE_PX * 0.5;

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
          context.fillStyle = SLAB_COLOR;
          context.fillRect(
            Math.floor(screenPos.sx - TILE_SIZE_PX / 2),
            Math.floor(screenPos.sy - TILE_SIZE_PX / 2),
            TILE_SIZE_PX,
            TILE_SIZE_PX,
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
    const size = TILE_SIZE_PX * structure.footprint.w;

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
        const px = Math.floor(screenPos.sx - TILE_SIZE_PX / 2);
        const py = Math.floor(screenPos.sy - TILE_SIZE_PX / 2);

        if (!isExplored) {
          // Unexplored: solid near-black (no detail leaks the map shape).
          context.fillStyle = '#070707';
          context.fillRect(px, py, TILE_SIZE_PX, TILE_SIZE_PX);
          continue;
        }

        const style = TERRAIN[type] ?? TERRAIN_FALLBACK;
        // Explored-but-not-visible tiles are drawn dimmed (fog memory).
        const dim = isVisible ? 1 : 0.42;

        // Base fill, slightly varied per tile so large fields aren't a flat wash.
        const v = tileHash(tx, ty, 1);
        context.fillStyle = shade(mix(style.base, v < 0.5 ? style.dark : style.light, 0.22), dim);
        context.fillRect(px, py, TILE_SIZE_PX, TILE_SIZE_PX);

        // Per-terrain texture detail.
        drawTerrainDetail(type, style, tx, ty, px, py, dim);
      }
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
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
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

  function drawEntities() {
    const fog = getFog?.();
    // Draw buildings first (units render on top of their footprints).
    const ordered = [...simState.store.all()].sort((a, b) =>
      (a.components.building ? 0 : 1) - (b.components.building ? 0 : 1));

    for (const e of ordered) {
      const pos = e.components.position;
      if (!pos) continue;

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
      const style = (team && TEAM[team]) ? TEAM[team] : NEUTRAL_TEAM;
      const kind = e.components.faction?.faction ?? '';

      if (e.components.building) {
        drawBuilding(kind, sx, sy, style);
      } else {
        drawUnit(e, kind, sx, sy, style, facingAngle(e, interp));
      }
    }
  }

  // ── Building silhouettes: grounded footprint + team trim + type detail ────────
  function drawBuilding(kind: string, sx: number, sy: number, style: TeamStyle): void {
    const S = TILE_SIZE_PX;
    const big = kind === 'construction_yard' || kind === 'refinery';
    const w = big ? S * 1.5 : S * 0.92;
    const h = big ? S * 1.35 : S * 0.92;
    const x = sx - w / 2, y = sy - h / 2;

    // Drop shadow (grounds the structure).
    context.fillStyle = 'rgba(0,0,0,0.32)';
    context.fillRect(x + 3, y + h - 3, w, 5);

    // Body with a top-lit bevel (lighter top, darker base).
    context.fillStyle = mix(style.hullDark, '#000000', 0.15);
    context.fillRect(x, y, w, h);
    context.fillStyle = style.hullDark;
    context.fillRect(x, y, w, h * 0.55);
    context.fillStyle = mix(style.hull, '#ffffff', 0.08);
    context.fillRect(x + 2, y + 2, w - 4, 3);

    // Team accent trim.
    context.strokeStyle = style.stripe;
    context.lineWidth = 2;
    context.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    context.fillStyle = style.accent;
    if (kind === 'refinery') {
      // Two silo tanks + a dock bay.
      context.fillStyle = mix(style.hull, '#000', 0.1);
      context.fillRect(x + w * 0.5, y + h * 0.55, w * 0.45, h * 0.45); // bay
      context.fillStyle = style.accent;
      for (const cx of [x + w * 0.22, x + w * 0.4]) {
        context.beginPath();
        context.arc(cx, y + h * 0.42, w * 0.11, 0, Math.PI * 2);
        context.fill();
      }
    } else if (kind === 'barracks') {
      // Roof ridge + a door.
      context.fillStyle = mix(style.hull, '#fff', 0.1);
      context.fillRect(x + 3, y + 3, w - 6, 4);
      context.fillStyle = '#1c140e';
      context.fillRect(sx - w * 0.14, y + h * 0.5, w * 0.28, h * 0.5);
    } else if (kind === 'construction_yard') {
      // Heavy block with a crane arm + beacon.
      context.strokeStyle = style.accent;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(sx - w * 0.3, y + 6);
      context.lineTo(sx + w * 0.35, y - h * 0.18);
      context.stroke();
      context.fillStyle = style.stripe;
      context.beginPath();
      context.arc(sx + w * 0.35, y - h * 0.18, 3, 0, Math.PI * 2);
      context.fill();
    } else if (kind === 'power_node') {
      // Pylon with an antenna mast.
      context.strokeStyle = style.accent;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(sx, y + 2);
      context.lineTo(sx, y - h * 0.3);
      context.stroke();
      context.fillStyle = style.stripe;
      context.fillRect(sx - 2, y - h * 0.3 - 2, 4, 4);
    } else {
      // Generic building: a lit window grid.
      context.fillStyle = style.accent;
      for (const dx of [-0.22, 0.06]) for (const dy of [0.5, 0.72])
        context.fillRect(sx + w * dx, y + h * dy, w * 0.16, h * 0.14);
    }
  }

  // ── Unit silhouettes by chassis, oriented to facing (§11.1 geometric grammar) ─
  function drawUnit(
    e: ReturnType<typeof simState.store.all>[number],
    kind: string, sx: number, sy: number, style: TeamStyle, angle: number,
  ): void {
    const S = TILE_SIZE_PX;
    const combat = e.components.combat;
    const weaponType = combat?.weaponId ? weapons?.weapons[combat.weaponId]?.type : undefined;

    // Contact shadow.
    context.fillStyle = 'rgba(0,0,0,0.28)';
    context.beginPath();
    context.ellipse(sx, sy + S * 0.3, S * 0.32, S * 0.14, 0, 0, Math.PI * 2);
    context.fill();

    context.save();
    context.translate(sx, sy);
    context.rotate(angle);

    if (kind === 'infantry' || kind === 'rocket_trooper') {
      // Small trooper: rounded torso, head, + weapon tell (rocket = finned launcher).
      const r = S * 0.2;
      context.fillStyle = style.hull;
      context.beginPath();
      context.arc(0, 0, r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = style.hullDark;
      context.beginPath();
      context.arc(r * 0.2, 0, r * 0.55, 0, Math.PI * 2); // head, forward
      context.fill();
      if (weaponType === 'ROCKET') {
        // Twin-launcher tube over the shoulder.
        context.fillStyle = style.accent;
        context.fillRect(-r * 0.2, -r * 0.9, r * 1.6, r * 0.5);
        context.fillStyle = '#ffce54';
        context.fillRect(r * 1.2, -r * 0.9, r * 0.3, r * 0.5); // warhead tip
      } else {
        // Rifle barrel forward.
        context.fillStyle = '#2b2b2b';
        context.fillRect(0, -r * 0.15, r * 1.5, r * 0.3);
      }
    } else if (kind === 'vehicle') {
      // Light vehicle: wedge hull + rotating turret + barrel.
      const l = S * 0.34, w = S * 0.24;
      context.fillStyle = style.hull;
      context.beginPath();
      context.moveTo(l, 0);            // nose
      context.lineTo(-l * 0.7, -w);
      context.lineTo(-l, 0);
      context.lineTo(-l * 0.7, w);
      context.closePath();
      context.fill();
      context.strokeStyle = style.stripe;
      context.lineWidth = 1.5;
      context.stroke();
      // Turret + barrel.
      context.fillStyle = style.hullDark;
      context.beginPath();
      context.arc(0, 0, w * 0.7, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#2b2b2b';
      context.fillRect(0, -2, l * 1.1, 4);
    } else if (kind === 'harvester') {
      // Chunky ore hauler: trapezoid body + hopper mouth (muted, economy role).
      const l = S * 0.4, w = S * 0.3;
      context.fillStyle = mix(style.hull, '#8a7a53', 0.5);
      context.beginPath();
      context.moveTo(l, -w * 0.7);
      context.lineTo(l * 0.9, w * 0.7);
      context.lineTo(-l, w);
      context.lineTo(-l, -w);
      context.closePath();
      context.fill();
      context.strokeStyle = style.stripe;
      context.lineWidth = 1.5;
      context.stroke();
      context.fillStyle = '#3a2f1c';
      context.fillRect(l * 0.5, -w * 0.5, l * 0.5, w); // intake
    } else if (kind === 'mcv') {
      // Deployable crawler: wide hexagon body + treads.
      const l = S * 0.42, w = S * 0.3;
      context.fillStyle = style.hull;
      context.beginPath();
      context.moveTo(l, 0);
      context.lineTo(l * 0.5, -w);
      context.lineTo(-l * 0.5, -w);
      context.lineTo(-l, 0);
      context.lineTo(-l * 0.5, w);
      context.lineTo(l * 0.5, w);
      context.closePath();
      context.fill();
      context.strokeStyle = style.stripe;
      context.lineWidth = 2;
      context.stroke();
      context.fillStyle = style.accent;
      context.fillRect(-l * 0.3, -w * 0.4, l * 0.6, w * 0.8); // deploy core
    } else {
      // Unknown mobile entity: a small hull box.
      const h = S * 0.28;
      context.fillStyle = style.hull;
      context.fillRect(-h, -h, h * 2, h * 2);
      context.strokeStyle = style.stripe;
      context.lineWidth = 1.5;
      context.strokeRect(-h, -h, h * 2, h * 2);
    }

    context.restore();
  }

  function render() {
    // Clear canvas
    context.fillStyle = '#000000';
    context.fillRect(0, 0, canvas.width, canvas.height);

    drawTerrain();
    drawSlabs();
    drawEntities();
    drawSelectionRings();
    drawBoxSelection();
    drawConfirmationMarkers();
    drawHealthBars();
    drawVictoryBanner();
    drawPlacementGhost();

    // Draw HUD
    hud.draw();

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
      const { steps, remainderMs } = accumulate(accMs, dt);
      for (let i = 0; i < steps; i += 1) runTick(simState, systems);
      accMs = remainderMs;
    }

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
  };
}
