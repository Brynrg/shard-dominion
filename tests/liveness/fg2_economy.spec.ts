// ── FG-2 gate: build a Defense Turret from the sidebar (new economy structures) ─
import { test, expect } from '@playwright/test';

type Counts = { refinery: number; defense_turret: number };

test.describe('FG-2 economy gate', () => {
  test('the Turret sidebar button places a working turret and charges credits', async ({ page }) => {
    await page.goto('/?mission=skirmish');
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } }); // take command
    await page.waitForTimeout(400);
    const box = (await page.locator('#game-canvas').boundingBox())!;

    const credits0 = await page.evaluate(() => (window as { __debugEconomy?: () => { credits: number } }).__debugEconomy?.().credits ?? 0);
    expect(credits0).toBeGreaterThanOrEqual(550); // turret affordable turn one

    // Turret button = row 7 in the sidebar (rows start y≈146, +34 each → centre ≈ 365).
    await page.mouse.click(box.x + 700, box.y + 365);
    await page.waitForTimeout(80);

    // Placement mode → click a tile near the ConYard.
    const cy = await page.evaluate(() => (window as { __debugConYardScreenPos?: () => { x: number; y: number } | null }).__debugConYardScreenPos?.() ?? null);
    expect(cy).not.toBeNull();
    await page.mouse.move(box.x + cy!.x, box.y + cy!.y - 96);
    await page.waitForTimeout(50);
    await page.mouse.click(box.x + cy!.x, box.y + cy!.y - 96);

    await expect.poll(
      () => page.evaluate(() => ((window as { __debugBuildingCount?: () => Counts }).__debugBuildingCount?.() ?? { refinery: 0, defense_turret: 0 }).defense_turret),
      { timeout: 4000, intervals: [200] },
    ).toBe(1);
    const credits1 = await page.evaluate(() => (window as { __debugEconomy?: () => { credits: number } }).__debugEconomy?.().credits ?? 0);
    expect(credits1).toBeLessThan(credits0);
  });
});
