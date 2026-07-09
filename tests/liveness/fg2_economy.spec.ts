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
    // XP-1 tabs: click sidebar buttons via their LIVE rects (canvas px == CSS px at
    // the gate viewport), switching tabs first when the item lives on UNITS.
    const clickAction = async (action: string) => {
      const r = await page.evaluate((a) => (window as { __debugButtonRect?: (x: string) => { x: number; y: number; w: number; h: number } | null }).__debugButtonRect?.(a) ?? null, action);
      if (!r) throw new Error(`no rect for ${action}`);
      await page.mouse.click(box.x + r.x + r.w / 2, box.y + r.y + r.h / 2);
      await page.waitForTimeout(80);
    };


    const credits0 = await page.evaluate(() => (window as { __debugEconomy?: () => { credits: number } }).__debugEconomy?.().credits ?? 0);
    expect(credits0).toBeGreaterThanOrEqual(550); // turret affordable turn one

    // Turret button via its live rect (XP-1 tabs).
    await clickAction('tab:def');
    await clickAction('build:defense_turret');
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
