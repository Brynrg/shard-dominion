// ── S3 liveness gate: deploy MCV → ConYard, build+place a Power Node ────────────
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, '../../screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

type Counts = { mcv: number; conyard: number; power_node: number };

test.describe('S3 liveness gate', () => {
  test('deploy MCV to ConYard, then build & place a Power Node', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    // Dismiss the mission briefing (the player's "click to take command") — this
    // unpauses the sim AND grabs focus. Every gate must do it before the match runs.
    await page.locator('#game-canvas').click({ position: { x: 4, y: 4 } });
    await page.waitForTimeout(60);
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();
    // Debug hooks report CANVAS-relative coords; Playwright uses VIEWPORT coords.
    const canvasBox = (await canvas.boundingBox())!;
    await page.waitForTimeout(500);

    // Start: one MCV, no ConYard.
    let counts = await page.evaluate(() => (window as { __debugBuildingCount?: () => Counts }).__debugBuildingCount?.() ?? { mcv: 0, conyard: 0, power_node: 0 });
    expect(counts.mcv).toBe(1);
    expect(counts.conyard).toBe(0);

    // Deploy: press 'd' → the MCV becomes a Construction Yard.
    await page.keyboard.press('d');
    await page.waitForTimeout(200);
    counts = await page.evaluate(() => (window as { __debugBuildingCount?: () => Counts }).__debugBuildingCount?.() ?? { mcv: 0, conyard: 0, power_node: 0 });
    expect(counts.conyard).toBe(1);
    expect(counts.mcv).toBe(0);

    // Locate the ConYard on screen.
    const cy = await page.evaluate(() => (window as { __debugConYardScreenPos?: () => { x: number; y: number } | null }).__debugConYardScreenPos?.() ?? null);
    expect(cy).not.toBeNull();

    // Enter placement mode for a Power Node ('b'), then place it 3 tiles north of the
    // ConYard (within build radius, empty buildable ground).
    await page.keyboard.press('b');
    await page.waitForTimeout(100);
    const targetX = canvasBox.x + cy!.x;
    const targetY = canvasBox.y + cy!.y - 96; // 3 tiles up (32px/tile)
    await page.mouse.move(targetX, targetY);
    await page.waitForTimeout(50);
    await page.mouse.click(targetX, targetY);
    await page.waitForTimeout(200);

    // A Power Node now exists and the base has power supply.
    counts = await page.evaluate(() => (window as { __debugBuildingCount?: () => Counts }).__debugBuildingCount?.() ?? { mcv: 0, conyard: 0, power_node: 0 });
    expect(counts.power_node).toBe(1);

    const power = await page.evaluate(() => (window as { __debugPower?: () => { supply: number; demand: number; powered: boolean } }).__debugPower?.() ?? { supply: 0, demand: 0, powered: false });
    expect(power.supply).toBeGreaterThan(0);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 's3-capture.png'), fullPage: true });
  });
});
