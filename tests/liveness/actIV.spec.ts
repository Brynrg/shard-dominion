// ── Act IV branch gate: M18 "Ruins" + M20 "Genesis" Seal/Harness choice ────────
import { test, expect } from '@playwright/test';

async function boot(page: import('@playwright/test').Page, missionId: string, choice?: string) {
  if (choice) await page.addInitScript((c) => localStorage.setItem('shardDominion.choice.campaign', c), choice);
  await page.goto(`/?mission=${missionId}`);
  await page.waitForSelector('#game-canvas', { timeout: 10000 });
  await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } });
  await page.waitForTimeout(200);
}
const objs = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as { __debugObjectives?: () => { text: string }[] }).__debugObjectives?.() ?? []);
const hasSpeaker = (page: import('@playwright/test').Page, s: string) =>
  page.evaluate((sp) => ((window as { __debugMessages?: () => { speaker: string }[] }).__debugMessages?.() ?? []).some(m => m.speaker === sp), s);

test.describe('Act IV branch gate', () => {
  test('M18 SEAL: objective matches SEAL, no HARNESS, speaker MARSHAL CORR', async ({ page }) => {
    await boot(page, 'm18_act4_ruins', 'seal');
    const o = await objs(page);
    expect(o.some(x => /SEAL:/i.test(x.text))).toBe(true);
    expect(o.some(x => /HARNESS:/i.test(x.text))).toBe(false);
    await expect.poll(() => hasSpeaker(page, 'MARSHAL CORR'), { timeout: 8000, intervals: [300] }).toBe(true);
  });

  test('M18 HARNESS: objective matches HARNESS, no SEAL, speaker THE CHORUS', async ({ page }) => {
    await boot(page, 'm18_act4_ruins', 'harness');
    const o = await objs(page);
    expect(o.some(x => /HARNESS:/i.test(x.text))).toBe(true);
    expect(o.some(x => /SEAL:/i.test(x.text))).toBe(false);
    await expect.poll(() => hasSpeaker(page, 'THE CHORUS'), { timeout: 8000, intervals: [300] }).toBe(true);
  });

  test('M20 HARNESS: objectives include Destroy all enemy forces AND HARNESS, speaker THE CHORUS', async ({ page }) => {
    await boot(page, 'm20_act4_genesis', 'harness');
    const o = await objs(page);
    expect(o.some(x => /Destroy all enemy forces/i.test(x.text))).toBe(true);
    expect(o.some(x => /HARNESS:/i.test(x.text))).toBe(true);
    await expect.poll(() => hasSpeaker(page, 'THE CHORUS'), { timeout: 8000, intervals: [300] }).toBe(true);
  });

  test('M20 SEAL: objectives include Destroy all enemy forces, no HARNESS, speaker SERA VANE', async ({ page }) => {
    await boot(page, 'm20_act4_genesis', 'seal');
    const o = await objs(page);
    expect(o.some(x => /Destroy all enemy forces/i.test(x.text))).toBe(true);
    expect(o.some(x => /HARNESS:/i.test(x.text))).toBe(false);
    await expect.poll(() => hasSpeaker(page, 'SERA VANE'), { timeout: 8000, intervals: [300] }).toBe(true);
  });
});
