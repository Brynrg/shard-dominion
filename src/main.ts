// ── Main: bootstrap the game ──────────────────────────────────────────────────
// Creates sim state, entities, systems, and starts the renderer.
import { makeSimState } from './sim/state.js';
import { orderSystems } from './sim/loop.js';
import { makeMovementSystem } from './sim/systems/movement.js';
import { makeView } from './view/index.js';
import { tileToWorldCenter } from './sim/coords.js';

// Map configuration
const MAP_WIDTH = 32;
const MAP_HEIGHT = 32;

// Expose debug hook for liveness test
declare global {
  interface Window {
    __debugHarvesterScreenPos?: () => { x: number; y: number } | null;
  }
}

export function bootstrap(): void {
  // Create sim state
  const state = makeSimState({
    seed: 42,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
  });

  // Create refinery (static) at map center
  const centerTile = tileToWorldCenter({ tx: Math.floor(MAP_WIDTH / 2), ty: Math.floor(MAP_HEIGHT / 2) });
  state.store.create({
    position: centerTile,
    building: { onSlab: true, buildProgress: 100, powered: true },
    faction: { team: 'player', faction: 'refinery' },
  });

  // Create harvester with movement target
  const harvesterPos = tileToWorldCenter({ tx: Math.floor(MAP_WIDTH / 2) + 2, ty: Math.floor(MAP_HEIGHT / 2) });
  const harvesterTarget = tileToWorldCenter({ tx: Math.floor(MAP_WIDTH / 2) - 2, ty: Math.floor(MAP_HEIGHT / 2) });
  state.store.create({
    position: harvesterPos,
    movement: { target: harvesterTarget, path: [], speed: 10 }, // 10 world units per tick
    faction: { team: 'player', faction: 'harvester' },
  });

  // Register systems
  const systems = orderSystems([makeMovementSystem()]);

  // Get canvas
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) throw new Error('Canvas element not found');
  canvas.width = 800;
  canvas.height = 600;

  // Create and start view
  const view = makeView({
    canvas,
    simState: state,
    systems,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
  });
  view.start();

  // Expose debug hook
  window.__debugHarvesterScreenPos = () => {
    const harvester = state.store.all().find(e => e.components.movement);
    if (!harvester || !harvester.components.position) return null;
    const cam = view.getCamera();
    const { x, y } = cam;
    const zoom = cam.zoom;
    const wx = harvester.components.position.wx;
    const wy = harvester.components.position.wy;
    const TILE_SUBUNITS = 256;
    const TILE_SIZE_PX = 32;
    const WORLD_PER_PX = TILE_SUBUNITS / TILE_SIZE_PX;
    const sx = ((wx - x) / WORLD_PER_PX) * zoom;
    const sy = ((wy - y) / WORLD_PER_PX) * zoom;
    return { x: sx, y: sy };
  };
}

// Auto-bootstrap on load
if (typeof window !== 'undefined') {
  window.addEventListener('load', bootstrap);
}
