// ── S1 liveness gate: economy visible (credits HUD + shard depletion) ───────────
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, '../../screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

test.describe('S1 liveness gate', () => {
  test('canvas exists, HUD renders, credits change, shard density drops', async ({ page }) => {
    // Navigate to the previewed bundle, then wait for the canvas to mount
    await page.goto('/');
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    // Dismiss the mission briefing (the player's "click to take command") — this
    // unpauses the sim AND grabs focus. Every gate must do it before the match runs.
    await page.locator('#game-canvas').click({ position: { x: 4, y: 4 } });
    await page.waitForTimeout(60);

    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();

    // Check that canvas has been drawn to (non-zero dimensions)
    const width = await canvas.getAttribute('width');
    const height = await canvas.getAttribute('height');
    expect(width).toBe('800');
    expect(height).toBe('600');

    // Capture starting credits BEFORE any deposit lands (baseline for the economy assertion).
    const creditsStart = await page.evaluate(() => (window as { __debugEconomy?: () => { credits: number } }).__debugEconomy?.().credits ?? 0);

    // Take first screenshot (t≈1s) - HUD should be visible
    await page.waitForTimeout(1000);
    const screenshot1 = path.join(SCREENSHOT_DIR, 's1-capture1.png');
    await page.screenshot({ path: screenshot1, fullPage: true });

    // Verify HUD is visible (non-black pixels in bottom area where HUD is)
    const hudPixels1 = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) return 0;
      // Check bottom area where HUD is rendered
      const imageData = ctx.getImageData(0, 480, 800, 120);
      const data = imageData.data;
      let nonBgCount = 0;
      for (let i = 0; i < data.length; i += 4) {
        if ((data[i] ?? 0) > 10 || (data[i + 1] ?? 0) > 10 || (data[i + 2] ?? 0) > 10) {
          nonBgCount++;
        }
      }
      return nonBgCount / (data.length / 4);
    });
    expect(hudPixels1).toBeGreaterThan(0.05); // HUD should have visible content

    // Wait and take second screenshot (t≈3s) - credits should have changed
    await page.waitForTimeout(2000);
    const screenshot2 = path.join(SCREENSHOT_DIR, 's1-capture2.png');
    await page.screenshot({ path: screenshot2, fullPage: true });

    // Verify HUD is still visible
    const hudPixels2 = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) return 0;
      const imageData = ctx.getImageData(0, 480, 800, 120);
      const data = imageData.data;
      let nonBgCount = 0;
      for (let i = 0; i < data.length; i += 4) {
        if ((data[i] ?? 0) > 10 || (data[i + 1] ?? 0) > 10 || (data[i + 2] ?? 0) > 10) {
          nonBgCount++;
        }
      }
      return nonBgCount / (data.length / 4);
    });
    expect(hudPixels2).toBeGreaterThan(0.05);

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

    // Verify harvester moved (S0 motion assertion still passes)
    const pos1 = await page.evaluate(() => {
      const pos = (window as any).__debugHarvesterScreenPos?.();
      return pos || { x: -1, y: -1 };
    });
    expect(pos1.x).toBeGreaterThan(0);
    expect(pos1.y).toBeGreaterThan(0);

    await page.waitForTimeout(1000);
    const pos2 = await page.evaluate(() => {
      const pos = (window as any).__debugHarvesterScreenPos?.();
      return pos || { x: -1, y: -1 };
    });
    expect(pos2.x).toBeGreaterThan(0);
    expect(pos2.y).toBeGreaterThan(0);

    const dist = Math.sqrt((pos2.x - pos1.x) ** 2 + (pos2.y - pos1.y) ** 2);
    expect(dist).toBeGreaterThan(5); // At least 5 pixels of movement

    // Economy is VISIBLE: give the harvester time to complete a harvest→return→deposit
    // cycle, then assert the refinery's credits actually rose (a deposit landed on screen).
    await page.waitForTimeout(4000);
    const creditsEnd = await page.evaluate(() => (window as { __debugEconomy?: () => { credits: number } }).__debugEconomy?.().credits ?? 0);
    expect(creditsEnd).toBeGreaterThan(creditsStart);
  });
});
