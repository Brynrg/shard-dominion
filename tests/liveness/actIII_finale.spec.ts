// ── Act III finale gate: M16 "The Ash Court" + M17 "Aether's Verdict" branch ────
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

test.describe('Act III finale gate', () => {
  test('M16 The Ash Court: boots with the destroy-command objective and Vane hails the assault', async ({ page }) => {
    await boot(page, 'm16_ash_court', 'seal');
    const o = await objs(page);
    expect(o.some(x => /Directorate forward command/i.test(x.text))).toBe(true);
    await expect.poll(() => hasSpeaker(page, 'SERA VANE'), { timeout: 8000, intervals: [300] }).toBe(true);
  });

  test('M17 HARNESS: both primaries live (end Halex + leash the Chorus) and the Chorus rises', async ({ page }) => {
    await boot(page, 'm17_aethers_verdict', 'harness');
    const o = await objs(page);
    expect(o.some(x => /End Director Halex/i.test(x.text))).toBe(true);
    expect(o.some(x => /keep the Chorus leashed/i.test(x.text))).toBe(true);
    await expect.poll(() => hasSpeaker(page, 'THE CHORUS'), { timeout: 8000, intervals: [300] }).toBe(true);
  });

  test('M17 SEAL: only the end-Halex primary (no Chorus leash) and Corr confirms the quiet planet', async ({ page }) => {
    await boot(page, 'm17_aethers_verdict', 'seal');
    const o = await objs(page);
    expect(o.some(x => /End Director Halex/i.test(x.text))).toBe(true);
    expect(o.some(x => /keep the Chorus leashed/i.test(x.text))).toBe(false);
    await expect.poll(() => hasSpeaker(page, 'MARSHAL CORR'), { timeout: 8000, intervals: [300] }).toBe(true);
  });
});
