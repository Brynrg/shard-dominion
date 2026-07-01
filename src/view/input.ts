// ── View: input handling → command intents queue ───────────────────────────────
// Mouse/keyboard capture wall-clock/DOM. The VIEW owns the camera, so it converts
// screen pixels → WORLD coords via the contract coord fns BEFORE queuing an intent;
// the command SimSystem then works purely in world space (it never sees the camera
// or the screen). Camera panning is a pure view action applied straight to the view
// camera — it never enters the sim.
import type { Camera, WorldPos, ScreenPos } from '../sim/coords.js';
import { screenToWorld } from '../sim/coords.js';

/** Command intents queued from input. All coordinates are WORLD space. */
export type CommandIntent =
  | { type: 'select'; worldRect?: { minWx: number; minWy: number; maxWx: number; maxWy: number }; target?: WorldPos }
  | { type: 'deselect' }
  | { type: 'move'; target: WorldPos };

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
}

export function makeInputHandlers(
  canvas: HTMLCanvasElement,
  camera: Camera,
  queue: CommandQueue,
  panCamera: (dx: number, dy: number) => void,
): InputHandlers {
  let selectStart: ScreenPos | null = null;
  let selectCurrent: ScreenPos | null = null;

  function getMousePos(e: MouseEvent): ScreenPos {
    const rect = canvas.getBoundingClientRect();
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
  }

  function onMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return; // left button starts a select/drag
    e.preventDefault();
    const pos = getMousePos(e);
    selectStart = pos;
    selectCurrent = pos;
  }

  function onMouseMove(e: MouseEvent): void {
    if (!selectStart) return;
    selectCurrent = getMousePos(e);
  }

  function onMouseUp(e: MouseEvent): void {
    if (!selectStart) return;
    e.preventDefault();
    const start = selectStart;
    const end = selectCurrent ?? start;
    selectStart = null;
    selectCurrent = null;

    const dragDistance = Math.sqrt((end.sx - start.sx) ** 2 + (end.sy - start.sy) ** 2);
    if (dragDistance < 5) {
      // Single click → select at a world point.
      queue.push({ type: 'select', target: screenToWorld(start, camera) });
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
    }
  }

  function onContextMenu(e: MouseEvent): void {
    e.preventDefault();
    queue.push({ type: 'move', target: screenToWorld(getMousePos(e), camera) });
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
      default: return;
    }
    e.preventDefault();
    panCamera(dx, dy); // pure view action — never enters the sim
  }

  return {
    start(): void {
      canvas.addEventListener('mousedown', onMouseDown);
      canvas.addEventListener('mousemove', onMouseMove);
      canvas.addEventListener('mouseup', onMouseUp);
      canvas.addEventListener('contextmenu', onContextMenu);
      window.addEventListener('keydown', onKeyDown);
    },
    stop(): void {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
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
  };
}
