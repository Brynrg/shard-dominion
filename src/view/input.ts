// ── View: input handling → command intents queue ───────────────────────────────
// Mouse/keyboard capture wall-clock/DOM. The VIEW owns the camera, so it converts
// screen pixels → WORLD coords via the contract coord fns BEFORE queuing an intent;
// the command SimSystem then works purely in world space (it never sees the camera
// or the screen). Camera panning is a pure view action applied straight to the view
// camera — it never enters the sim.
import type { Camera, WorldPos, ScreenPos, TilePos } from '../sim/coords.js';
import { screenToWorld, screenToTile, TILE_SUBUNITS, TILE_SIZE_PX } from '../sim/coords.js';

const WORLD_PER_PX = TILE_SUBUNITS / TILE_SIZE_PX; // world units per screen px at zoom 1
const MIN_ZOOM = 0.55, MAX_ZOOM = 2.6;
import type { StructureDef } from '../loaders/structures.js';
import type { SimState } from '../sim/state.js';

/** Command intents queued from input. All coordinates are WORLD space. */
export type CommandIntent =
  | { type: 'select'; worldRect?: { minWx: number; minWy: number; maxWx: number; maxWy: number }; target?: WorldPos }
  | { type: 'deselect' }
  | { type: 'move'; target: WorldPos }
  // Context-sensitive right-click: the command system resolves it to attack (enemy at
  // the point), harvest (Shard tile), or move (open ground) for the selected units.
  | { type: 'order'; target: WorldPos; tile: TilePos }
  | { type: 'deploy' }
  | { type: 'place-structure'; structureId: string; tile: TilePos }
  | { type: 'assign-group'; group: number }
  | { type: 'recall-group'; group: number }
  | { type: 'train'; unitId: string };

/** The command queue (view writes, command system reads). */
export interface CommandQueue {
  push(intent: CommandIntent): void;
  drain(): CommandIntent[];
}

export function makeCommandQueue(): CommandQueue {
  const queue: CommandIntent[] = [];
  return {
    push(intent: CommandIntent): void {
      queue.push(intent);
    },
    drain(): CommandIntent[] {
      const result = queue.slice();
      queue.length = 0;
      return result;
    },
  };
}

export interface InputHandlers {
  start(): void;
  stop(): void;
  /** The live drag rectangle in SCREEN pixels, for the renderer to draw (null when idle). */
  getSelectionBox(): { x: number; y: number; width: number; height: number } | null;
  /** Get the current placement mode (structureId + tile) or null if not in placement mode. */
  getPlacementMode(): { structureId: string; tile: TilePos } | null;
  /** Set placement mode for a structure (or null to cancel). */
  setPlacementMode(structureId: string | null): void;
  /** Check if a ConYard exists in the sim. */
  hasConYard(): boolean;
  /** Set the sim state reference for hasConYard check. */
  setSimState(state: SimState): void;
  /** Last cursor position (canvas px) — for the HUD's hover highlight. */
  getCursor(): ScreenPos | null;
}

export function makeInputHandlers(
  canvas: HTMLCanvasElement,
  camera: Camera,
  queue: CommandQueue,
  panCamera: (dx: number, dy: number) => void,
  structures: StructureDef[],
  /** Optional briefing gate: while active, the first click dismisses the briefing
   *  (and grabs focus so keyboard works, incl. inside a portal iframe) instead of
   *  issuing a select/move order. */
  briefing?: { active(): boolean; dismiss(): void },
  /** Optional radar minimap: a left-click inside it recentres the camera and is
   *  swallowed (does not select/move units on the field). */
  minimap?: { jump(sx: number, sy: number): boolean },
  /** Optional sidebar build menu: a left-click on a build button queues a unit /
   *  enters structure placement (C&C-style), instead of selecting on the field. */
  hud?: { buttonAt(sx: number, sy: number): string | null },
  /** Optional UI sounds: button click / selection blip / order acknowledgment. */
  sfx?: { click(): void; select(): void; ack(): void; place(): void },
): InputHandlers {
  let selectStart: ScreenPos | null = null;
  let selectCurrent: ScreenPos | null = null;
  let placementMode: { structureId: string; tile: TilePos } | null = null;
  let simStateRef: SimState | null = null;
  let panLast: { x: number; y: number } | null = null; // middle-drag pan anchor
  let lastCursor: ScreenPos | null = null;             // for HUD hover + context cursor

  // C&C-style build-button click: queue a unit or enter structure placement.
  function doBuildAction(action: string): void {
    const [kind, id] = action.split(':');
    if (kind === 'train' && id) queue.push({ type: 'train', unitId: id });
    else if (kind === 'build' && id) setPlacementMode(id);
  }

  // Context cursor (C&C feel): crosshair over enemies, pointer over own units /
  // buttons, cell in placement mode, grab while panning.
  function updateCursor(pos: ScreenPos): void {
    let c = 'default';
    if (placementMode) c = 'cell';
    else if (hud?.buttonAt(pos.sx, pos.sy)) c = 'pointer';
    else if (simStateRef) {
      const w = screenToWorld(pos, camera);
      let enemy = false, own = false;
      for (const e of simStateRef.store.all()) {
        const p = e.components.position;
        if (!p) continue;
        if (Math.hypot(p.wx - w.wx, p.wy - w.wy) < 180) { // ~0.7 tile
          const team = e.components.faction?.team;
          if (team === 'enemy') enemy = true; else if (team === 'player') own = true;
        }
      }
      c = enemy ? 'crosshair' : own ? 'pointer' : 'default';
    }
    canvas.style.cursor = c;
  }

  // ── Camera: mouse-wheel zoom (to cursor) + middle-drag pan. The contract transform
  //    already applies cam.zoom, so we just mutate the live camera object. ──────────
  function zoomAt(sx: number, sy: number, factor: number): void {
    const before = screenToWorld({ sx, sy }, camera);
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, camera.zoom * factor));
    // Keep the world point under the cursor fixed as zoom changes.
    Object.assign(camera, { x: before.wx - (sx / z) * WORLD_PER_PX, y: before.wy - (sy / z) * WORLD_PER_PX, zoom: z });
  }
  function onWheel(e: WheelEvent): void {
    e.preventDefault();
    const pos = getMousePos(e);
    zoomAt(pos.sx, pos.sy, e.deltaY < 0 ? 1.12 : 1 / 1.12);
  }
  function scaleXY(): { sx: number; sy: number } {
    const rect = canvas.getBoundingClientRect();
    return { sx: rect.width > 0 ? canvas.width / rect.width : 1, sy: rect.height > 0 ? canvas.height / rect.height : 1 };
  }
  // End a middle-drag even if the button is released outside the canvas.
  function onWindowMouseUp(e: MouseEvent): void { if (e.button === 1) panLast = null; }
  // Cursor left the canvas → stop edge-scroll (clear the tracked cursor).
  function onMouseLeave(): void { lastCursor = null; panLast = null; }

  function getMousePos(e: MouseEvent): ScreenPos {
    const rect = canvas.getBoundingClientRect();
    // Map CSS-pixel cursor coords → the canvas's INTERNAL pixel space. The canvas
    // renders at a fixed 800×600 backing store but is displayed at whatever size CSS
    // (or the portal iframe) gives it, so we must scale by width/height ratios — else
    // every click lands at the wrong world point and selection silently fails.
    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
    return { sx: (e.clientX - rect.left) * scaleX, sy: (e.clientY - rect.top) * scaleY };
  }

  // Expose a way to set sim state reference for hasConYard check
  function setSimState(state: SimState): void {
    simStateRef = state;
  }

  function hasConYard(): boolean {
    if (!simStateRef) return false;
    for (const e of simStateRef.store.all()) {
      const faction = e.components.faction;
      if (faction?.faction === 'construction_yard') {
        return true;
      }
    }
    return false;
  }

  function onMouseDown(e: MouseEvent): void {
    if (e.button === 1) { // middle button → grab-drag pan
      e.preventDefault();
      panLast = { x: e.clientX, y: e.clientY };
      return;
    }
    if (e.button !== 0) return; // left button starts a select/drag
    e.preventDefault();
    // Mission-briefing screen: the first click takes command (dismiss + focus),
    // and is swallowed so it doesn't also select/move underneath the overlay.
    if (briefing?.active()) {
      briefing.dismiss();
      canvas.focus?.();
      selectStart = null;
      selectCurrent = null;
      return;
    }
    const pos = getMousePos(e);
    // Sidebar build button → queue/place; swallow (not a field select).
    const action = hud?.buttonAt(pos.sx, pos.sy);
    if (action) {
      sfx?.click();
      doBuildAction(action);
      selectStart = null;
      selectCurrent = null;
      return;
    }
    // Radar click → jump the camera; swallow so it doesn't select/move on the field.
    if (minimap?.jump(pos.sx, pos.sy)) {
      selectStart = null;
      selectCurrent = null;
      return;
    }
    selectStart = pos;
    selectCurrent = pos;
    // Snap the placement tile to the click point (so click-to-place lands where clicked).
    if (placementMode) placementMode.tile = screenToTile(pos, camera);
  }

  function onMouseMove(e: MouseEvent): void {
    if (panLast) { // middle-drag pan: shift the camera opposite the drag (grab feel)
      const s = scaleXY();
      const dx = (e.clientX - panLast.x) * s.sx, dy = (e.clientY - panLast.y) * s.sy;
      panLast = { x: e.clientX, y: e.clientY };
      Object.assign(camera, { x: camera.x - (dx * WORLD_PER_PX) / camera.zoom, y: camera.y - (dy * WORLD_PER_PX) / camera.zoom, zoom: camera.zoom });
      return;
    }
    const pos = getMousePos(e);
    lastCursor = pos;
    // The placement ghost follows the cursor on hover (no button required).
    if (placementMode) placementMode.tile = screenToTile(pos, camera);
    if (!selectStart) { updateCursor(pos); return; }
    selectCurrent = pos;
  }

  function onMouseUp(e: MouseEvent): void {
    if (e.button === 1 || panLast) { panLast = null; return; } // end middle-drag pan
    if (!selectStart) return;
    e.preventDefault();
    const start = selectStart;
    const end = selectCurrent ?? start;
    selectStart = null;
    selectCurrent = null;

    const dragDistance = Math.sqrt((end.sx - start.sx) ** 2 + (end.sy - start.sy) ** 2);
    if (dragDistance < 5) {
      // Single click → check if in placement mode
      if (placementMode) {
        // Place structure intent (NOT select)
        queue.push({ type: 'place-structure', structureId: placementMode.structureId, tile: placementMode.tile });
        sfx?.place();
        setPlacementMode(null); // Exit placement mode after placing
      } else {
        // Single click → select at a world point.
        queue.push({ type: 'select', target: screenToWorld(start, camera) });
        sfx?.select();
      }
    } else {
      // Box drag → convert BOTH corners to world (the view owns the camera) and
      // select inside the resulting world rect. The command system stays screen-blind.
      const a = screenToWorld(start, camera);
      const b = screenToWorld(end, camera);
      queue.push({
        type: 'select',
        worldRect: {
          minWx: Math.min(a.wx, b.wx),
          minWy: Math.min(a.wy, b.wy),
          maxWx: Math.max(a.wx, b.wx),
          maxWy: Math.max(a.wy, b.wy),
        },
      });
      sfx?.select();
    }
  }

  function onContextMenu(e: MouseEvent): void {
    e.preventDefault();
    // If in placement mode, cancel it; otherwise issue a context-sensitive order
    // (the command system decides attack / harvest / move from what's at the point).
    if (placementMode) {
      setPlacementMode(null);
    } else {
      const pos = getMousePos(e);
      queue.push({ type: 'order', target: screenToWorld(pos, camera), tile: screenToTile(pos, camera) });
      sfx?.ack();
    }
  }

  function onKeyDown(e: KeyboardEvent): void {
    const pan = 64; // world units per keypress
    let dx = 0;
    let dy = 0;
    switch (e.key) {
      case 'ArrowLeft': dx = -pan; break;
      case 'ArrowRight': dx = pan; break;
      case 'ArrowUp': dy = -pan; break;
      case 'ArrowDown': dy = pan; break;
      case 'd': // Deploy MCV to Construction Yard
        e.preventDefault();
        queue.push({ type: 'deploy' });
        return;
      case 'D': // Deploy MCV to Construction Yard (case-insensitive)
        e.preventDefault();
        queue.push({ type: 'deploy' });
        return;
      case 'b': // Build a Barracks (needs a Construction Yard for build radius)
      case 'B':
        e.preventDefault();
        if (hasConYard()) setPlacementMode('barracks');
        return;
      case 'n': // Build a Power Node
      case 'N':
        e.preventDefault();
        if (hasConYard()) setPlacementMode('power_node');
        return;
      case 'Escape': // Cancel placement mode
        e.preventDefault();
        setPlacementMode(null);
        return;
      case 't': // Train infantry
      case 'T': // Train infantry (case-insensitive)
        e.preventDefault();
        queue.push({ type: 'train', unitId: 'infantry' });
        return;
      case 'r': // Train rocket trooper
      case 'R': // Train rocket trooper (case-insensitive)
        e.preventDefault();
        queue.push({ type: 'train', unitId: 'rocket_trooper' });
        return;
      case 'h': // Train a Harvester (grow the economy)
      case 'H':
        e.preventDefault();
        queue.push({ type: 'train', unitId: 'harvester' });
        return;
      case '1':
      case '2':
      case '3': {
        const group = parseInt(e.key, 10);
        if (e.ctrlKey || e.metaKey) {
          // Ctrl/Meta+1/2/3 → assign-group
          e.preventDefault();
          queue.push({ type: 'assign-group', group });
          return;
        } else {
          // 1/2/3 → recall-group
          e.preventDefault();
          queue.push({ type: 'recall-group', group });
          return;
        }
      }
      default: return;
    }
    e.preventDefault();
    panCamera(dx, dy); // pure view action — never enters the sim
  }

  // Expose placement mode control
  function setPlacementMode(structureId: string | null): void {
    if (structureId) {
      // Find the structure definition
      const structure = structures.find((s) => s.id === structureId);
      if (structure) {
        // Start placement mode at center of screen
        const centerScreen: ScreenPos = { sx: canvas.width / 2, sy: canvas.height / 2 };
        const tile = screenToTile(centerScreen, camera);
        placementMode = { structureId, tile };
      }
    } else {
      placementMode = null;
    }
  }

  function getPlacementMode(): { structureId: string; tile: TilePos } | null {
    return placementMode;
  }

  return {
    start(): void {
      canvas.addEventListener('mousedown', onMouseDown);
      canvas.addEventListener('mousemove', onMouseMove);
      canvas.addEventListener('mouseup', onMouseUp);
      canvas.addEventListener('contextmenu', onContextMenu);
      canvas.addEventListener('wheel', onWheel, { passive: false });
      canvas.addEventListener('mouseleave', onMouseLeave);
      window.addEventListener('mouseup', onWindowMouseUp);
      window.addEventListener('keydown', onKeyDown);
    },
    stop(): void {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('mouseup', onWindowMouseUp);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
    },
    getSelectionBox() {
      if (!selectStart || !selectCurrent) return null;
      return {
        x: Math.min(selectStart.sx, selectCurrent.sx),
        y: Math.min(selectStart.sy, selectCurrent.sy),
        width: Math.abs(selectCurrent.sx - selectStart.sx),
        height: Math.abs(selectCurrent.sy - selectStart.sy),
      };
    },
    setPlacementMode,
    getPlacementMode,
    hasConYard,
    setSimState,
    getCursor: () => lastCursor,
  };
}
