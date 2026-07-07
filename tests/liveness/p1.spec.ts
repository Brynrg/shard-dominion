// ── P1 liveness gate: the onboarding flow — briefing pauses, take-command runs, ──
// clicking a unit actually selects it (the "I can't interact" coordinate fix). ────
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, '../../screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

test.describe('P1 onboarding gate', () => {
  test('briefing pauses the sim; take-command starts it; a click selects a unit', async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto('/');
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    const canvas = page.locator('#game-canvas');
    const box = (await canvas.boundingBox())!;

    const briefing = () => page.evaluate(() => (window as { __debugBriefing?: () => boolean }).__debugBriefing?.() ?? false);
    const credits = () => page.evaluate(() => (window as { __debugEconomy?: () => { credits: number } }).__debugEconomy?.().credits ?? -1);
    const selection = () => page.evaluate(() => (window as { __debugSelection?: () => number }).__debugSelection?.() ?? -1);

    // 1) The briefing is up and the sim is PAUSED — credits do not move.
    expect(await briefing()).toBe(true);
    const c0 = await credits();
    await page.waitForTimeout(700);
    expect(await credits()).toBe(c0); // paused: no economy ticks

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'p1-briefing.png') });

    // 2) Take command: the first click dismisses the briefing and unpauses.
    //    Click centre (not a corner) so the resting cursor doesn't trigger edge-scroll.
    await canvas.click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(60);
    expect(await briefing()).toBe(false);

    // 3) The sim now runs — the harvester banks credits.
    await expect.poll(async () => await credits(), { timeout: 8000, message: 'credits should rise once the match starts' })
      .toBeGreaterThan(c0);

    // 4) Clicking a unit at its reported screen position SELECTS it — proves the
    //    click→world coordinate mapping works (the interaction bug fix).
    const hp = await page.evaluate(() => (window as { __debugHarvesterScreenPos?: () => { x: number; y: number } | null }).__debugHarvesterScreenPos?.() ?? null);
    expect(hp).not.toBeNull();
    await page.mouse.click(box.x + hp!.x, box.y + hp!.y);
    await page.waitForTimeout(80);
    expect(await selection()).toBeGreaterThanOrEqual(1);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'p1-selected.png') });
  });
});
