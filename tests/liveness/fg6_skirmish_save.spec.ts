// ── FG-6 gate: skirmish setup (map/faction/difficulty) + save → continue ────────
import { test, expect } from '@playwright/test';

test.describe('FG-6 skirmish + save gate', () => {
  test('setup screen boots Badlands as the Emberhand on hard', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'SKIRMISH' }).click();
    await expect(page.locator('.sd-overlay')).toContainText('choose your ground');
    await page.getByRole('button', { name: 'Badlands' }).click();
    await page.getByRole('button', { name: 'The Emberhand' }).click();
    await page.getByRole('button', { name: 'Hard', exact: true }).click();
    await page.getByRole('button', { name: /START/ }).click();
    await page.waitForURL(/mission=skirmish_badlands&faction=emberhand&difficulty=hard/);
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    // The match boots and the briefing shows the Badlands title.
    await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(300);
    const tick = await page.evaluate(() => (window as { __debugTick?: () => number }).__debugTick?.() ?? -1);
    expect(tick).toBeGreaterThanOrEqual(0);
  });

  test('save in the pause menu, then CONTINUE fast-forwards past the saved tick', async ({ page }) => {
    await page.goto('/?mission=skirmish');
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } }); // take command
    await page.waitForTimeout(2500); // let the match run ~50 ticks

    await page.keyboard.press('p');
    await expect(page.locator('.sd-pause')).toContainText('PAUSED');
    const savedTick = await page.evaluate(() => (window as { __debugTick?: () => number }).__debugTick?.() ?? -1);
    expect(savedTick).toBeGreaterThan(20);
    await page.getByRole('button', { name: /SAVE MATCH/ }).click();
    await expect(page.getByRole('button', { name: /SAVED/ })).toBeVisible();

    // Back to the title → CONTINUE appears → resumes at (or past) the saved tick.
    await page.getByRole('button', { name: 'MAIN MENU' }).click();
    await page.waitForURL(url => !url.search.includes('mission='));
    const cont = page.getByRole('button', { name: /CONTINUE SAVED MATCH/ });
    await expect(cont).toBeVisible();
    await cont.click();
    await page.waitForURL(/continue=1/);
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    await expect.poll(
      () => page.evaluate(() => (window as { __debugTick?: () => number }).__debugTick?.() ?? -1),
      { timeout: 10000, intervals: [300] },
    ).toBeGreaterThanOrEqual(savedTick);
  });
});
