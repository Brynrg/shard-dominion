// ── XP-6 gate: the finale asks the Choice; each branch boots its own objective ──
import { test, expect } from '@playwright/test';

test.describe('XP-6 finale gate', () => {
  test('M14 shows THE CHOICE; picking SEAL boots the hold objective', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/?mission=m14_first_vein');
    await expect(page.locator('.sd-overlay')).toContainText('THE CHOICE', { timeout: 15000 });
    await page.getByRole('button', { name: /SEAL THE DEEP/ }).click();
    // The pick stores + reloads into the seal branch.
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } }); // take command
    await page.waitForTimeout(400);
    const objs = await page.evaluate(() => (window as { __debugObjectives?: () => { text: string }[] }).__debugObjectives?.() ?? []);
    expect(objs.some(o => /SEAL: hold the First Vein/i.test(o.text))).toBe(true);
    expect(objs.some(o => /HARNESS/i.test(o.text))).toBe(false);
    // The seal-branch trigger fired; the harness one did not.
    const fired = await page.evaluate(() => (window as { __debugTriggersFired?: () => string[] }).__debugTriggersFired?.() ?? []);
    expect(fired).toContain('t14_seal_open');
    expect(fired).not.toContain('t14_harness_open');
  });

  test('M11 boots with bomber-wave triggers wired', async ({ page }) => {
    await page.goto('/?mission=m11_cauterize');
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(400);
    const objs = await page.evaluate(() => (window as { __debugObjectives?: () => { text: string }[] }).__debugObjectives?.() ?? []);
    expect(objs.some(o => /Survive Cauterize/i.test(o.text))).toBe(true);
  });
});
