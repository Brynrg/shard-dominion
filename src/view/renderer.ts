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

// Terrain colors (simple palette)
const TERRAIN_COLORS: Record<string, string> = {
  SAND: '#f4e4bc',
  ROCK: '#8b7355',
  DUNE: '#e6c288',
  DEEP_SAND: '#d4b483',
  SHARD: '#a67c52',
  IMPASSABLE: '#555555',
};

// Slab color
const SLAB_COLOR = '#808080';

// Entity colors
const ENTITY_COLORS: Record<string, string> = {
  harvester: '#4a90e2',
  refinery: '#e24a4a',
};

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
}

export interface View {
  start(): void;
  stop(): void;
  getCamera(): Camera;
  setCamera(cam: Camera): void;
}

export function makeView(cfg: ViewConfig): View {
  const { canvas, simState, systems, mapWidth, mapHeight, confirmationMarkers, getSelectionBox, getPlacementMode, structures = [], getVictory, weapons = { matrix: {}, weapons: {} } } = cfg;
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

  function drawTerrain() {
    const { width, height } = simState.grid;
    for (let ty = 0; ty < height; ty++) {
      for (let tx = 0; tx < width; tx++) {
        const type = simState.grid.terrainAt({ tx, ty });
        const color = TERRAIN_COLORS[type] ?? '#888888';
        const tilePos = tileToWorldCenter({ tx, ty });
        const screenPos = worldToScreen(tilePos, camera);
        context.fillStyle = color;
        context.fillRect(
          Math.floor(screenPos.sx - TILE_SIZE_PX / 2),
          Math.floor(screenPos.sy - TILE_SIZE_PX / 2),
          TILE_SIZE_PX,
          TILE_SIZE_PX,
        );
      }
    }
  }

  function drawEntities() {
    for (const e of simState.store.all()) {
      const pos = e.components.position;
      if (!pos) continue;

      // Interpolate between prev and current for smooth movement
      const prevPos = simState.prevPositions.get(e.id);
      const alpha = Math.min(1, accMs / STEP_MS);
      const interpPos: WorldPos = prevPos
        ? {
            wx: prevPos.wx + (pos.wx - prevPos.wx) * alpha,
            wy: prevPos.wy + (pos.wy - prevPos.wy) * alpha,
          }
        : pos;

      const screenPos = worldToScreen(interpPos, camera);
      
      // Determine glyph shape and color based on weapon type for combat units
      let color = ENTITY_COLORS['harvester'];
      if (e.components.building) color = ENTITY_COLORS['refinery'];
      
      let strokeColor = '#ffffff';
      const size = TILE_SIZE_PX * 0.8;
      
      // Check if this is a combat unit
      const combat = e.components.combat;
      if (combat && combat.weaponId) {
        const weaponType = weapons?.weapons[combat.weaponId]?.type;
        const team = e.components.faction?.team;
        
        // Team tint via outline (player cyan, enemy red)
        if (team === 'player') {
          strokeColor = '#00ffff'; // cyan
        } else if (team === 'enemy') {
          strokeColor = '#ff0000'; // red
        }
        
        // Shape + fill by weapon type (role reads from shape)
        // BULLET -> small filled CIRCLE (anti-infantry)
        // ROCKET -> upward TRIANGLE (anti-vehicle)
        // SHELL -> filled SQUARE w/ a bar (anti-armor)
        // default -> keep the existing square
        if (weaponType === 'BULLET') {
          // Circle for BULLET (anti-infantry)
          context.fillStyle = color ?? '#ffffff';
          const radius = size * 0.35;
          context.beginPath();
          context.arc(screenPos.sx, screenPos.sy, radius, 0, Math.PI * 2);
          context.fill();
          context.strokeStyle = strokeColor;
          context.lineWidth = 2;
          context.stroke();
          continue;
        } else if (weaponType === 'ROCKET') {
          // Triangle for ROCKET (anti-vehicle)
          context.fillStyle = color ?? '#ffffff';
          const radius = size * 0.4;
          context.beginPath();
          context.moveTo(screenPos.sx, screenPos.sy - radius); // top
          context.lineTo(screenPos.sx - radius, screenPos.sy + radius); // bottom left
          context.lineTo(screenPos.sx + radius, screenPos.sy + radius); // bottom right
          context.closePath();
          context.fill();
          context.strokeStyle = strokeColor;
          context.lineWidth = 2;
          context.stroke();
          continue;
        } else if (weaponType === 'SHELL') {
          // Square with bar for SHELL (anti-armor)
          const half = size * 0.4;
          context.fillStyle = color ?? '#ffffff';
          context.fillRect(screenPos.sx - half, screenPos.sy - half, size * 0.8, size * 0.8);
          // Add horizontal bar
          context.fillRect(screenPos.sx - half, screenPos.sy - half * 0.5, size * 0.8, half);
          context.strokeStyle = strokeColor;
          context.lineWidth = 2;
          context.strokeRect(screenPos.sx - half, screenPos.sy - half, size * 0.8, size * 0.8);
          continue;
        }
      }
      
      // Default square for non-combat units
      context.fillStyle = color ?? '#ffffff';
      context.fillRect(
        Math.floor(screenPos.sx - size / 2),
        Math.floor(screenPos.sy - size / 2),
        size,
        size,
      );

      // Draw a border
      context.strokeStyle = strokeColor;
      context.lineWidth = 2;
      context.strokeRect(
        Math.floor(screenPos.sx - size / 2),
        Math.floor(screenPos.sy - size / 2),
        size,
        size,
      );
    }
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
  }

  function loop(now: number) {
    if (!running) return;

    const dt = now - lastTime;
    lastTime = now;

    // Contract fixed-timestep: accumulate() decides how many whole ticks to run;
    // runTick() snapshots prev positions, runs systems in SYSTEM_ORDER, and bumps
    // the tick. The leftover remainder is the interpolation alpha for render().
    const { steps, remainderMs } = accumulate(accMs, dt);
    for (let i = 0; i < steps; i += 1) runTick(simState, systems);
    accMs = remainderMs;

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
