// ── Camera liveness gate: edge-scroll + wheel zoom (C&C/RA navigation) ──────────
import { test, expect } from '@playwright/test';

type Cam = { x: number; y: number; zoom: number };

test.describe('Camera navigation gate', () => {
  test('mouse at a screen edge scrolls the view; wheel zooms', async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto('/?mission=skirmish');
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } }); // take command
    await page.waitForTimeout(80);
    const canvas = page.locator('#game-canvas');
    const box = (await canvas.boundingBox())!;

    const cam = () => page.evaluate(() => (window as { __debugCamera?: () => Cam }).__debugCamera?.() ?? { x: 0, y: 0, zoom: 1 });

    // Park the cursor on the LEFT edge → the view should scroll left. (The right
    // edge is no longer usable in the 640px test viewport: panelRect now reports the
    // REAL 608px panel height — it used to claim 380 — so the whole right edge is
    // correctly a dead zone at this window size, exactly like RA's sidebar.)
    const start = await cam();
    await page.mouse.move(box.x + 6, box.y + box.height * 0.5);
    await page.waitForTimeout(800); // dwell (180ms) + several frames of edge-scroll
    const scrolled = await cam();
    expect(scrolled.x).toBeLessThan(start.x - 100);

    // Move off the edge (centre) → scrolling stops.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(150);
    const held = await cam();
    await page.waitForTimeout(300);
    const still = await cam();
    expect(Math.abs(still.x - held.x)).toBeLessThan(60); // basically stopped

    // Wheel up over the canvas → zoom increases.
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(150);
    expect((await cam()).zoom).toBeGreaterThan(still.zoom);
  });
});
