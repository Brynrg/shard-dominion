// ── View: mission briefing + staged first-match objectives (§5.9) ───────────────
// Pure VIEW concern — it only OBSERVES sim state and draws overlays; it never
// mutates the sim or touches the contract. Solves the two "I can't play" gaps:
//   1) a briefing screen that gives the story, the goal, and the controls before
//      anything moves (and whose dismiss-click grabs keyboard focus), and
//   2) a step-by-step objective tracker that teaches select → move → train → attack
//      by watching for the player to actually do each thing.
import type { SimState } from '../sim/state.js';
import type { ConfirmationMarker } from '../sim/systems/command.js';

export interface Onboarding {
  /** True while the pre-match briefing overlay is showing (sim is paused). */
  briefingActive(): boolean;
  dismissBriefing(): void;
  /** Observe sim state each frame to advance the current objective. */
  update(state: SimState, markers: readonly ConfirmationMarker[]): void;
  /** Draw the briefing overlay and/or the objective banner on top of everything. */
  draw(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void;
}

interface Step { key: string; text: string }
const STEPS: readonly Step[] = [
  { key: 'select', text: 'LEFT-CLICK one of your blue units to select it (yellow ring)' },
  { key: 'move',   text: 'RIGHT-CLICK open sand to order that unit to move there' },
  { key: 'train',  text: 'Press  T  to train an Infantry from your Barracks (100 credits)' },
  { key: 'attack', text: 'Build a force, then wipe out the RED base to the north-east' },
];

const BRIEF_TITLE = 'SHARD DOMINION';
const BRIEF_STORY: readonly string[] = [
  'Aether Prime — a desert world veined with Shard, the crystal that powers',
  'every war machine in the sector. Your clan has made planetfall. So has a',
  'rival warband, digging in to the north-east. Only one command will hold',
  'this ground.',
  '',
  'Your Harvester mines Shard into credits. Spend them to train troops and',
  'grind the enemy off the map.',
];
const BRIEF_CONTROLS: readonly [string, string][] = [
  ['Left-click / drag', 'select unit(s)'],
  ['Right-click', 'move'],
  ['T  /  R', 'train Infantry / Rocket trooper'],
  ['B  ·  D', 'build power node · deploy MCV'],
  ['Ctrl+1-3  /  1-3', 'assign / recall groups'],
];

export function makeOnboarding(): Onboarding {
  let briefing = true;
  let step = 0;
  // Latches: some conditions are momentary (a move marker lives ~0.5s), so once
  // seen they stay satisfied.
  let everSelected = false;
  let everMoved = false;
  let everTrained = false;
  let pulse = 0;

  function playerHasSelection(state: SimState): boolean {
    for (const e of state.store.all()) {
      if (e.components.selection?.selected && e.components.faction?.team === 'player') return true;
    }
    return false;
  }
  function playerIsTraining(state: SimState): boolean {
    for (const e of state.store.all()) {
      if (e.components.faction?.team !== 'player') continue;
      const p = e.components.production;
      if (p && (p.queue.length > 0 || p.progress > 0)) return true;
    }
    return false;
  }
  return {
    briefingActive: () => briefing,
    dismissBriefing: () => { briefing = false; },
    update(state, markers) {
      pulse += 1;
      if (briefing) return;
      if (playerHasSelection(state)) everSelected = true;
      if (markers.length > 0) everMoved = true;
      if (playerIsTraining(state)) everTrained = true;

      // Advance through the ordered steps as each is satisfied.
      // (Guard the index so we never read past the last step.)
      while (step < STEPS.length - 1) {
        const key = STEPS[step]?.key;
        const done =
          (key === 'select' && everSelected) ||
          (key === 'move' && everMoved) ||
          (key === 'train' && everTrained);
        if (done) step += 1; else break;
      }
    },
    draw(ctx, canvas) {
      const W = canvas.width, H = canvas.height;
      if (briefing) { drawBriefing(ctx, W, H, pulse); return; }
      // Don't draw the objective banner once the match is decided.
      drawObjectiveBanner(ctx, W, step, pulse);
    },
  };

  function drawBriefing(ctx: CanvasRenderingContext2D, W: number, H: number, p: number): void {
    // Dim the field behind the briefing.
    ctx.fillStyle = 'rgba(6,5,10,0.86)';
    ctx.fillRect(0, 0, W, H);

    // Framed panel.
    const pad = 46;
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(pad, pad, W - pad * 2, H - pad * 2);
    ctx.strokeStyle = 'rgba(0,229,255,0.25)';
    ctx.strokeRect(pad + 5, pad + 5, W - pad * 2 - 10, H - pad * 2 - 10);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 40px monospace';
    ctx.fillText(BRIEF_TITLE, W / 2, pad + 62);
    ctx.fillStyle = '#8fb7c9';
    ctx.font = '13px monospace';
    ctx.fillText('MISSION BRIEFING', W / 2, pad + 84);

    // Story, left-aligned block.
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e7e2d6';
    ctx.font = '14px monospace';
    let y = pad + 120;
    for (const line of BRIEF_STORY) { ctx.fillText(line, pad + 34, y); y += 21; }

    // Controls table.
    y += 6;
    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('CONTROLS', pad + 34, y); y += 22;
    ctx.font = '13px monospace';
    for (const [k, v] of BRIEF_CONTROLS) {
      ctx.fillStyle = '#ffd34d';
      ctx.fillText(k, pad + 40, y);
      ctx.fillStyle = '#cfc9bd';
      ctx.fillText(v, pad + 230, y);
      y += 20;
    }

    // Pulsing call to action.
    const a = 0.55 + 0.45 * Math.sin(p * 0.08);
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(0,229,255,${a.toFixed(3)})`;
    ctx.font = 'bold 20px monospace';
    ctx.fillText('▶  CLICK TO TAKE COMMAND', W / 2, H - pad - 26);
  }

  function drawObjectiveBanner(ctx: CanvasRenderingContext2D, W: number, idx: number, p: number): void {
    const s = STEPS[idx];
    if (!s) return;
    const label = `OBJECTIVE ${idx + 1}/${STEPS.length}`;
    const text = s.text;
    ctx.font = '13px monospace';
    const tw = ctx.measureText(text).width;
    const boxW = Math.max(tw + 150, 360);
    const x = (W - boxW) / 2, y = 8, h = 30;

    ctx.fillStyle = 'rgba(10,14,20,0.82)';
    ctx.fillRect(x, y, boxW, h);
    const a = 0.6 + 0.4 * Math.sin(p * 0.06);
    ctx.strokeStyle = `rgba(255,211,77,${a.toFixed(3)})`;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 0.5, y + 0.5, boxW - 1, h - 1);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd34d';
    ctx.fillText(label, x + 12, y + h / 2);
    ctx.fillStyle = '#e7e2d6';
    ctx.fillText(text, x + 12 + ctx.measureText(label).width + 16, y + h / 2);
    ctx.textBaseline = 'alphabetic';
  }
}
