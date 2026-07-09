// ── HUD liveness gate: the C&C-style sidebar build buttons are clickable ────────
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, '../../screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

type Counts = { mcv: number; conyard: number; power_node: number; barracks: number };
const zero: Counts = { mcv: 0, conyard: 0, power_node: 0, barracks: 0 };

test.describe('HUD build-button gate', () => {
  test('clicking the Barracks button in the sidebar builds one (no hotkey)', async ({ page }) => {
    await page.goto('/?mission=skirmish');
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } }); // take command
    await page.waitForTimeout(60);
    const canvas = page.locator('#game-canvas');
    const box = (await canvas.boundingBox())!;
    // XP-1 tabs: click sidebar buttons via their LIVE rects.
    const clickAction = async (action: string) => {
      const r = await page.evaluate((a) => (window as { __debugButtonRect?: (x: string) => { x: number; y: number; w: number; h: number } | null }).__debugButtonRect?.(a) ?? null, action);
      if (!r) throw new Error(`no rect for ${action}`);
      await page.mouse.click(box.x + r.x + r.w / 2, box.y + r.y + r.h / 2);
      await page.waitForTimeout(80);
    };
    await page.waitForTimeout(400);

    const credits0 = await page.evaluate(() => (window as { __debugEconomy?: () => { credits: number } }).__debugEconomy?.().credits ?? 0);

    // Click the Barracks button on the STRUCT tab (NOT the 'b' key).
    await clickAction('build:barracks');
    await page.waitForTimeout(80);

    // Now in placement mode → click a tile near the ConYard to place the barracks.
    const cy = await page.evaluate(() => (window as { __debugConYardScreenPos?: () => { x: number; y: number } | null }).__debugConYardScreenPos?.() ?? null);
    expect(cy).not.toBeNull();
    const tx = box.x + cy!.x, ty = box.y + cy!.y - 96;
    await page.mouse.move(tx, ty);
    await page.waitForTimeout(50);
    await page.mouse.click(tx, ty);
    await page.waitForTimeout(200);

    const counts = await page.evaluate(() => (window as { __debugBuildingCount?: () => Counts }).__debugBuildingCount?.() ?? zero);
    expect(counts.barracks).toBe(1);
    const credits1 = await page.evaluate(() => (window as { __debugEconomy?: () => { credits: number } }).__debugEconomy?.().credits ?? 0);
    expect(credits1).toBeLessThan(credits0);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'hud-build-click.png'), fullPage: true });
  });
});
