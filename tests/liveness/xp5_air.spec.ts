// ── XP-5 gate: a gunship flies straight over walls; storm telemetry live ────────
import { test, expect } from '@playwright/test';

const DEV_MISSION = {
  id: 'xp5_test', name: 'XP5 Test', order: 99,
  map: { width: 32, height: 32, seed: 42 },
  briefing: { title: 'XP5', story: [], objectives: ['test'] },
  naturalShardDensity: 300, fields: [],
  player: {
    credits: 3000, techTier: 2,
    buildings: [
      { type: 'construction_yard', tx: 6, ty: 16 },
      { type: 'refinery', tx: 8, ty: 16 },
      // A wall line the gunship must cross as the crow flies.
      { type: 'wall', tx: 12, ty: 14 }, { type: 'wall', tx: 12, ty: 15 }, { type: 'wall', tx: 12, ty: 16 },
      { type: 'wall', tx: 12, ty: 17 }, { type: 'wall', tx: 12, ty: 18 },
    ],
    units: [{ type: 'gunship', tx: 9, ty: 16 }, { type: 'harvester', tx: 9, ty: 17 }],
  },
  enemies: [{ team: 'enemy', credits: 0, buildings: [{ type: 'barracks', tx: 28, ty: 4 }], units: [], fields: [] }],
  objectives: [{ type: 'eliminate', team: 'enemy', primary: true, text: 'test' }],
  failure: [{ type: 'defeated', team: 'player' }],
  next: null,
};

test.describe('XP-5 air gate', () => {
  test('the gunship crosses the wall line in a straight flight', async ({ page }) => {
    test.setTimeout(60_000);
    await page.addInitScript((m) => localStorage.setItem('shardDominion.devMission', m), JSON.stringify(DEV_MISSION));
    await page.goto('/?mission=__dev__');
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(300);
    const box = (await page.locator('#game-canvas').boundingBox())!;
    const field = await page.evaluate(() =>
      (window as { __debugBattlefieldRect?: () => { x: number; y: number; w: number; h: number } }).__debugBattlefieldRect?.()
      ?? { x: 0, y: 40, w: 600, h: 560 });

    // Storm hook exists and is a boolean.
    const storm = await page.evaluate(() => (window as { __debugStorm?: () => boolean }).__debugStorm?.());
    expect(typeof storm).toBe('boolean');

    // Select the gunship explicitly and order it east across the wall, staying
    // inside the playable battlefield (never the command sidebar).
    const gs = await page.evaluate(() =>
      (window as { __debugUnitScreenPos?: (k: string) => { x: number; y: number } | null }).__debugUnitScreenPos?.('gunship') ?? null);
    expect(gs).not.toBeNull();
    await page.mouse.click(box.x + gs!.x, box.y + gs!.y);
    await page.waitForTimeout(150);
    const destX = Math.min(gs!.x + 280, field.x + field.w - 24);
    const destY = Math.max(field.y + 16, Math.min(field.y + field.h - 16, gs!.y));
    await page.mouse.click(box.x + destX, box.y + destY, { button: 'right' });

    // The flyer's screen X advances well past the wall line within seconds.
    await expect.poll(async () => {
      const p = await page.evaluate(() =>
        (window as { __debugUnitScreenPos?: (k: string) => { x: number; y: number } | null }).__debugUnitScreenPos?.('gunship') ?? null);
      return p?.x ?? -1;
    }, { timeout: 20_000, intervals: [400] }).toBeGreaterThan(gs!.x + 160);
  });
});
