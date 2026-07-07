// ── HUD: credits + cargo + storage + build queue + power readout ────────────────
// Renders economy and build queue HUD on top of the game canvas.
import type { SimState } from '../sim/state.js';
import type { Camera } from '../sim/coords.js';
import type { ConstructionOutput } from '../sim/systems/construction.js';

export interface HUDConfig {
  canvas: HTMLCanvasElement;
  simState: SimState;
  camera: Camera; // unused in current implementation
  constructionOutput?: ConstructionOutput;
}

export function makeHUD(cfg: HUDConfig): { draw(): void } {
  const { canvas, simState } = cfg;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  // Use ctx as non-null after the check
  const context = ctx as CanvasRenderingContext2D;

  // HUD colors
  const COLORS = {
    background: 'rgba(0, 0, 0, 0.7)',
    text: '#ffffff',
    highlight: '#4a90e2',
    warning: '#e24a4a',
    success: '#4caf50',
    powerOk: '#4caf50',
    powerLow: '#e24a4a',
  };

  function getHarvester(): { cargo: number; capacity: number } | null {
    for (const e of simState.store.all()) {
      if (e.components.faction?.team === 'player' &&
          e.components.faction?.faction === 'harvester' && e.components.harvest) {
        return { cargo: e.components.harvest.cargo || 0, capacity: 700 };
      }
    }
    return null;
  }

  // The player's economy (never the enemy's — scope by team so affordability is correct).
  function getRefinery(): { credits: number; storage: number; maxStorage: number } | null {
    for (const e of simState.store.all()) {
      if (e.components.faction?.team === 'player' && e.components.building && e.components.economy) {
        return {
          credits: e.components.economy.credits || 0,
          storage: e.components.economy.refineryStorage || 0,
          maxStorage: e.components.economy.maxStorage || 2000,
        };
      }
    }
    return null;
  }

  function getPowerStatus(): { supply: number; demand: number; powered: boolean } {
    let supply = 0;
    let demand = 0;

    for (const e of simState.store.all()) {
      const power = e.components.power;
      if (power) {
        supply += power.powerSupply;
        demand += power.powerDemand;
      }
    }

    return { supply, demand, powered: supply >= demand };
  }

  function getPlayerBarracks(): { queue: readonly string[]; progress: number } | null {
    for (const e of simState.store.all()) {
      if (e.components.faction?.team === 'player' && e.components.production) {
        return {
          queue: e.components.production.queue ?? [],
          progress: e.components.production.progress ?? 0,
        };
      }
    }
    return null;
  }

  function drawBox(x: number, y: number, width: number, height: number, color: string): void {
    context.fillStyle = color;
    context.fillRect(x, y, width, height);
  }

  function drawText(text: string, x: number, y: number, color: string = COLORS.text): void {
    context.fillStyle = color;
    context.font = '14px monospace';
    context.textBaseline = 'top';
    context.fillText(text, x, y);
  }

  function drawProgressBar(x: number, y: number, width: number, value: number, max: number, color: string): void {
    const pct = Math.min(1, Math.max(0, value / max));
    const barWidth = Math.floor(width * pct);

    // Background
    context.fillStyle = 'rgba(255, 255, 255, 0.2)';
    context.fillRect(x, y, width, 12);

    // Progress
    context.fillStyle = color;
    context.fillRect(x, y, barWidth, 12);

    // Text
    context.fillStyle = '#ffffff';
    context.font = '12px monospace';
    context.textBaseline = 'top';
    context.fillText(`${Math.floor(value)} / ${max}`, x + 5, y + 1);
  }

  // Beveled panel frame (Westwood command-bar look: dark fill, light top edge, dark base).
  function drawPanel(x: number, y: number, w: number, h: number): void {
    context.fillStyle = 'rgba(14,16,20,0.88)';
    context.fillRect(x, y, w, h);
    context.strokeStyle = '#5a6472';
    context.lineWidth = 1;
    context.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    context.fillStyle = 'rgba(255,255,255,0.10)';   // top highlight
    context.fillRect(x + 1, y + 1, w - 2, 1);
    context.fillStyle = 'rgba(0,0,0,0.35)';          // bottom shadow
    context.fillRect(x + 1, y + h - 2, w - 2, 1);
  }

  // One roster row: hotkey chip + name + cost, greyed when unaffordable, ⏳ when building.
  function drawBuildRow(x: number, y: number, w: number, key: string, name: string, cost: number, credits: number, building: boolean): void {
    const affordable = credits >= cost;
    drawBox(x, y, w, 22, affordable ? 'rgba(74,144,226,0.18)' : 'rgba(80,80,80,0.15)');
    // hotkey chip
    context.fillStyle = affordable ? COLORS.highlight : '#555';
    context.fillRect(x + 4, y + 4, 15, 14);
    context.fillStyle = '#0e1014';
    context.font = 'bold 12px monospace';
    context.textBaseline = 'top';
    context.fillText(key, x + 8, y + 5);
    // name + cost
    const textColor = affordable ? COLORS.text : '#7c7c7c';
    drawText(name, x + 26, y + 5, textColor);
    context.fillStyle = affordable ? COLORS.success : '#7c7c7c';
    context.font = '12px monospace';
    context.fillText(`${cost}`, x + w - 34, y + 5);
    if (building) drawText('▶', x + w - 14, y + 5, COLORS.highlight);
  }

  return {
    draw() {
      const harvester = getHarvester();
      const refinery = getRefinery();
      const power = getPowerStatus();
      const barracks = getPlayerBarracks();
      const credits = refinery ? Math.floor(refinery.credits) : 0;

      // ── Right-edge command panel ────────────────────────────────────────────
      const pw = 176;
      const px = canvas.width - pw - 8;
      const py = 8;
      const ph = 262;
      drawPanel(px, py, pw, ph);

      // Title bar.
      drawBox(px + 1, py + 1, pw - 2, 20, 'rgba(74,144,226,0.35)');
      context.fillStyle = COLORS.text;
      context.font = 'bold 13px monospace';
      context.textBaseline = 'top';
      context.fillText('COMMAND', px + 10, py + 5);

      // Credits (large).
      context.fillStyle = '#ffd34a';
      context.font = 'bold 20px monospace';
      context.fillText(`◈ ${credits}`, px + 10, py + 28);

      // Power lamp.
      const powerColor = power.powered ? COLORS.powerOk : COLORS.powerLow;
      context.fillStyle = powerColor;
      context.beginPath();
      context.arc(px + 16, py + 62, 5, 0, Math.PI * 2);
      context.fill();
      drawText(`POWER ${power.powered ? 'OK' : 'LOW'}  ${power.supply}/${power.demand}`, px + 28, py + 56, powerColor);

      // Cargo + storage bars.
      if (harvester) {
        drawText('Cargo', px + 10, py + 78);
        drawProgressBar(px + 60, py + 76, 106, harvester.cargo, harvester.capacity,
          harvester.cargo >= harvester.capacity ? COLORS.warning : COLORS.success);
      }
      if (refinery) {
        drawText('Store', px + 10, py + 98);
        drawProgressBar(px + 60, py + 96, 106, refinery.storage, refinery.maxStorage,
          refinery.storage >= refinery.maxStorage ? COLORS.warning : COLORS.success);
      }

      // Build roster.
      drawText('BUILD', px + 10, py + 120, '#9fb4cc');
      const buildingUnit = (id: string) => (barracks?.progress ?? 0) > 0 && barracks?.queue[0] === id;
      drawBuildRow(px + 8, py + 138, pw - 16, 'T', 'Infantry', 100, credits, buildingUnit('infantry'));
      drawBuildRow(px + 8, py + 164, pw - 16, 'R', 'Rocket', 200, credits, buildingUnit('rocket_trooper'));

      // Queue depth + build progress.
      if (barracks && (barracks.queue.length > 0 || barracks.progress > 0)) {
        drawText(`Queue ${barracks.queue.length}`, px + 10, py + 192, COLORS.text);
        if (barracks.progress > 0) drawProgressBar(px + 70, py + 190, 96, barracks.progress, 100, COLORS.highlight);
      }

      // Hotkey legend (footer) — kept within panel width (10px monospace, ~26 chars).
      context.fillStyle = '#8894a4';
      context.font = '10px monospace';
      context.fillText('B Barracks  N Power', px + 10, py + 214);
      context.fillText('Ctrl+1-3 set  1-3 recall', px + 10, py + 226);
      context.fillText('R-clk: move/attack/mine', px + 10, py + 238);

      // Overflow warning (below panel, hard to miss).
      if (refinery && refinery.storage >= refinery.maxStorage) {
        drawBox(px, py + ph + 4, pw, 20, 'rgba(226,74,74,0.8)');
        drawText('STORAGE FULL', px + 10, py + ph + 8, '#ffffff');
      }
    },
  };
}
