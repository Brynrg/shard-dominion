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

    // Storm hook exists and is a boolean.
    const storm = await page.evaluate(() => (window as { __debugStorm?: () => boolean }).__debugStorm?.());
    expect(typeof storm).toBe('boolean');

    // Select the gunship (3 tiles E of conyard) and order it far east across the wall.
    const cy = await page.evaluate(() => (window as { __debugConYardScreenPos?: () => { x: number; y: number } | null }).__debugConYardScreenPos?.() ?? null);
    expect(cy).not.toBeNull();
    await page.mouse.click(box.x + cy!.x + 96, box.y + cy!.y); // gunship (hitbox = sim position)
    await page.waitForTimeout(150);
    await page.mouse.click(box.x + cy!.x + 400, box.y + cy!.y, { button: 'right' }); // order east

    // The flyer's screen X advances well past the wall line (~+192px) within seconds.
    // (The harvester also has movement — the debug hook returns the FIRST mover, which
    // is the gunship by creation order in this mission.)
    await expect.poll(async () => {
      const p = await page.evaluate(() => (window as { __debugHarvesterScreenPos?: () => { x: number; y: number } | null }).__debugHarvesterScreenPos?.() ?? null);
      return p?.x ?? -1;
    }, { timeout: 20_000, intervals: [400] }).toBeGreaterThan(cy!.x + 200);
  });
});
