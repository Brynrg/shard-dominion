// ── Refinements gate: the TECH tab exposes the researchable upgrades (economy) ──
import { test, expect } from '@playwright/test';

test.describe('TECH tab (Refinements) gate', () => {
  test('the TECH tab opens and renders the four researchable Refinement buttons', async ({ page }) => {
    await page.goto('/?mission=skirmish');
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } }); // take command
    await page.waitForTimeout(400);
    const canvas = page.locator('#game-canvas');
    const box = (await canvas.boundingBox())!;
    const rectOf = (a: string) => page.evaluate((x) => (window as { __debugButtonRect?: (s: string) => { x: number; y: number; w: number; h: number } | null }).__debugButtonRect?.(x) ?? null, a);

    // Switch to the TECH tab via its live rect.
    const techTab = await rectOf('tab:tech');
    expect(techTab).not.toBeNull();
    await page.mouse.click(box.x + techTab!.x + techTab!.w / 2, box.y + techTab!.y + techTab!.h / 2);
    await page.waitForTimeout(120);

    // All four Refinement buttons now render and are hit-testable.
    for (const id of ['deep_extraction', 'munitions_doctrine', 'composite_plating', 'resonance_dampers']) {
      const r = await rectOf(`research:${id}`);
      expect(r, `research:${id} button should render on the TECH tab`).not.toBeNull();
    }
  });
});
