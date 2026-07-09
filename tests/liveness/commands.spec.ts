// ── FG-1 command-vocabulary gate: double-click select-type, attack-move, stop ───
import { test, expect } from '@playwright/test';

test.describe('Command vocabulary gate', () => {
  test('dbl-click selects all of type; A+click advances the squad; S halts it', async ({ page }) => {
    await page.goto('/?mission=skirmish');
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } }); // take command
    await page.waitForTimeout(300);
    const box = (await page.locator('#game-canvas').boundingBox())!;

    const infantryPos = () => page.evaluate(() =>
      (window as { __debugUnitScreenPos?: (k: string) => { x: number; y: number } | null }).__debugUnitScreenPos?.('infantry') ?? null);
    const selection = () => page.evaluate(() =>
      (window as { __debugSelection?: () => number }).__debugSelection?.() ?? -1);

    // ── Double-click an infantry → select-all-of-type (both starting soldiers). ──
    const p0 = await infantryPos();
    expect(p0).not.toBeNull();
    await page.mouse.dblclick(box.x + p0!.x, box.y + p0!.y);
    await expect.poll(selection, { timeout: 3000, intervals: [150] }).toBe(2);

    // ── A + click open ground → attack-move: the squad advances. ──
    await page.keyboard.press('a');
    await page.mouse.click(box.x + p0!.x + 120, box.y + p0!.y - 120);
    const start = (await infantryPos())!;
    await expect.poll(async () => {
      const p = await infantryPos();
      return p ? Math.hypot(p.x - start.x, p.y - start.y) : 0;
    }, { timeout: 6000, intervals: [200] }).toBeGreaterThan(20);
    // Selection survives the attack-move click (it's an order, not a select).
    expect(await selection()).toBe(2);

    // ── S → stop: the squad halts and stays halted. ──
    await page.keyboard.press('s');
    await page.waitForTimeout(250);
    const held = (await infantryPos())!;
    await page.waitForTimeout(900);
    const after = (await infantryPos())!;
    expect(Math.hypot(after.x - held.x, after.y - held.y)).toBeLessThan(3);
  });
});
