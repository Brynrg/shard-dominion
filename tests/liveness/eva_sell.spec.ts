// ── v0.52 Westwood feedback gate: EVA insufficient-funds line + the Sell flow ──
import { test, expect } from '@playwright/test';

test.describe('EVA + Sell gate', () => {
  test('clicking an unaffordable build says INSUFFICIENT FUNDS; selling the ConYard refunds credits and demolishes it', async ({ page }) => {
    await page.goto('/?mission=skirmish');
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } }); // take command
    await page.waitForTimeout(300);
    const box = (await page.locator('#game-canvas').boundingBox())!;
    const scaleFor = async () => {
      const b = (await page.locator('#game-canvas').boundingBox())!;
      return { sx: b.width / 800, sy: b.height / 600 };
    };

    const rectOf = (a: string) => page.evaluate((x) =>
      (window as { __debugButtonRect?: (s: string) => { x: number; y: number; w: number; h: number } | null }).__debugButtonRect?.(x) ?? null, a);
    const evaState = () => page.evaluate(() =>
      (window as { __debugEva?: () => { last: string; voice: boolean } }).__debugEva?.() ?? null);
    const credits = () => page.evaluate(() =>
      (window as { __debugEconomy?: () => { credits: number } }).__debugEconomy?.().credits ?? -1);
    const buildings = () => page.evaluate(() =>
      (window as { __debugBuildingCount?: () => { conyard: number } }).__debugBuildingCount?.() ?? null);

    // ── EVA: the Refinery costs 1200, we start with 600 → the button is disabled
    //    and clicking it must announce INSUFFICIENT FUNDS (banner + debug hook). ──
    const s = await scaleFor();
    const refBtn = (await rectOf('build:refinery'))!;
    expect(refBtn).not.toBeNull();
    await page.mouse.click(box.x + (refBtn.x + refBtn.w / 2) * s.sx, box.y + (refBtn.y + refBtn.h / 2) * s.sy);
    await expect.poll(async () => (await evaState())?.last ?? '', { timeout: 3000, intervals: [150] })
      .toContain('Insufficient funds');
    await expect(page.locator('#sd-eva')).toContainText('INSUFFICIENT FUNDS');

    // ── Placement refusal (v0.54): B, then click ON the ConYard (occupied →
    //    invalid) — EVA refuses and the ghost STAYS in hand (RA red-grid feel). ──
    const cy = await page.evaluate(() =>
      (window as { __debugConYardScreenPos?: () => { x: number; y: number } | null }).__debugConYardScreenPos?.() ?? null);
    expect(cy).not.toBeNull();
    const placement = () => page.evaluate(() =>
      (window as { __debugPlacement?: () => { structureId: string } | null }).__debugPlacement?.() ?? null);
    const jobReady = () => page.evaluate(() =>
      (window as { __debugStructureJob?: () => { ready: boolean } | null }).__debugStructureJob?.()?.ready ?? false);
    // RA flow (v0.55): B starts the sidebar job; B again at READY arms the ghost.
    await page.keyboard.press('b');
    await expect.poll(jobReady, { timeout: 30000, intervals: [500] }).toBe(true);
    await page.keyboard.press('b');
    await page.mouse.click(box.x + cy!.x, box.y + cy!.y); // occupied tile → refused
    await expect.poll(async () => (await evaState())?.last ?? '', { timeout: 3000, intervals: [150] })
      .toContain('Cannot deploy there');
    expect((await placement())?.structureId, 'ghost must stay in hand after a refused click').toBe('barracks');
    await page.keyboard.press('Escape'); // drop the ghost (the READY job persists — RA keeps it)
    await page.waitForTimeout(200);

    // ── Sell: select the ConYard, press the sidebar SELL button → the building
    //    demolishes and half its cost lands in the bank. ──
    await page.mouse.click(box.x + cy!.x, box.y + cy!.y);
    await page.waitForTimeout(400);
    const sellBtn = (await rectOf('sell:selected'))!;
    expect(sellBtn).not.toBeNull();
    const before = await credits();
    await page.mouse.click(box.x + (sellBtn.x + sellBtn.w / 2) * s.sx, box.y + (sellBtn.y + sellBtn.h / 2) * s.sy);
    await expect.poll(async () => (await buildings())?.conyard ?? -1, { timeout: 3000, intervals: [150] }).toBe(0);
    expect(await credits()).toBeGreaterThan(before);
  });
});
