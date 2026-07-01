// ── S4A liveness gate: two units fight, one dies, a side wins ────────────────────
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, '../../screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

type Units = { player: number; enemy: number };
type Victory = { over: boolean; winner: 'player' | 'enemy' | null };

test.describe('S4A liveness gate', () => {
  test('a player + enemy unit fight; the enemy dies and the player wins', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    await expect(page.locator('#game-canvas')).toBeVisible();
    await page.waitForTimeout(500);

    // Both sides start with one living combat unit; the match is not decided yet.
    const start = await page.evaluate(() => (window as { __debugUnitCount?: () => Units }).__debugUnitCount?.() ?? { player: 0, enemy: 0 });
    expect(start.player).toBe(1);
    expect(start.enemy).toBe(1);
    const v0 = await page.evaluate(() => (window as { __debugVictory?: () => Victory }).__debugVictory?.() ?? { over: false, winner: null });
    expect(v0.over).toBe(false);

    // Let the fight play out (rifle: 4 dmg/shot every 0.6s; enemy 12 HP → dies in ~1.8s).
    await page.waitForTimeout(4000);

    // The enemy is dead, the player survived, and VICTORY is recorded.
    const end = await page.evaluate(() => (window as { __debugUnitCount?: () => Units }).__debugUnitCount?.() ?? { player: -1, enemy: -1 });
    expect(end.enemy).toBe(0);
    expect(end.player).toBeGreaterThan(0);

    const v1 = await page.evaluate(() => (window as { __debugVictory?: () => Victory }).__debugVictory?.() ?? { over: false, winner: null });
    expect(v1.over).toBe(true);
    expect(v1.winner).toBe('player');

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 's4a-capture.png'), fullPage: true });
  });
});
