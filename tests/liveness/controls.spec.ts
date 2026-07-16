// ── Control fit-and-finish gate: Q army-select, groups 1-9 + double-tap centre,
//    I idle-harvester, O hero no-op ────────────────────────────────────────────
import { test, expect } from '@playwright/test';

test.describe('WC3-grade control gate', () => {
  test('Q grabs the army; Ctrl+1/1 assigns+recalls; double-tap centres; I finds the idle harvester; O without a hero is a no-op', async ({ page }) => {
    await page.goto('/?mission=skirmish');
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } }); // take command
    await page.waitForTimeout(300);
    const box = (await page.locator('#game-canvas').boundingBox())!;

    const selection = () => page.evaluate(() =>
      (window as { __debugSelection?: () => number }).__debugSelection?.() ?? -1);
    const camera = () => page.evaluate(() =>
      (window as { __debugCamera?: () => { x: number; y: number; zoom: number } }).__debugCamera?.() ?? null);
    const unitPos = (k: string) => page.evaluate((kind) =>
      (window as { __debugUnitScreenPos?: (k: string) => { x: number; y: number } | null }).__debugUnitScreenPos?.(kind) ?? null, k);

    // ── Q → select the whole starting army (2 troops; the harvester is excluded). ──
    await page.keyboard.press('q');
    await expect.poll(selection, { timeout: 3000, intervals: [150] }).toBe(2);

    // ── Ctrl+1 assigns the group; clicking open ground drops the selection;
    //    pressing 1 recalls it. ──
    await page.keyboard.press('Control+1');
    await page.waitForTimeout(200);
    await page.mouse.click(box.x + 60, box.y + 60); // empty corner → deselect
    await expect.poll(selection, { timeout: 3000, intervals: [150] }).toBe(0);
    await page.keyboard.press('1');
    await expect.poll(selection, { timeout: 3000, intervals: [150] }).toBe(2);

    // ── Pan far away, then double-tap 1 → the camera centres back on the group. ──
    for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowRight');
    const far = (await camera())!;
    await page.keyboard.press('1');
    await page.waitForTimeout(120); // within the 450ms double-tap window
    await page.keyboard.press('1');
    await expect.poll(async () => {
      const c = await camera();
      return c ? Math.abs(c.x - far.x) : 0;
    }, { timeout: 2000, intervals: [100] }).toBeGreaterThan(100);

    // ── Idle the harvester (manual move suspends its FSM), then I selects it. ──
    // The harvester is mining, so it moves between polls — retry-click until it's
    // the selection, then order it onto OPEN ground by the ConYard (right-clicking
    // near its own position would hit the shard field = a mine order, not a move).
    for (let attempt = 0; attempt < 6; attempt++) {
      const hp = await unitPos('harvester');
      if (hp) await page.mouse.click(box.x + hp.x, box.y + hp.y);
      await page.waitForTimeout(400);
      if ((await selection()) === 1) break;
    }
    expect(await selection()).toBe(1);
    const cy = await page.evaluate(() =>
      (window as { __debugConYardScreenPos?: () => { x: number; y: number } | null }).__debugConYardScreenPos?.() ?? null);
    expect(cy).not.toBeNull();
    await page.mouse.click(box.x + cy!.x, box.y + cy!.y + 70, { button: 'right' }); // move → IDLE
    await page.waitForTimeout(600); // the move order lands → FSM = IDLE (economically idle counts, even mid-walk)
    await page.keyboard.press('q'); // selection = the 2 troops again
    await expect.poll(selection, { timeout: 3000, intervals: [150] }).toBe(2);
    await page.keyboard.press('i');
    await expect.poll(selection, { timeout: 3000, intervals: [150] }).toBe(1);

    // ── O with no hero on the field must NOT throw away the selection. ──
    await page.keyboard.press('o');
    await page.waitForTimeout(400);
    expect(await selection()).toBe(1);
  });
});
