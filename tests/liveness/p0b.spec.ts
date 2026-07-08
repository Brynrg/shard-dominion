// ── P0b liveness gate: build a Barracks, then train — the player force grows ────
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, '../../screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

type Match = { enemyUnits: number; playerUnits: number; enemyCredits: number };
type Counts = { mcv: number; conyard: number; power_node: number; barracks: number };

test.describe('P0b liveness gate', () => {
  test('build a Barracks then train infantry — the player unit count rises', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/?mission=skirmish');
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } }); // take command
    await page.waitForTimeout(60);
    const canvas = page.locator('#game-canvas');
    const canvasBox = (await canvas.boundingBox())!;
    await page.waitForTimeout(500);

    const match = () => page.evaluate(() =>
      (window as { __debugMatch?: () => Match }).__debugMatch?.() ?? { enemyUnits: -1, playerUnits: -1, enemyCredits: -1 });

    // Build a Barracks (needed before you can train).
    const cy = await page.evaluate(() => (window as { __debugConYardScreenPos?: () => { x: number; y: number } | null }).__debugConYardScreenPos?.() ?? null);
    expect(cy).not.toBeNull();
    await page.keyboard.press('b');
    await page.waitForTimeout(100);
    const tx = canvasBox.x + cy!.x, ty = canvasBox.y + cy!.y - 96;
    await page.mouse.move(tx, ty);
    await page.waitForTimeout(50);
    await page.mouse.click(tx, ty);
    await page.waitForTimeout(200);
    const counts = await page.evaluate(() => (window as { __debugBuildingCount?: () => Counts }).__debugBuildingCount?.() ?? { mcv: 0, conyard: 0, power_node: 0, barracks: 0 });
    expect(counts.barracks).toBe(1);

    const start = await match();
    expect(start.playerUnits).toBeGreaterThanOrEqual(2); // the two starting soldiers

    // Train two infantry from the new barracks.
    await page.keyboard.press('t');
    await page.keyboard.press('t');

    let peak = start.playerUnits;
    await expect.poll(async () => {
      peak = Math.max(peak, (await match()).playerUnits);
      return peak;
    }, { timeout: 40_000, message: 'a trained unit should join the player force' })
      .toBeGreaterThan(start.playerUnits);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'p0b-train-capture.png'), fullPage: true });
  });
});
