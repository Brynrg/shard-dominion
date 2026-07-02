// ── P0b liveness gate: the PLAYER can train an army (the "I can play" fix) ───────
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, '../../screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

type Match = { enemyUnits: number; playerUnits: number; enemyCredits: number };

test.describe('P0b liveness gate', () => {
  test('pressing T trains an infantry — the player unit count rises', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    await page.waitForTimeout(500);

    const match = () => page.evaluate(() =>
      (window as { __debugMatch?: () => Match }).__debugMatch?.() ?? { enemyUnits: -1, playerUnits: -1, enemyCredits: -1 });
    const queueLen = () => page.evaluate(() =>
      (window as { __debugPlayerQueue?: () => number }).__debugPlayerQueue?.() ?? -1);

    const start = await match();
    expect(start.playerUnits).toBeGreaterThanOrEqual(2); // the 2 seeded defenders

    // Train two infantry via the hotkey.
    await page.keyboard.press('t');
    await page.keyboard.press('t');
    // The queue registered the order (may already be building the first).
    expect(await queueLen()).toBeGreaterThanOrEqual(0);

    // Within a couple build cycles, the player's living unit count exceeds the start
    // (trained infantry joined the field) — proof the player can build an army.
    let peak = start.playerUnits;
    await expect.poll(async () => {
      peak = Math.max(peak, (await match()).playerUnits);
      return peak;
    }, { timeout: 40_000, message: 'a trained unit should join the player force' })
      .toBeGreaterThan(start.playerUnits);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'p0b-train-capture.png'), fullPage: true });
  });
});
