// ── FG-4 gate: mission select (linear unlock) + m2 briefing + trigger comm msgs ─
import { test, expect } from '@playwright/test';

test.describe('FG-4 campaign gate', () => {
  test('Campaign opens mission select: M1 unlocked, M2 locked (fresh profile)', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /CAMPAIGN/ }).click();
    await expect(page.locator('.sd-overlay')).toContainText('Operation: Aether Prime');
    const m1 = page.getByRole('button', { name: /Mission 1: First Light/ });
    const m2 = page.getByRole('button', { name: /Mission 2: Lifeblood/ });
    await expect(m1).toBeEnabled();
    await expect(m2).toBeDisabled();
    // Picking M1 deep-links it.
    await m1.click();
    await page.waitForURL(/mission=m1_first_light/);
    await page.waitForSelector('#game-canvas');
  });

  test('m2 "Lifeblood" runs its triggers: Vane comm message + objectives banner', async ({ page }) => {
    await page.goto('/?mission=m2_lifeblood');
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } }); // take command
    await page.waitForTimeout(200);

    // The mission's objectives are wired.
    const objs = await page.evaluate(() => (window as { __debugObjectives?: () => { text: string }[] }).__debugObjectives?.() ?? []);
    expect(objs.some(o => /1,500/.test(o.text))).toBe(true);

    // Double game speed so the 18s Vane trigger lands in ~9s of wall time.
    await page.keyboard.press('+');
    await page.keyboard.press('+');

    await expect.poll(
      () => page.evaluate(() => ((window as { __debugMessages?: () => { speaker: string }[] }).__debugMessages?.() ?? []).some(m => m.speaker === 'SERA VANE')),
      { timeout: 16000, intervals: [400] },
    ).toBe(true);
  });
});
