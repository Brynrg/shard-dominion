// ── v0.51 beyond-WC3 gate: shift-queued waypoints + military-first box select ──
import { test, expect } from '@playwright/test';

test.describe('Beyond-WC3 control depth gate', () => {
  test('military-first box excludes the harvester; shift-queue marches the squad through both legs', async ({ page }) => {
    await page.goto('/?mission=skirmish');
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } }); // take command
    await page.waitForTimeout(300);
    const box = (await page.locator('#game-canvas').boundingBox())!;

    const selection = () => page.evaluate(() =>
      (window as { __debugSelection?: () => number }).__debugSelection?.() ?? -1);
    const infantryPos = () => page.evaluate(() =>
      (window as { __debugUnitScreenPos?: (k: string) => { x: number; y: number } | null }).__debugUnitScreenPos?.('infantry') ?? null);
    const harvesterPos = () => page.evaluate(() =>
      (window as { __debugUnitScreenPos?: (k: string) => { x: number; y: number } | null }).__debugUnitScreenPos?.('harvester') ?? null);

    // ── Military-first box: drag a rect covering troops AND the harvester —
    //    only the 2 fighters may land in the selection. ──
    const ip = (await infantryPos())!;
    const hp0 = (await harvesterPos())!;
    // Clamp the drag inside the canvas and clear of the COMMAND panel — on the
    // 48x48 map the units sit farther apart on screen and a naive ±120px box ran
    // off the edge (a drag that starts outside the canvas selects nothing).
    const panelX = box.width - 200;
    const x0 = Math.max(8, Math.min(ip.x, hp0.x) - 120), y0 = Math.max(8, Math.min(ip.y, hp0.y) - 120);
    const x1 = Math.min(panelX, Math.max(ip.x, hp0.x) + 120), y1 = Math.min(box.height - 8, Math.max(ip.y, hp0.y) + 120);
    await page.mouse.move(box.x + x0, box.y + y0);
    await page.mouse.down();
    await page.mouse.move(box.x + x1, box.y + y1, { steps: 5 });
    await page.mouse.up();
    await expect.poll(selection, { timeout: 3000, intervals: [150] }).toBe(2);

    // ── Shift-queued waypoints: leg A (right-click), then Shift+right-click leg B.
    //    The squad must keep marching after leg A — total travel far exceeds it. ──
    const start = (await infantryPos())!;
    const ax = start.x + 90, ay = start.y;         // leg A: east
    const bx = start.x + 90, by = start.y - 90;    // leg B: then north
    await page.mouse.click(box.x + ax, box.y + ay, { button: 'right' });
    await page.keyboard.down('Shift');
    await page.mouse.click(box.x + bx, box.y + by, { button: 'right' });
    await page.keyboard.up('Shift');

    // March through BOTH legs: the unit ends near B (up-and-right of start).
    await expect.poll(async () => {
      const p = await infantryPos();
      if (!p) return 0;
      // Progress along leg B = how far it has climbed north after the east leg.
      return p.x > start.x + 50 && p.y < start.y - 50 ? 1 : 0;
    }, { timeout: 15000, intervals: [300] }).toBe(1);

    // Queue drained: selection survives (orders never deselect).
    expect(await selection()).toBe(2);
  });
});
