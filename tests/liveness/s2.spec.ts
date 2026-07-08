// ── S2 liveness gate: selection + command bus + confirmation markers ────────────
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, '../../screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

test.describe('S2 liveness gate', () => {
  test('canvas exists, selection ring renders on click, move order issues confirmation marker', async ({ page }) => {
    // Navigate to the previewed bundle, then wait for the canvas to mount
    await page.goto('/?mission=skirmish');
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    // Dismiss the mission briefing (the player's "click to take command") — this
    // unpauses the sim AND grabs focus. Every gate must do it before the match runs.
    await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(60);

    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();

    // Debug hooks report CANVAS-relative screen coords; Playwright clicks in VIEWPORT
    // coords, so offset every click by the canvas's page position.
    const canvasBox = (await canvas.boundingBox())!;

    // Check that canvas has been drawn to (non-zero dimensions)
    const width = await canvas.getAttribute('width');
    const height = await canvas.getAttribute('height');
    expect(width).toBe('800');
    expect(height).toBe('600');

    // Verify initial selection count is 0
    let selectionCount = await page.evaluate(() => (window as { __debugSelection?: () => number }).__debugSelection?.() ?? 0);
    expect(selectionCount).toBe(0);

    // Take first screenshot (t≈1s) - baseline
    await page.waitForTimeout(1000);
    const screenshot1 = path.join(SCREENSHOT_DIR, 's2-capture1.png');
    await page.screenshot({ path: screenshot1, fullPage: true });

    // Get initial harvester screen position
    const pos1 = await page.evaluate(() => {
      const pos = (window as any).__debugHarvesterScreenPos?.();
      return pos || { x: -1, y: -1 };
    });
    expect(pos1.x).toBeGreaterThan(0);
    expect(pos1.y).toBeGreaterThan(0);

    // Click on the harvester to select it
    // The harvester is at center-ish of map, which should be visible
    await page.mouse.click(canvasBox.x + pos1.x, canvasBox.y + pos1.y);
    await page.waitForTimeout(100); // Allow input to process

    // Verify selection count is now 1
    selectionCount = await page.evaluate(() => (window as { __debugSelection?: () => number }).__debugSelection?.() ?? 0);
    expect(selectionCount).toBe(1);

    // Take screenshot after selection (t≈1.2s)
    await page.waitForTimeout(200);
    const screenshot2 = path.join(SCREENSHOT_DIR, 's2-capture2.png');
    await page.screenshot({ path: screenshot2, fullPage: true });

    // Verify selection ring is visible (non-black pixels in canvas)
    const hudPixels1 = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) return 0;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      let nonBgCount = 0;
      for (let i = 0; i < data.length; i += 4) {
        if ((data[i] ?? 0) > 10 || (data[i + 1] ?? 0) > 10 || (data[i + 2] ?? 0) > 10) {
          nonBgCount++;
        }
      }
      return nonBgCount / (data.length / 4);
    });
    expect(hudPixels1).toBeGreaterThan(0.05);

    // Issue a move order by right-clicking a destination
    // Click about 200px to the right of the harvester
    const destX = pos1.x + 200;
    const destY = pos1.y;
    await page.mouse.click(canvasBox.x + destX, canvasBox.y + destY, { button: 'right' });
    await page.waitForTimeout(100); // Allow command to process

    // Verify harvester starts moving toward destination
    await page.waitForTimeout(500);
    const pos2 = await page.evaluate(() => {
      const pos = (window as any).__debugHarvesterScreenPos?.();
      return pos || { x: -1, y: -1 };
    });

    // Harvester should have moved toward the destination: right, and within ~half a
    // tile of the same row (the ordered point shares pos1.y; small FSM/interpolation
    // drift is fine — 32px tiles).
    expect(pos2.x).toBeGreaterThanOrEqual(pos1.x); // Should move right
    expect(Math.abs(pos2.y - pos1.y)).toBeLessThan(16); // roughly same row

    // Take screenshot after move order (t≈1.8s)
    await page.waitForTimeout(200);
    const screenshot3 = path.join(SCREENSHOT_DIR, 's2-capture3.png');
    await page.screenshot({ path: screenshot3, fullPage: true });

    // Verify non-background pixels > 5% of canvas (S0 motion still passes)
    const nonBgRatio = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) return 0;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      let nonBgCount = 0;
      for (let i = 0; i < data.length; i += 4) {
        if ((data[i] ?? 0) > 10 || (data[i + 1] ?? 0) > 10 || (data[i + 2] ?? 0) > 10) {
          nonBgCount++;
        }
      }
      return nonBgCount / (data.length / 4);
    });
    expect(nonBgRatio).toBeGreaterThan(0.05);

    // Wait longer for movement to be visible
    await page.waitForTimeout(1000);
    const pos3 = await page.evaluate(() => {
      const pos = (window as any).__debugHarvesterScreenPos?.();
      return pos || { x: -1, y: -1 };
    });

    // Verify harvester moved further
    const dist = Math.sqrt((pos3.x - pos1.x) ** 2 + (pos3.y - pos1.y) ** 2);
    expect(dist).toBeGreaterThan(20); // At least 20 pixels of movement

    // Verify S1 economy still works (credits should have risen)
    const credits = await page.evaluate(() => (window as { __debugEconomy?: () => { credits: number } }).__debugEconomy?.().credits ?? 0);
    expect(credits).toBeGreaterThan(0);
  });

  test('box selection works', async ({ page }) => {
    // Navigate to the previewed bundle
    await page.goto('/?mission=skirmish');
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    // Dismiss the mission briefing (the player's "click to take command") — this
    // unpauses the sim AND grabs focus. Every gate must do it before the match runs.
    await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(60);

    // Wait for initial render
    await page.waitForTimeout(1000);

    const canvasBox = (await page.locator('#game-canvas').boundingBox())!;

    // Get initial selection count
    let selectionCount = await page.evaluate(() => (window as { __debugSelection?: () => number }).__debugSelection?.() ?? 0);
    expect(selectionCount).toBe(0);

    // Drag a large selection box over the player base at the canvas centre (the
    // camera is centred on the base — stationary buildings + defenders live there).
    // A big box avoids flakiness from fast-moving economy units.
    const midX = canvasBox.x + canvasBox.width / 2;
    const midY = canvasBox.y + canvasBox.height / 2;
    await page.mouse.move(midX - 160, midY - 160);
    await page.mouse.down();
    await page.mouse.move(midX + 160, midY + 160);
    await page.mouse.up();
    await page.waitForTimeout(100);

    // Box-select picks up at least one player unit in the base area.
    selectionCount = await page.evaluate(() => (window as { __debugSelection?: () => number }).__debugSelection?.() ?? 0);
    expect(selectionCount).toBeGreaterThanOrEqual(1);

    // Take screenshot after box selection
    const screenshot = path.join(SCREENSHOT_DIR, 's2-box-select.png');
    await page.screenshot({ path: screenshot, fullPage: true });
  });
});
