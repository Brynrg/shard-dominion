// ── S0 liveness gate: harvester visibly moving ────────────────────────────────
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, '../../screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

test.describe('S0 liveness gate', () => {
  test('canvas exists and has non-background content', async ({ page }) => {
    // Navigate to the previewed bundle, then wait for the canvas to mount
    await page.goto('/?mission=skirmish');
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    // Dismiss the mission briefing (the player's "click to take command") — this
    // unpauses the sim AND grabs focus. Every gate must do it before the match runs.
    await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(60);

    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();

    // Check that canvas has been drawn to (non-zero dimensions)
    const width = await canvas.getAttribute('width');
    const height = await canvas.getAttribute('height');
    expect(width).toBe('800');
    expect(height).toBe('600');

    // Take first screenshot (t≈1s)
    await page.waitForTimeout(1000);
    const screenshot1 = path.join(SCREENSHOT_DIR, 's0-capture1.png');
    await page.screenshot({ path: screenshot1, fullPage: true });

    // Get harvester position at t≈1s
    const pos1 = await page.evaluate(() => {
      const pos = (window as any).__debugHarvesterScreenPos?.();
      return pos || { x: -1, y: -1 };
    });
    expect(pos1.x).toBeGreaterThan(0);
    expect(pos1.y).toBeGreaterThan(0);

    const screenshot2 = path.join(SCREENSHOT_DIR, 's0-capture2.png');
    await page.screenshot({ path: screenshot2, fullPage: true });

    // Verify harvester moved. It parks while mining (visible ~5s harvest in v0.24), so
    // watch for displacement across a full cycle rather than a single fixed-gap sample.
    await expect.poll(async () => {
      const p = await page.evaluate(() => (window as any).__debugHarvesterScreenPos?.() || { x: -1, y: -1 });
      return Math.sqrt((p.x - pos1.x) ** 2 + (p.y - pos1.y) ** 2);
    }, { timeout: 14000, intervals: [400] }).toBeGreaterThan(5); // ≥5 px of movement within a cycle

    // Verify non-background pixels > 5% of canvas
    const nonBgRatio = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) return 0;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      let nonBgCount = 0;
      for (let i = 0; i < data.length; i += 4) {
        // Check if pixel is not pure black (background)
        if ((data[i] ?? 0) > 10 || (data[i + 1] ?? 0) > 10 || (data[i + 2] ?? 0) > 10) {
          nonBgCount++;
        }
      }
      return nonBgCount / (data.length / 4);
    });
    expect(nonBgRatio).toBeGreaterThan(0.05);
  });
});
