import { test, expect } from '@playwright/test';
import type { SpriteBank } from '../../src/view/spritebank.js';

test('rendered unit animation freezes during pause and resumes without a time jump', async ({ page }, testInfo) => {
  await page.goto('/?mission=skirmish');
  await page.waitForFunction(() => !!window.__debugSprites);
  await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } });
  await page.evaluate(() => {
    const bank = window.__debugSprites as SpriteBank;
    const original = bank.drawUnit;
    const record = window as unknown as { animationFrames: number[] };
    record.animationFrames = [];
    bank.drawUnit = (...args) => {
      if (args[1] === 'harvester') {
        record.animationFrames.push(args[7]);
        if (record.animationFrames.length > 120) record.animationFrames.shift();
      }
      original(...args);
    };
  });
  const latest = () => page.evaluate(() => (window as unknown as { animationFrames: number[] }).animationFrames.at(-1));
  await expect.poll(latest).toBeGreaterThan(0);
  await page.locator('#game-canvas').press('p');
  await expect.poll(() => page.evaluate(() => window.__debugTimeScale?.())).toBe(0);
  await page.waitForTimeout(100);
  const frozen = await latest();
  await page.waitForTimeout(400);
  expect(await latest()).toBe(frozen);
  await page.screenshot({ path: testInfo.outputPath('animation-paused.png') });
  await page.getByRole('button', { name: /RESUME/ }).click();
  await expect.poll(latest).toBeGreaterThan(frozen!);
  expect((await latest())! - frozen!).toBeLessThan(20);
  await page.screenshot({ path: testInfo.outputPath('animation-running.png') });
});

test('reduced motion disables presentation entrances', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.sd-title-panel')).toHaveCSS('animation-name', 'none');
  await expect(page.getByRole('button', { name: /CAMPAIGN/ })).toBeVisible();
});

test('delivered firing artwork changes frames and settles back to idle', async ({ page }, testInfo) => {
  await page.goto('/?mission=skirmish');
  const manifest = await (await page.request.get('/art/manifest.json')).json() as { sheets: string[] };
  await expect.poll(() => page.evaluate(() => (window.__debugSprites as SpriteBank | undefined)?.loadedSheetCount()), { timeout: 15000 }).toBe(manifest.sheets.length);
  const poses = await page.evaluate(() => {
    const bank = window.__debugSprites as SpriteBank;
    bank.setFactionIds({ player: 'player' }); // exercise the delivered two-frame fire strip
    return [0, 12, 24, -1].map(frame => {
      const canvas = document.createElement('canvas');
      canvas.width = 120; canvas.height = 120;
      const ctx = canvas.getContext('2d')!;
      bank.drawUnit(ctx, 'assault_tank', 'player', undefined, 0, 60, 60, Math.max(0, frame), 1.5, frame < 0 ? 'idle' : 'firing');
      return canvas.toDataURL();
    });
  });
  expect(poses[0]).not.toBe(poses[1]);
  expect(poses[1]).not.toBe(poses[2]);
  expect(poses[2]).toBe(poses[3]);
  for (let i = 0; i < 3; i++) {
    await testInfo.attach('firing-pose-' + i, { body: Buffer.from(poses[i]!.split(',')[1]!, 'base64'), contentType: 'image/png' });
  }
});
