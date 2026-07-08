// ── S5 liveness gate: fog of war renders (dark unexplored, lit visible area) ────
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, '../../screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

test.describe('S5 liveness gate', () => {
  test('fog shrouds the map: corners dark, base area lit', async ({ page }) => {
    await page.goto('/?mission=skirmish');
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    // Dismiss the mission briefing (the player's "click to take command") — this
    // unpauses the sim AND grabs focus. Every gate must do it before the match runs.
    await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(60);
    await page.waitForTimeout(1500); // let a few ticks run so fog computes

    const probe = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      const px = (x: number, y: number) => {
        const d = ctx.getImageData(x, y, 1, 1).data;
        return (d[0] ?? 0) + (d[1] ?? 0) + (d[2] ?? 0);
      };
      // Far corner of the battlefield (top-left, >6 tiles from any player unit) vs
      // the base area (canvas centre — the refinery/ConYard sit at map centre with
      // the camera centred on it).
      const cornerSum = px(30, 30);
      const centerSum = px(400, 300);
      // Fraction of the canvas that is near-black (fog coverage).
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let dark = 0;
      const total = img.length / 4;
      for (let i = 0; i < img.length; i += 4) {
        if ((img[i] ?? 0) + (img[i + 1] ?? 0) + (img[i + 2] ?? 0) < 60) dark++;
      }
      return { cornerSum, centerSum, darkFraction: dark / total };
    });

    expect(probe).not.toBeNull();
    expect(probe!.cornerSum).toBeLessThan(60);        // unexplored corner ≈ near-black
    expect(probe!.centerSum).toBeGreaterThan(150);    // base area fully lit terrain
    expect(probe!.darkFraction).toBeGreaterThan(0.15); // a real shroud covers a chunk of the map
    expect(probe!.darkFraction).toBeLessThan(0.95);    // ...but not everything (base is visible)

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 's5-fog-capture.png'), fullPage: true });
  });
});
