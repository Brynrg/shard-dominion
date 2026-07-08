// ── Harvester-from-Refinery gate: build a Harvester turn one, no Barracks ────────
// C&C-accurate change: Harvesters are produced by the Refinery (up from the start),
// not gated behind a Barracks. Clicking the Harvester build button — with NO Barracks
// on the field — must grow the harvester count and charge credits.
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, '../../screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

type Counts = { mcv: number; conyard: number; power_node: number; barracks: number };

test.describe('Harvester-from-Refinery gate', () => {
  test('the Harvester builds at the Refinery turn one (no Barracks needed)', async ({ page }) => {
    await page.goto('/?mission=skirmish');
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } }); // take command
    await page.waitForTimeout(400);
    const box = (await page.locator('#game-canvas').boundingBox())!;

    // Sanity: no Barracks on the field yet, and we start with exactly one Harvester.
    const counts0 = await page.evaluate(() => (window as { __debugBuildingCount?: () => Counts }).__debugBuildingCount?.() ?? { mcv: 0, conyard: 0, power_node: 0, barracks: 0 });
    expect(counts0.barracks).toBe(0);
    const harv0 = await page.evaluate(() => (window as { __debugHarvesterCount?: () => number }).__debugHarvesterCount?.() ?? -1);
    expect(harv0).toBe(1);

    // Click the Harvester button — the 3rd build row (Infantry/Rocket/Harvester/…)
    // in the right panel. Rows start at y≈146, +34 each → Harvester centre ≈ 229.
    await page.mouse.click(box.x + 700, box.y + 229);

    // Harvester builds in 8s (160 ticks). Poll for the count to reach 2 (margin 14s).
    await expect.poll(
      () => page.evaluate(() => (window as { __debugHarvesterCount?: () => number }).__debugHarvesterCount?.() ?? -1),
      { timeout: 14000, intervals: [500] },
    ).toBe(2);

    // Still no Barracks — proves the Refinery (not a Barracks) produced the Harvester.
    // (The exact 400-credit charge is covered precisely in train.test.ts; here the
    // existing harvester's mining income confounds a live credit delta.)
    const counts1 = await page.evaluate(() => (window as { __debugBuildingCount?: () => Counts }).__debugBuildingCount?.() ?? { mcv: 0, conyard: 0, power_node: 0, barracks: 0 });
    expect(counts1.barracks).toBe(0);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'harvester-refinery.png'), fullPage: true });
  });
});
