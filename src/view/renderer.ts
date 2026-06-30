// ── View: canvas renderer, camera, rAF driver ─────────────────────────────────
// Wall-clock + rAF live here; the sim itself never reads wall-clock.
import type { SimState } from '../sim/state.js';
import type { Camera, WorldPos } from '../sim/coords.js';
import { worldToScreen, tileToWorldCenter } from '../sim/coords.js';
import { TILE_SIZE_PX, TILE_SUBUNITS } from '../sim/coords.js';
import { asTick } from '../sim/ids.js';

// Terrain colors (simple palette)
const TERRAIN_COLORS: Record<string, string> = {
  SAND: '#f4e4bc',
  ROCK: '#8b7355',
  DUNE: '#e6c288',
  DEEP_SAND: '#d4b483',
  SHARD: '#a67c52',
  IMPASSABLE: '#555555',
};

// Entity colors
const ENTITY_COLORS: Record<string, string> = {
  harvester: '#4a90e2',
  refinery: '#e24a4a',
};

export interface ViewConfig {
  canvas: HTMLCanvasElement;
  simState: SimState;
  systems: readonly { name: string; run: (s: SimState) => void }[];
  mapWidth: number;
  mapHeight: number;
}

export interface View {
  start(): void;
  stop(): void;
  getCamera(): Camera;
  setCamera(cam: Camera): void;
}

export function makeView(cfg: ViewConfig): View {
  const { canvas, simState, systems, mapWidth, mapHeight } = cfg;
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
      const alpha = Math.min(1, accMs / 50); // 50ms = 1 tick
      const interpPos: WorldPos = prevPos
        ? {
            wx: prevPos.wx + (pos.wx - prevPos.wx) * alpha,
            wy: prevPos.wy + (pos.wy - prevPos.wy) * alpha,
          }
        : pos;

      const screenPos = worldToScreen(interpPos, camera);
      let color = ENTITY_COLORS['harvester'];
      if (e.components.building) color = ENTITY_COLORS['refinery'];
      context.fillStyle = color ?? '#ffffff';
      const size = TILE_SIZE_PX * 0.8;
      context.fillRect(
        Math.floor(screenPos.sx - size / 2),
        Math.floor(screenPos.sy - size / 2),
        size,
        size,
      );

      // Draw a border
      context.strokeStyle = '#ffffff';
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
    drawEntities();
  }

  function loop(now: number) {
    if (!running) return;

    const dt = now - lastTime;
    lastTime = now;

    // Accumulate time and run ticks
    accMs += dt;
    let steps = 0;
    while (accMs >= 50 && steps < 5) {
      accMs -= 50;
      steps += 1;
    }
    if (steps > 0) {
      // Snapshot prev positions before mutation
      simState.prevPositions.clear();
      for (const e of simState.store.all()) {
        if (e.components.position) {
          simState.prevPositions.set(e.id, e.components.position);
        }
      }
      // Run systems
      for (const sys of systems) {
        sys.run(simState);
      }
      simState.tick = asTick(Number(simState.tick) + 1);
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
