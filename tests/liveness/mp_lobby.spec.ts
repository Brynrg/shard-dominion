// ── v0.54 MP lobby gate: title → MULTIPLAYER → lobby → waiting room ────────────
import { test, expect } from '@playwright/test';

test.describe('MP lobby gate', () => {
  test('lobby offers relay/room/invite; entering an unreachable room shows honest status, not a dead screen', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#game-canvas', { timeout: 15000 });

    await page.getByRole('button', { name: 'MULTIPLAYER' }).click();
    // Lobby: relay prefilled, a room code generated, live invite link present.
    const relay = page.locator('input').first();
    await expect(relay).toHaveValue(/^ws:\/\//);
    await expect(page.getByText('INVITE (send to the other player):')).toContainText('mp=1');

    // Use a definitely-unreachable relay port; the waiting room must surface the
    // failure as readable status with a way back — never a blocking alert.
    await relay.fill('ws://localhost:59999');
    await page.getByRole('button', { name: 'ENTER ROOM' }).click();
    await expect(page.locator('#sd-mp-wait')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#sd-mp-status')).toContainText('Relay unreachable', { timeout: 10000 });
    await expect(page.getByRole('button', { name: 'BACK TO MENU' })).toBeVisible();
  });
});
