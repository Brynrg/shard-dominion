// ── XP-1 gate: HQ tiers + radar-gated minimap, driven through the dev-mission kit ──
// The custom scenario boots via '?mission=__dev__' + localStorage — proving the
// mission kit's load path AND giving the gate a rich, fast test bed.
import { test, expect } from '@playwright/test';

const DEV_MISSION = {
  id: 'xp1_test', name: 'XP1 Test', order: 99,
  map: { width: 32, height: 32, seed: 42 },
  briefing: { title: 'XP1', story: [], objectives: ['test'] },
  naturalShardDensity: 300,
  fields: [],
  player: {
    credits: 5000,
    buildings: [
      { type: 'construction_yard', tx: 14, ty: 16 },
      { type: 'refinery', tx: 16, ty: 16 },
      { type: 'power_node', tx: 13, ty: 14 },
    ],
    units: [{ type: 'infantry', tx: 13, ty: 18 }],
  },
  enemies: [{ team: 'enemy', credits: 0, buildings: [{ type: 'barracks', tx: 27, ty: 9 }], units: [], fields: [] }],
  objectives: [{ type: 'eliminate', team: 'enemy', primary: true, text: 'wipe them' }],
  failure: [{ type: 'defeated', team: 'player' }],
  next: null,
};

test.describe('XP-1 foundations gate', () => {
  test('tiers gate the sidebar, HQ upgrades to T2, radar lights the minimap', async ({ page }) => {
    test.setTimeout(120_000);
    await page.addInitScript((m) => localStorage.setItem('shardDominion.devMission', m), JSON.stringify(DEV_MISSION));
    await page.goto('/?mission=__dev__');
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } }); // take command
    await page.waitForTimeout(300);
    const box = (await page.locator('#game-canvas').boundingBox())!;
    const rect = (a: string) => page.evaluate((x) => (window as { __debugButtonRect?: (s: string) => { x: number; y: number; w: number; h: number } | null }).__debugButtonRect?.(x) ?? null, a);
    const clickAction = async (a: string) => {
      const r = await rect(a);
      if (!r) throw new Error(`no rect for ${a}`);
      await page.mouse.click(box.x + r.x + r.w / 2, box.y + r.y + r.h / 2);
      await page.waitForTimeout(80);
    };
    const tier = () => page.evaluate(() => (window as { __debugTier?: () => { player: number } }).__debugTier?.().player ?? -1);
    const cam = () => page.evaluate(() => (window as { __debugCamera?: () => { x: number; y: number } }).__debugCamera?.() ?? { x: 0, y: 0 });

    // Start: T1; minimap is DARK (no radar) → clicking it does NOT jump the camera.
    expect(await tier()).toBe(1);
    const cam0 = await cam();
    await page.mouse.click(box.x + 40, box.y + 560); // inside the minimap area
    await page.waitForTimeout(150);
    const cam1 = await cam();
    expect(Math.abs(cam1.x - cam0.x) + Math.abs(cam1.y - cam0.y)).toBeLessThan(5);

    // Upgrade the HQ (5000cr covers it) at 2× speed → T2 within ~15s wall.
    await page.keyboard.press('=');
    await page.keyboard.press('=');
    await clickAction('upgrade:hq');
    await expect.poll(tier, { timeout: 30_000, intervals: [500] }).toBe(2);

    // Build the radar (T2, now clickable) next to the ConYard.
    await clickAction('build:radar');
    const cy = await page.evaluate(() => (window as { __debugConYardScreenPos?: () => { x: number; y: number } | null }).__debugConYardScreenPos?.() ?? null);
    expect(cy).not.toBeNull();
    await page.mouse.click(box.x + cy!.x, box.y + cy!.y - 64);
    await page.waitForTimeout(400);

    // Minimap is LIVE: clicking its far corner now jumps the camera.
    await expect.poll(async () => {
      const before = await cam();
      await page.mouse.click(box.x + 150, box.y + 470); // minimap NE-ish
      await page.waitForTimeout(150);
      const after = await cam();
      return Math.abs(after.x - before.x) + Math.abs(after.y - before.y);
    }, { timeout: 10_000, intervals: [300] }).toBeGreaterThan(50);
  });
});
