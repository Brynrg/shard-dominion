// ── S3 liveness gate: build a Barracks from the Construction Yard ───────────────
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, '../../screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

type Counts = { mcv: number; conyard: number; power_node: number; barracks: number };
const zero: Counts = { mcv: 0, conyard: 0, power_node: 0, barracks: 0 };

test.describe('S3 liveness gate', () => {
  test('build a Barracks from the Construction Yard (charges credits)', async ({ page }) => {
    await page.goto('/?mission=skirmish');
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    // Dismiss the mission briefing (unpauses the sim + grabs focus).
    await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(60);
    const canvas = page.locator('#game-canvas');
    const canvasBox = (await canvas.boundingBox())!;
    await page.waitForTimeout(500);

    const counts0 = await page.evaluate(() => (window as { __debugBuildingCount?: () => Counts }).__debugBuildingCount?.() ?? zero);
    expect(counts0.conyard).toBe(1);   // the Construction Yard is up from turn one
    expect(counts0.barracks).toBe(0);

    const credits0 = await page.evaluate(() => (window as { __debugEconomy?: () => { credits: number } }).__debugEconomy?.().credits ?? 0);
    expect(credits0).toBeGreaterThanOrEqual(300);

    const cy = await page.evaluate(() => (window as { __debugConYardScreenPos?: () => { x: number; y: number } | null }).__debugConYardScreenPos?.() ?? null);
    expect(cy).not.toBeNull();

    // Press B (barracks placement), then place 3 tiles north of the ConYard (in radius).
    await page.keyboard.press('b');
    await page.waitForTimeout(100);
    const tx = canvasBox.x + cy!.x, ty = canvasBox.y + cy!.y - 96;
    await page.mouse.move(tx, ty);
    await page.waitForTimeout(50);
    await page.mouse.click(tx, ty);
    await page.waitForTimeout(200);

    const counts1 = await page.evaluate(() => (window as { __debugBuildingCount?: () => Counts }).__debugBuildingCount?.() ?? zero);
    expect(counts1.barracks).toBe(1);

    const credits1 = await page.evaluate(() => (window as { __debugEconomy?: () => { credits: number } }).__debugEconomy?.().credits ?? 0);
    expect(credits1).toBeLessThan(credits0); // charged for the build

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 's3-capture.png'), fullPage: true });
  });
});
