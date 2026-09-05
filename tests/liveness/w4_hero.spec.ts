// ── W4 hero kit gate: the Warden is on the field from M1 and F1/F2 cast through the real input path.
// Drafted by the local coder (hermes-ask cheap) to packets/W4c-hero-gate.md; reviewed.
import { test, expect } from '@playwright/test';

test.describe('W4 hero kit gate', () => {
  test('The Warden stands with the squad at boot; F1 casts Rally Surge; F2 casts Aegis', async ({ page }) => {
    // 1. Boot up and verify the Warden is present.
    await page.goto('/?mission=m1_first_light');
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } }); // take command
    await page.waitForTimeout(300);

    const hero = () => page.evaluate(() =>
      (window as { __debugHero?: () => { kind: string; hp: number; cooldowns: Record<string, number> } | null }).__debugHero?.() ?? null);

    // Assert the hero exists, is a 'warden', and has health.
    await expect.poll(hero, { timeout: 5000, intervals: [300] }).not.toBeNull();
    const initialHero = await hero();
    expect(initialHero).not.toBeNull();
    expect(initialHero!.kind).toBe('warden');
    expect(initialHero!.hp).toBeGreaterThan(0);

    // 2. Test F1 (Rally Surge) casting and cooldown behavior.
    // Press 'o' to select the hero, then 'F1' to cast.
    await page.keyboard.press('o');
    await page.waitForTimeout(200);
    await page.keyboard.press('F1');

    // Poll until the cooldown for 'rally_surge' is > 0 (cast started).
    await expect.poll(async () => {
      const h = await hero();
      return h ? (h.cooldowns.rally_surge ?? -1) : -1;
    }, { timeout: 5000, intervals: [300] }).toBeGreaterThan(0);

    // Read the current cooldown value.
    const firstRead = await hero();
    const cooldown1 = firstRead!.cooldowns.rally_surge ?? -1;

    // Press F1 again immediately to ensure it does NOT restart the cooldown (or increase it).
    // The prompt implies we check that the second value is <= the first (counting down).
    await page.keyboard.press('F1');
    await page.waitForTimeout(300);

    const secondRead = await hero();
    const cooldown2 = secondRead!.cooldowns.rally_surge ?? -1;

    // Assert that the cooldown did not reset upward. It should be <= the previous value (counting down).
    expect(cooldown2).toBeLessThanOrEqual(cooldown1);

    // 3. Test F2 (Aegis) casting.
    // Press 'o' to select the hero again, then 'F2' to cast Aegis.
    await page.keyboard.press('o');
    await page.waitForTimeout(200);
    await page.keyboard.press('F2');

    // Poll until the cooldown for 'aegis' is > 0.
    await expect.poll(async () => {
      const h = await hero();
      return h ? (h.cooldowns.aegis ?? -1) : -1;
    }, { timeout: 5000, intervals: [300] }).toBeGreaterThan(0);
  });
});
