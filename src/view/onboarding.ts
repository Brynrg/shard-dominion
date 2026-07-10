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
  { key: 'select', text: 'LEFT-CLICK one of your units to select it (yellow ring)' },
  { key: 'move',   text: 'RIGHT-CLICK to command: open ground = move, enemy = attack, Shard = mine' },
  { key: 'build',  text: 'Press  B  and place a BARRACKS near your base (300 credits)' },
  { key: 'train',  text: 'Press  T  to train Infantry from the Barracks — raise an army' },
  { key: 'attack', text: 'Send your army north-east and destroy the RED enemy base' },
];

const BRIEF_TITLE = 'SHARD DOMINION';
const BRIEF_GOAL = 'GOAL:  Build an army and DESTROY THE ENEMY BASE to the north-east.';
const BRIEF_STORY: readonly string[] = [
  'Aether Prime is a desert veined with Shard — the crystal that fuels every',
  'army. You start with a base and one Harvester; a rival warband is dug in to',
  'the north-east. Last commander standing holds the planet.',
];
const BRIEF_HOWTO: readonly string[] = [
  '1.  Your Harvester auto-mines Shard into credits (the ◈ counter, top-right).',
  '2.  Press  B  and click near your base to build a Barracks (300).',
  '3.  Press  T  or  R  to train Infantry / Rocket troopers.',
  '4.  Drag a box to select troops, then RIGHT-CLICK the enemy to attack.',
  '5.  Push north-east and destroy their base to win.',
];
const BRIEF_HINT = 'SCROLL: move mouse to a screen edge · wheel = zoom · click the radar to jump';

export interface BriefingText { title: string; story: readonly string[]; objectives: readonly string[] }
export interface ObjStatus { text: string; primary: boolean; complete: boolean }

export interface CommMessage { speaker: string; text: string }

export function makeOnboarding(
  brief?: BriefingText,
  getObjectives?: () => readonly ObjStatus[],
  getMessages?: () => readonly CommMessage[],
): Onboarding {
  let briefing = true;
  let step = 0;
  // Latches: some conditions are momentary (a move marker lives ~0.5s), so once
  // seen they stay satisfied.
  let everSelected = false;
  let everMoved = false;
  let everBuilt = false;
  let everTrained = false;
  let pulse = 0;

  function playerHasSelection(state: SimState): boolean {
    for (const e of state.store.all()) {
      if (e.components.selection?.selected && e.components.faction?.team === 'player') return true;
    }
    return false;
  }
  function playerHasBarracks(state: SimState): boolean {
    for (const e of state.store.all()) {
      if (e.components.faction?.team === 'player' && e.components.faction?.faction === 'barracks') return true;
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
      if (playerHasBarracks(state)) everBuilt = true;
      if (playerIsTraining(state)) everTrained = true;

      // Advance through the ordered steps as each is satisfied.
      // (Guard the index so we never read past the last step.)
      while (step < STEPS.length - 1) {
        const key = STEPS[step]?.key;
        const done =
          (key === 'select' && everSelected) ||
          (key === 'move' && everMoved) ||
          (key === 'build' && everBuilt) ||
          (key === 'train' && everTrained);
        if (done) step += 1; else break;
      }
    },
    draw(ctx, canvas) {
      const W = canvas.width, H = canvas.height;
      if (briefing) { drawBriefing(ctx, W, H, pulse); return; }
      // Mission objectives (with live ✔/☐) take over the banner when available;
      // otherwise fall back to the staged control-tutorial steps.
      const objs = getObjectives?.() ?? [];
      if (objs.length > 0) drawMissionObjectives(ctx, W, objs, pulse);
      else drawObjectiveBanner(ctx, W, step, pulse);
      drawCommMessages(ctx, W, H, getMessages?.() ?? []);
    },
  };

  // Trigger comm panel (FG-4): speaker-tagged lines, bottom-centre, above the HUD.
  function drawCommMessages(ctx: CanvasRenderingContext2D, W: number, H: number, msgs: readonly CommMessage[]): void {
    if (msgs.length === 0) return;
    ctx.font = '13px monospace';
    const shown = msgs.slice(-3); // newest 3
    const wMax = Math.max(...shown.map(m => ctx.measureText(`${m.speaker}: ${m.text}`).width)) + 24;
    const lineH = 20;
    const boxW = Math.min(W - 220, Math.max(320, wMax));
    const x = (W - boxW) / 2, y = H - 64 - shown.length * lineH;
    ctx.fillStyle = 'rgba(8,12,18,0.85)';
    ctx.fillRect(x, y, boxW, shown.length * lineH + 10);
    ctx.strokeStyle = 'rgba(0,229,255,0.5)'; ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, boxW - 1, shown.length * lineH + 9);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    let yy = y + 6;
    for (const m of shown) {
      ctx.fillStyle = '#7fd6ff';
      ctx.fillText(`${m.speaker}:`, x + 10, yy);
      ctx.fillStyle = '#e7e2d6';
      ctx.fillText(m.text, x + 14 + ctx.measureText(`${m.speaker}:`).width, yy);
      yy += lineH;
    }
  }

  function drawMissionObjectives(ctx: CanvasRenderingContext2D, W: number, objs: readonly ObjStatus[], p: number): void {
    // TP-5: secondaries STAY visible (audit: they vanished after the briefing).
    // Primaries first, then ☆-prefixed optionals.
    const list = [...objs.filter(o => o.primary), ...objs.filter(o => !o.primary)];
    ctx.font = '13px monospace';
    const rows = list.map(o => `${o.complete ? '✔' : '☐'}${o.primary ? '' : ' ☆'} ${o.text}`);
    const boxW = Math.max(360, ...rows.map(r => ctx.measureText(r).width + 40));
    const h = 24 + list.length * 18;
    const x = (W - boxW) / 2, y = 8;
    ctx.fillStyle = 'rgba(10,14,20,0.82)';
    ctx.fillRect(x, y, boxW, h);
    const a = 0.6 + 0.4 * Math.sin(p * 0.06);
    ctx.strokeStyle = `rgba(255,211,77,${a.toFixed(3)})`;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 0.5, y + 0.5, boxW - 1, h - 1);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffd34d'; ctx.font = 'bold 12px monospace';
    ctx.fillText('OBJECTIVES', x + 12, y + 6);
    ctx.font = '13px monospace';
    let yy = y + 24;
    for (const o of list) {
      ctx.fillStyle = o.complete ? '#4caf50' : o.primary ? '#e7e2d6' : '#9fb4cc';
      ctx.fillText(`${o.complete ? '✔' : '☐'}${o.primary ? '' : ' ☆'} ${o.text}`, x + 12, yy);
      yy += 18;
    }
    ctx.textBaseline = 'alphabetic';
  }

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
    ctx.fillText(brief?.title ?? BRIEF_TITLE, W / 2, pad + 62);
    ctx.fillStyle = '#8fb7c9';
    ctx.font = '13px monospace';
    ctx.fillText('MISSION BRIEFING', W / 2, pad + 84);

    // GOAL banner — the first thing you read, so the point is unmistakable.
    ctx.fillStyle = 'rgba(255,74,61,0.14)';
    ctx.fillRect(pad + 20, pad + 100, W - pad * 2 - 40, 30);
    ctx.strokeStyle = 'rgba(255,211,77,0.5)'; ctx.lineWidth = 1;
    ctx.strokeRect(pad + 20, pad + 100, W - pad * 2 - 40, 30);
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 15px monospace';
    const goal = brief?.objectives?.[0] ? `GOAL:  ${brief.objectives[0]}` : BRIEF_GOAL;
    ctx.fillText(goal, W / 2, pad + 120);

    // Story, left-aligned.
    ctx.textAlign = 'left';
    ctx.fillStyle = '#cfc9bd';
    ctx.font = '13px monospace';
    let y = pad + 158;
    for (const line of (brief?.story ?? BRIEF_STORY)) { ctx.fillText(line, pad + 34, y); y += 20; }

    // How to play — numbered steps (these ARE the controls).
    y += 8;
    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('HOW TO PLAY', pad + 34, y); y += 24;
    ctx.font = '13px monospace';
    ctx.fillStyle = '#e7e2d6';
    for (const line of BRIEF_HOWTO) { ctx.fillText(line, pad + 40, y); y += 22; }

    // Camera hint.
    y += 6;
    ctx.fillStyle = '#8894a4';
    ctx.font = '12px monospace';
    ctx.fillText(BRIEF_HINT, pad + 34, y);

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
