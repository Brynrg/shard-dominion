// ── M7 gate: "The Turn" boots, its objectives wire, and the Directorate purge fires ─
import { test, expect } from '@playwright/test';

test.describe('M7 The Turn gate', () => {
  test('m7 boots with the defection objectives and the Directorate opens the purge', async ({ page }) => {
    await page.goto('/?mission=m7_the_turn');
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } }); // take command
    await page.waitForTimeout(200);

    // Objectives are wired: the 5:00 survive primary + the link-up secondary.
    const objs = await page.evaluate(() => (window as { __debugObjectives?: () => { text: string }[] }).__debugObjectives?.() ?? []);
    expect(objs.some(o => /survive the Directorate/i.test(o.text))).toBe(true);
    expect(objs.some(o => /link up with Vane/i.test(o.text))).toBe(true);

    // Double speed so the 8s purge trigger lands in ~4s of wall time.
    await page.keyboard.press('+');
    await page.keyboard.press('+');

    await expect.poll(
      () => page.evaluate(() => ((window as { __debugMessages?: () => { speaker: string }[] }).__debugMessages?.() ?? []).some(m => m.speaker === 'DIRECTOR HALEX')),
      { timeout: 12000, intervals: [400] },
    ).toBe(true);
  });
});
