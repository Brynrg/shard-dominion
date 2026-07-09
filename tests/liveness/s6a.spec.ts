// ── S6A liveness gate: the AI plays — builds an army with real credits and attacks ──
// Supersedes the pre-AI s4a gate (combat mechanics are covered by the unit suite;
// this proves the full match loop on screen: AI economy → production → assault → fight).
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, '../../screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

type Match = { enemyUnits: number; playerUnits: number; enemyCredits: number };

test.describe('S6A liveness gate', () => {
  test('the AI buys units, marches on the player, and a fight breaks out', async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto('/?mission=skirmish&difficulty=hard'); // hard = 24s grace — this gate tests AI aggression mechanics, not difficulty pacing
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    // Dismiss the mission briefing (the player's "click to take command") — this
    // unpauses the sim AND grabs focus. Every gate must do it before the match runs.
    await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(60);
    await page.waitForTimeout(500);

    const match = () => page.evaluate(() =>
      (window as { __debugMatch?: () => Match }).__debugMatch?.() ?? { enemyUnits: -1, playerUnits: -1, enemyCredits: -1 });

    // Start: 2 player defenders, no enemy units on the field yet. (The AI may have
    // already QUEUED its first unit within the first ticks — credits ≤ 600.)
    const start = await match();
    expect(start.playerUnits).toBe(2);
    expect(start.enemyUnits).toBe(0);
    expect(start.enemyCredits).toBeLessThanOrEqual(600);

    // Phase 1 — production: the AI QUEUES and PAYS (credits drop) and units spawn.
    let m: Match = start;
    await expect.poll(async () => { m = await match(); return m.enemyUnits; }, {
      timeout: 30_000, message: 'AI should produce its first unit',
    }).toBeGreaterThan(0);
    expect(m.enemyCredits).toBeLessThan(600); // paid real credits — no free units

    // Phase 2 — assault: the army marches ~10 tiles and a fight breaks out at the
    // base. Evidence of battle: somebody dies (either side's living count drops
    // below its observed peak).
    let peakEnemy = m.enemyUnits;
    await expect.poll(async () => {
      m = await match();
      peakEnemy = Math.max(peakEnemy, m.enemyUnits);
      const casualties = m.playerUnits < 2 || m.enemyUnits < peakEnemy;
      return casualties;
    }, { timeout: 100_000, message: 'the AI wave should reach the base and fight' }).toBe(true); // widened for the 24s hard-difficulty grace period (QA BUG-5)

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 's6a-match-capture.png'), fullPage: true });
  });
});
