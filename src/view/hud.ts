// ── HUD: credits + cargo + storage readout ─────────────────────────────────────
// Renders economy HUD on top of the game canvas.
import type { SimState } from '../sim/state.js';
import type { Camera } from '../sim/coords.js';

export interface HUDConfig {
  canvas: HTMLCanvasElement;
  simState: SimState;
  camera: Camera; // unused in current implementation
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
  };

  function getHarvester(): { cargo: number; capacity: number } | null {
    for (const e of simState.store.all()) {
      if (e.components.faction?.faction === 'harvester' && e.components.harvest) {
        return { cargo: e.components.harvest.cargo || 0, capacity: 700 };
      }
    }
    return null;
  }

  function getRefinery(): { credits: number; storage: number; maxStorage: number } | null {
    for (const e of simState.store.all()) {
      if (e.components.building && e.components.economy) {
        return {
          credits: e.components.economy.credits || 0,
          storage: e.components.economy.refineryStorage || 0,
          maxStorage: e.components.economy.maxStorage || 2000,
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

  return {
    draw() {
      const harvester = getHarvester();
      const refinery = getRefinery();

      // Draw HUD background
      const hudHeight = 120;
      drawBox(10, canvas.height - hudHeight - 10, 220, hudHeight, COLORS.background);

      // Credits
      if (refinery) {
        drawText(`Credits: ${Math.floor(refinery.credits)}`, 20, canvas.height - hudHeight - 5, COLORS.highlight);
      }

      // Harvester cargo
      if (harvester) {
        const cargoColor = harvester.cargo >= harvester.capacity ? COLORS.warning : COLORS.success;
        drawText('Cargo:', 20, canvas.height - hudHeight + 20);
        drawProgressBar(70, canvas.height - hudHeight + 18, 130, harvester.cargo, harvester.capacity, cargoColor);
      }

      // Refinery storage
      if (refinery) {
        const storageColor = refinery.storage >= refinery.maxStorage ? COLORS.warning : COLORS.success;
        drawText('Storage:', 20, canvas.height - hudHeight + 50);
        drawProgressBar(70, canvas.height - hudHeight + 48, 130, refinery.storage, refinery.maxStorage, storageColor);
      }

      // Overflow warning
      if (refinery && refinery.storage >= refinery.maxStorage) {
        drawText('OVERFLOW!', 20, canvas.height - hudHeight + 75, COLORS.warning);
      }
    },
  };
}
