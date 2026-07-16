// ── Accessibility gate: aria-live announcer + colorblind team-shape toggle ─────
import { test, expect } from '@playwright/test';

test.describe('Accessibility gate', () => {
  test('announcer speaks mission start; pause-menu TEAM SHAPES toggles, persists, and survives reload', async ({ page }) => {
    await page.goto('/?mission=skirmish');
    await page.waitForSelector('#game-canvas', { timeout: 10000 });

    // The aria-live region exists from boot (screen readers need it present early).
    const announcer = page.locator('#sd-announcer');
    await expect(announcer).toHaveAttribute('aria-live', 'polite');

    // Taking command announces the mission.
    await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } });
    await expect(announcer).toContainText('Mission started', { timeout: 5000 });

    const a11y = () => page.evaluate(() =>
      (window as { __debugA11y?: () => { teamShapes: boolean; lastAnnouncement: string } }).__debugA11y?.() ?? null);
    expect((await a11y())!.teamShapes).toBe(false);

    // Pause → toggle TEAM SHAPES on → resume.
    await page.keyboard.press('p');
    const toggle = page.locator('#sd-a11y-shapes');
    await expect(toggle).toBeVisible();
    await expect(toggle).toContainText('OFF');
    await toggle.click();
    await expect(toggle).toContainText('ON');
    await page.keyboard.press('p');
    expect((await a11y())!.teamShapes).toBe(true);

    // The setting persists across a reload (localStorage).
    await page.reload();
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    await expect.poll(async () => (await a11y())?.teamShapes ?? null, { timeout: 5000, intervals: [200] }).toBe(true);
  });
});
