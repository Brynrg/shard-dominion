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
  let frame = 0; // monotonic render-frame counter, drives idle building animation

  // Use ctx as non-null after the check
  const context = ctx as CanvasRenderingContext2D;

  // Create HUD
  const hud = makeHUD({ canvas, simState, camera });

  // ── Combat FX (view-only juice) ─────────────────────────────────────────────
  // Muzzle flashes when a unit fires and explosions when one dies. Detected by
  // diffing sim state frame-to-frame (no sim/contract changes). The view MAY use
  // wall-clock + randomness (the sim may not) — particles live here, not in sim.
  interface Particle {
    wx: number; wy: number; vx: number; vy: number;
    life: number; max: number; size: number; kind: 'flash' | 'debris' | 'ring';
    hue: string;
  }
  const particles: Particle[] = [];
  const prevAlive = new Map<EntityId, { wx: number; wy: number; team: string; big: boolean }>();
  const prevCooldown = new Map<EntityId, number>();
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
      }
      prevCooldown.set(e.id, cd);
    }
    // Deaths: anything we saw last tick that's gone now.
    if (fxSeeded) {
      for (const [id, info] of prevAlive) {
        if (!alive.has(id)) spawnExplosion(info.wx, info.wy, info.big);
      }
    }
    for (const id of prevAlive.keys()) if (!alive.has(id)) { prevAlive.delete(id); prevCooldown.delete(id); }
    fxSeeded = true;
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
      context.globalAlpha = p.kind === 'ring' ? t * 0.6 : t;
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
      } else {
        context.fillStyle = p.hue;
        context.fillRect(s.sx - p.size / 2, s.sy - p.size / 2, p.size, p.size);
      }
    }
    context.globalAlpha = 1;
  }

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

        // Soft edges: blend toward differing neighbours so hard grid seams dissolve,
        // and drop an ambient shadow where a RAISED neighbour (rock/cliff) abuts.
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

  // ── Building sprites: extruded block (lit roof + dark front face) + detail ─────
  function drawBuilding(kind: string, sx: number, sy: number, style: TeamStyle): void {
    const S = TILE_SIZE_PX;
    const big = kind === 'construction_yard' || kind === 'refinery';
    const w = big ? S * 1.5 : S * 0.94;
    const h = big ? S * 1.2 : S * 0.82;
    const depth = big ? 8 : 6;                 // extruded front-face height
    const x = sx - w / 2, y = sy - h / 2;
    const t = frame;

    // Grounding shadow (offset down-right for the top-left key light).
    context.fillStyle = 'rgba(0,0,0,0.35)';
    rr(x + 4, y + h - 1, w, depth + 5, 3); context.fill();

    // Extruded FRONT face (darkest, gives height).
    context.fillStyle = mix(style.hullDark, '#000', 0.42);
    context.fillRect(x, y + h - 2, w, depth + 2);
    // ROOF: vertical gradient, lighter at the top (sunlit).
    const g = context.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, mix(style.hull, '#fff', 0.16));
    g.addColorStop(1, mix(style.hullDark, '#000', 0.05));
    context.fillStyle = g;
    context.fillRect(x, y, w, h);
    // Panel seams + corner rivets for surface detail.
    context.strokeStyle = 'rgba(0,0,0,0.22)'; context.lineWidth = 1;
    context.beginPath();
    context.moveTo(x, y + h * 0.5); context.lineTo(x + w, y + h * 0.5); context.stroke();
    context.fillStyle = 'rgba(255,255,255,0.18)';
    for (const rx of [x + 3, x + w - 5]) for (const ry of [y + 3, y + h - 6]) context.fillRect(rx, ry, 2, 2);

    // Team accent trim.
    context.strokeStyle = style.stripe; context.lineWidth = 2;
    context.strokeRect(x + 1, y + 1, w - 2, h - 2);

    if (kind === 'refinery') {
      // Two silo cylinders (shaded) + dock bay + animated exhaust puff.
      for (const cx of [x + w * 0.24, x + w * 0.44]) {
        const cg = context.createLinearGradient(cx - w * 0.11, 0, cx + w * 0.11, 0);
        cg.addColorStop(0, mix(style.accent, '#000', 0.25));
        cg.addColorStop(0.4, style.accent);
        cg.addColorStop(1, mix(style.accent, '#000', 0.4));
        context.fillStyle = cg;
        rr(cx - w * 0.1, y + h * 0.2, w * 0.2, h * 0.55, 3); context.fill();
        context.strokeStyle = 'rgba(0,0,0,0.3)'; context.lineWidth = 1; context.stroke();
      }
      context.fillStyle = mix(style.hull, '#000', 0.25); // dock bay
      rr(x + w * 0.58, y + h * 0.45, w * 0.36, h * 0.48, 2); context.fill();
      // exhaust puff rising + fading
      const puff = (t % 90) / 90;
      context.globalAlpha = (1 - puff) * 0.35;
      context.fillStyle = '#cfc6bb';
      context.beginPath(); context.arc(x + w * 0.34, y - puff * 14, 3 + puff * 5, 0, Math.PI * 2); context.fill();
      context.globalAlpha = 1;
    } else if (kind === 'barracks') {
      context.fillStyle = mix(style.hull, '#fff', 0.14); // roof ridge
      context.fillRect(x + 4, y + 4, w - 8, 4);
      context.fillStyle = '#140e09'; // door
      rr(sx - w * 0.13, y + h * 0.44, w * 0.26, h * 0.56, 2); context.fill();
      context.fillStyle = style.accent; // lamp over the door
      context.fillRect(sx - 2, y + h * 0.4, 4, 3);
    } else if (kind === 'construction_yard') {
      // Crane arm + rotating hook + blinking hazard beacon.
      context.strokeStyle = mix(style.accent, '#000', 0.1); context.lineWidth = 3;
      context.beginPath();
      context.moveTo(sx - w * 0.32, y + 6); context.lineTo(sx + w * 0.36, y - h * 0.16); context.stroke();
      const hook = sx - w * 0.32 + (Math.sin(t * 0.04) * 0.5 + 0.5) * (w * 0.68);
      context.strokeStyle = '#3a352a'; context.lineWidth = 1.5;
      context.beginPath(); context.moveTo(hook, y + 2); context.lineTo(hook, y + h * 0.35); context.stroke();
      context.fillStyle = (t % 40) < 20 ? '#ff4a3d' : '#5a1a14'; // beacon blink
      context.beginPath(); context.arc(sx + w * 0.36, y - h * 0.16, 3, 0, Math.PI * 2); context.fill();
    } else if (kind === 'power_node') {
      context.strokeStyle = mix(style.accent, '#000', 0.1); context.lineWidth = 2;
      context.beginPath(); context.moveTo(sx, y + 2); context.lineTo(sx, y - h * 0.34); context.stroke();
      context.fillStyle = (t % 60) < 30 ? '#00e5ff' : '#0a5563';
      context.fillRect(sx - 2, y - h * 0.34 - 3, 4, 4);
    } else {
      context.fillStyle = style.accent; // lit windows
      for (const dx of [-0.24, 0.02]) for (const dy of [0.3, 0.58])
        context.fillRect(sx + w * dx, y + h * dy, w * 0.18, h * 0.16);
    }
  }

  // Draw a pair of tank treads down the local ±y sides (local +x = forward), with
  // segment ticks so tracked units read as machines, not blobs.
  function treads(l: number, w: number, tw: number): void {
    for (const sign of [-1, 1]) {
      const ty = sign * w - (sign < 0 ? tw : 0);
      context.fillStyle = '#232019';
      context.fillRect(-l, ty, l * 2, tw);
      context.fillStyle = '#3b352a';
      context.fillRect(-l, ty, l * 2, tw * 0.32); // top-lit edge
      context.fillStyle = '#17140f';
      for (let x = -l + 2; x < l - 1; x += 4) context.fillRect(x, ty + tw * 0.4, 2, tw * 0.5); // links
    }
  }
  // Rounded-rect path helper (local coords).
  function rr(x: number, y: number, w: number, h: number, r: number): void {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  // ── Unit sprites: tracked/shaded chassis oriented to facing (§11.1 → S7 art) ──
  function drawUnit(
    e: ReturnType<typeof simState.store.all>[number],
    kind: string, sx: number, sy: number, style: TeamStyle, angle: number,
  ): void {
    const S = TILE_SIZE_PX;
    const combat = e.components.combat;
    const weaponType = combat?.weaponId ? weapons?.weapons[combat.weaponId]?.type : undefined;

    // Soft contact shadow, offset down-right for a consistent top-left key light.
    context.fillStyle = 'rgba(0,0,0,0.32)';
    context.beginPath();
    context.ellipse(sx + 2, sy + S * 0.32, S * 0.34, S * 0.15, 0, 0, Math.PI * 2);
    context.fill();

    context.save();
    context.translate(sx, sy);
    context.rotate(angle);

    const outline = 'rgba(0,0,0,0.55)';

    if (kind === 'infantry' || kind === 'rocket_trooper') {
      // Trooper: boots shadow, shaded torso, helmet with highlight, weapon tell.
      const r = S * 0.19;
      // torso
      context.fillStyle = style.hullDark;
      rr(-r * 0.9, -r * 0.8, r * 1.8, r * 1.6, r * 0.6); context.fill();
      context.fillStyle = style.hull;
      rr(-r * 0.9, -r * 0.8, r * 1.8, r * 0.9, r * 0.5); context.fill();
      // helmet
      context.fillStyle = mix(style.hull, '#ffffff', 0.12);
      context.beginPath(); context.arc(r * 0.15, 0, r * 0.62, 0, Math.PI * 2); context.fill();
      context.fillStyle = mix(style.hull, '#000', 0.25);
      context.beginPath(); context.arc(r * 0.15, r * 0.18, r * 0.62, 0.15, Math.PI - 0.15); context.fill();
      if (weaponType === 'ROCKET') {
        context.fillStyle = '#2f2a22';
        context.fillRect(-r * 0.2, -r * 1.05, r * 1.9, r * 0.52); // launcher tube
        context.fillStyle = '#ffce54';
        context.fillRect(r * 1.45, -r * 1.05, r * 0.3, r * 0.52); // warhead
      } else {
        context.fillStyle = '#201d17';
        context.fillRect(0, -r * 0.16, r * 1.7, r * 0.32); // rifle
      }
    } else if (kind === 'vehicle') {
      // Light tank: treads, beveled hull, rotating turret + barrel.
      const l = S * 0.34, w = S * 0.2;
      treads(l * 0.92, w, S * 0.14);
      // hull
      context.save();
      context.fillStyle = style.hull;
      context.beginPath();
      context.moveTo(l, 0); context.lineTo(l * 0.55, -w); context.lineTo(-l * 0.85, -w);
      context.lineTo(-l, 0); context.lineTo(-l * 0.85, w); context.lineTo(l * 0.55, w);
      context.closePath();
      context.fill();
      context.fillStyle = mix(style.hull, '#fff', 0.16); // top-lit deck
      context.beginPath();
      context.moveTo(l, 0); context.lineTo(l * 0.55, -w); context.lineTo(-l * 0.85, -w); context.lineTo(-l, 0);
      context.closePath(); context.fill();
      context.lineWidth = 1.2; context.strokeStyle = outline; context.stroke();
      context.restore();
      // turret
      context.fillStyle = style.hullDark;
      context.beginPath(); context.arc(-l * 0.1, 0, w * 0.85, 0, Math.PI * 2); context.fill();
      context.fillStyle = mix(style.hullDark, '#fff', 0.2);
      context.beginPath(); context.arc(-l * 0.1, -w * 0.2, w * 0.5, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#201d17';
      context.fillRect(-l * 0.1, -2.2, l * 1.15, 4.4); // barrel
      context.fillStyle = style.stripe; // muzzle band
      context.fillRect(l * 1.0, -2.2, 3, 4.4);
    } else if (kind === 'harvester') {
      // Ore hauler: wide treads, ribbed hopper, ore glow when carrying cargo.
      const l = S * 0.42, w = S * 0.26;
      const cargo = e.components.harvest?.cargo ?? 0;
      treads(l * 0.95, w, S * 0.16);
      context.fillStyle = mix(style.hull, '#8a7a53', 0.45);
      context.beginPath();
      context.moveTo(l, -w * 0.8); context.lineTo(l, w * 0.8);
      context.lineTo(-l, w); context.lineTo(-l, -w); context.closePath(); context.fill();
      context.fillStyle = mix(style.hull, '#fff', 0.1);
      context.fillRect(-l, -w, l * 2, w * 0.5); // lit top
      context.strokeStyle = outline; context.lineWidth = 1.2; context.stroke();
      // hopper ribs
      context.fillStyle = '#2c2418';
      for (let x = -l * 0.6; x < l * 0.7; x += 5) context.fillRect(x, -w * 0.55, 2, w * 1.1);
      // ore load glow
      if (cargo > 0) {
        context.fillStyle = '#c9a6ff';
        context.globalAlpha = Math.min(1, 0.35 + cargo / 700);
        context.fillRect(-l * 0.55, -w * 0.4, l * 0.6, w * 0.8);
        context.globalAlpha = 1;
      }
      context.fillStyle = '#3a2f1c';
      context.fillRect(l * 0.55, -w * 0.55, l * 0.45, w * 1.1); // intake mouth
    } else if (kind === 'mcv') {
      // Heavy crawler: broad treads, folded construction core, warning beacon.
      const l = S * 0.44, w = S * 0.28;
      treads(l * 0.95, w, S * 0.17);
      context.fillStyle = style.hull;
      context.beginPath();
      context.moveTo(l, 0); context.lineTo(l * 0.55, -w); context.lineTo(-l * 0.6, -w);
      context.lineTo(-l, 0); context.lineTo(-l * 0.6, w); context.lineTo(l * 0.55, w);
      context.closePath(); context.fill();
      context.fillStyle = mix(style.hull, '#fff', 0.14);
      context.fillRect(-l * 0.6, -w, l * 1.15, w * 0.5);
      context.strokeStyle = outline; context.lineWidth = 1.3; context.stroke();
      context.fillStyle = style.accent; // deploy core
      rr(-l * 0.32, -w * 0.45, l * 0.64, w * 0.9, 2); context.fill();
      context.fillStyle = style.hullDark;
      rr(-l * 0.2, -w * 0.28, l * 0.4, w * 0.56, 2); context.fill();
      context.fillStyle = '#ffd36b'; // beacon
      context.beginPath(); context.arc(l * 0.35, 0, 2.4, 0, Math.PI * 2); context.fill();
    } else {
      const h = S * 0.26;
      context.fillStyle = style.hull;
      rr(-h, -h, h * 2, h * 2, 3); context.fill();
      context.strokeStyle = outline; context.lineWidth = 1.3; context.stroke();
    }

    context.restore();
  }

  function render() {
    frame += 1;
    // Clear canvas
    context.fillStyle = '#000000';
    context.fillRect(0, 0, canvas.width, canvas.height);

    drawTerrain();
    drawSlabs();
    drawEntities();
    drawParticles();
    drawSelectionRings();
    drawBoxSelection();
    drawConfirmationMarkers();
    drawHealthBars();
    drawVictoryBanner();
    drawPlacementGhost();

    // The mission briefing owns the whole screen — hide the HUD behind it so the
    // COMMAND panel doesn't bleed past the briefing frame.
    const briefing = onboarding?.briefingActive() ?? false;
    if (!briefing) hud.draw();

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
      for (let i = 0; i < steps; i += 1) {
        runTick(simState, systems);
        detectCombatFx(); // read sim transitions (deaths, shots) → spawn view FX
      }
      accMs = remainderMs;
    }

    stepParticles();
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
