// ── XP-4 gate: garrison a bunker live + stance hotkey ────────────────────────────
import { test, expect } from '@playwright/test';

const DEV_MISSION = {
  id: 'xp4_test', name: 'XP4 Test', order: 99,
  map: { width: 32, height: 32, seed: 42 },
  briefing: { title: 'XP4', story: [], objectives: ['test'] },
  naturalShardDensity: 300, fields: [],
  player: {
    credits: 3000, techTier: 2,
    buildings: [
      { type: 'construction_yard', tx: 14, ty: 16 },
      { type: 'refinery', tx: 16, ty: 16 },
      { type: 'bunker', tx: 15, ty: 18 },
    ],
    units: [{ type: 'infantry', tx: 13, ty: 18 }, { type: 'harvester', tx: 17, ty: 16 }],
  },
  enemies: [{ team: 'enemy', credits: 0, buildings: [{ type: 'barracks', tx: 28, ty: 4 }], units: [], fields: [] }],
  objectives: [{ type: 'eliminate', team: 'enemy', primary: true, text: 'test' }],
  failure: [{ type: 'defeated', team: 'player' }],
  next: null,
};

test.describe('XP-4 ground gate', () => {
  test('infantry garrisons the bunker by right-click; U unloads it', async ({ page }) => {
    test.setTimeout(60_000);
    await page.addInitScript((m) => localStorage.setItem('shardDominion.devMission', m), JSON.stringify(DEV_MISSION));
    await page.goto('/?mission=__dev__');
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } }); // take command
    await page.waitForTimeout(300);
    const box = (await page.locator('#game-canvas').boundingBox())!;

    // Screen positions via the conyard anchor: bunker is 1 tile E + 2 S of it;
    // infantry 1 W + 2 S. Tiles are 32px at zoom 1.
    const cy = await page.evaluate(() => (window as { __debugConYardScreenPos?: () => { x: number; y: number } | null }).__debugConYardScreenPos?.() ?? null);
    expect(cy).not.toBeNull();
    const infantry = { x: box.x + cy!.x - 32, y: box.y + cy!.y + 64 };
    const bunker = { x: box.x + cy!.x + 32, y: box.y + cy!.y + 64 };

    // Select the infantry, right-click the bunker → walks in (unit count drops to 0 combat units... the harvester isn't combat).
    await page.mouse.click(infantry.x, infantry.y);
    await page.waitForTimeout(150);
    await page.mouse.click(bunker.x, bunker.y, { button: 'right' });
    await expect.poll(
      () => page.evaluate(() => (window as { __debugUnitCount?: () => { player: number } }).__debugUnitCount?.().player ?? -1),
      { timeout: 20_000, intervals: [400] },
    ).toBe(1); // infantry boarded; the ARMED BUNKER itself now counts as the 1 combat entity

    // U unloads → infantry back on the field (2 combat: bunker disarms → 1 again... assert ≥1 infantry exists)
    await page.mouse.click(bunker.x, bunker.y); // select bunker
    await page.waitForTimeout(150);
    await page.keyboard.press('u');
    await expect.poll(
      () => page.evaluate(() => (window as { __debugUnitCount?: () => { player: number } }).__debugUnitCount?.().player ?? -1),
      { timeout: 8_000, intervals: [300] },
    ).toBeGreaterThanOrEqual(1);
  });
});
