// ── Act III gate: M15 "Aftershock" inherits the M14 Seal/Harness choice ─────────
// Proves the inheritsChoice plumbing: the campaign choice (stored at M14) branches
// M15's objectives (onlyIfChoice) and triggers (when.choice) with no choice of its own.
import { test, expect } from '@playwright/test';

async function bootWithChoice(page: import('@playwright/test').Page, choice: string) {
  await page.addInitScript((c) => localStorage.setItem('shardDominion.choice.campaign', c), choice);
  await page.goto('/?mission=m15_aftershock');
  await page.waitForSelector('#game-canvas', { timeout: 10000 });
  await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } }); // take command
  await page.waitForTimeout(200);
}

test.describe('M15 Aftershock — Act III branch gate', () => {
  test('SEAL path: the seal secondary is live and the Directorate siege hails', async ({ page }) => {
    await bootWithChoice(page, 'seal');
    const objs = await page.evaluate(() => (window as { __debugObjectives?: () => { text: string }[] }).__debugObjectives?.() ?? []);
    expect(objs.some(o => /SEAL:/i.test(o.text))).toBe(true);
    expect(objs.some(o => /HARNESS:/i.test(o.text))).toBe(false); // harness objective filtered out
    // when.choice fires from tick 1 — Corr's seal-branch hail appears immediately.
    await expect.poll(
      () => page.evaluate(() => ((window as { __debugMessages?: () => { speaker: string }[] }).__debugMessages?.() ?? []).some(m => m.speaker === 'MARSHAL CORR')),
      { timeout: 8000, intervals: [300] },
    ).toBe(true);
  });

  test('HARNESS path: the harness secondary is live and the Chorus rises', async ({ page }) => {
    await bootWithChoice(page, 'harness');
    const objs = await page.evaluate(() => (window as { __debugObjectives?: () => { text: string }[] }).__debugObjectives?.() ?? []);
    expect(objs.some(o => /HARNESS:/i.test(o.text))).toBe(true);
    expect(objs.some(o => /SEAL:/i.test(o.text))).toBe(false);
    await expect.poll(
      () => page.evaluate(() => ((window as { __debugMessages?: () => { speaker: string }[] }).__debugMessages?.() ?? []).some(m => m.speaker === 'THE CHORUS')),
      { timeout: 8000, intervals: [300] },
    ).toBe(true);
  });
});
