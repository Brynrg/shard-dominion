// ── Campaign gate (CP-1): title menu → Mission 1 → objective → debrief ──────────
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, '../../screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

test.describe('Campaign gate', () => {
  test('title menu launches Mission 1, its objective is wired, and a win shows the debrief', async ({ page }) => {
    // With no mission param, the title menu appears.
    await page.goto('/');
    await expect(page.locator('.sd-overlay')).toContainText('SHARD DOMINION');
    const campaign = page.getByRole('button', { name: /CAMPAIGN/ });
    await expect(campaign).toBeVisible();

    // Launch the campaign → Mission 1 "First Light" boots.
    await campaign.click();
    await page.waitForURL(/mission=m1_first_light/);
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    await page.waitForTimeout(300);

    // Take command (dismiss the briefing).
    await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(200);

    // Mission 1's objective is wired: destroy the Emberhand watch-post.
    const objs = await page.evaluate(() => (window as { __debugObjectives?: () => { text: string }[] }).__debugObjectives?.() ?? []);
    expect(objs.some(o => /watch-post/i.test(o.text))).toBe(true);

    // Force a win → the debrief screen appears (VICTORY + Main Menu; M2 isn't shipped so no Next).
    await page.evaluate(() => (window as { __debugForceEnd?: (w: 'player' | 'enemy') => void }).__debugForceEnd?.('player'));
    await expect(page.locator('.sd-overlay')).toContainText('VICTORY', { timeout: 5000 });
    await expect(page.getByRole('button', { name: /MAIN MENU/ })).toBeVisible();

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'campaign-m1.png'), fullPage: true });
  });
});
