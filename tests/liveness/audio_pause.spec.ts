// ── FG-1 gate: audio engine runs + pause freezes the sim ────────────────────────
// Audio is procedural WebAudio (view-only). The take-command click resumes the
// context; a HUD click must register a played voice. P toggles pause: the sim tick
// freezes (render continues) and the PAUSED overlay shows; P again resumes.
import { test, expect } from '@playwright/test';

test.describe('Audio + pause gate', () => {
  test('audio context runs and plays a UI voice; P pauses and resumes the sim', async ({ page }) => {
    await page.goto('/?mission=skirmish');
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    const box = (await page.locator('#game-canvas').boundingBox())!;
    // XP-1 tabs: click sidebar buttons via their LIVE rects (canvas px == CSS px at
    // the gate viewport), switching tabs first when the item lives on UNITS.
    const clickAction = async (action: string) => {
      const r = await page.evaluate((a) => (window as { __debugButtonRect?: (x: string) => { x: number; y: number; w: number; h: number } | null }).__debugButtonRect?.(a) ?? null, action);
      if (!r) throw new Error(`no rect for ${action}`);
      await page.mouse.click(box.x + r.x + r.w / 2, box.y + r.y + r.h / 2);
      await page.waitForTimeout(80);
    };


    // Take command — this user gesture resumes the AudioContext + starts music.
    await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } });
    await expect.poll(
      () => page.evaluate(() => (window as { __debugAudio?: () => { state: string } }).__debugAudio?.().state ?? 'none'),
      { timeout: 5000, intervals: [200] },
    ).toBe('running');

    // A HUD button click plays the UI voice → played count rises.
    await clickAction('build:barracks');
    const audio = await page.evaluate(() => (window as { __debugAudio?: () => { state: string; played: number } }).__debugAudio?.());
    expect(audio!.played).toBeGreaterThan(0);

    // ── Mute: M toggles live, without pausing (the sim keeps ticking). ──
    const muted = () => page.evaluate(() => (window as { __debugAudio?: () => { muted: boolean } }).__debugAudio?.().muted ?? null);
    const before = await muted();
    await page.keyboard.press('m');
    await expect.poll(muted, { timeout: 2000, intervals: [100] }).toBe(!before);
    const tickM1 = await page.evaluate(() => (window as { __debugTick?: () => number }).__debugTick?.() ?? -1);
    await page.waitForTimeout(500);
    const tickM2 = await page.evaluate(() => (window as { __debugTick?: () => number }).__debugTick?.() ?? -1);
    expect(tickM2).toBeGreaterThan(tickM1); // muting did NOT pause the game
    await page.keyboard.press('m'); // restore

    // ── Pause: P freezes the tick and shows the overlay. ──
    await page.keyboard.press('Escape'); // also cancels the placement mode we just entered
    await page.keyboard.press('p');
    // (Escape may have toggled pause if placement had already been cancelled — normalize:
    // poll the timescale and press p until paused.)
    await expect.poll(async () => {
      const ts = await page.evaluate(() => (window as { __debugTimeScale?: () => number }).__debugTimeScale?.() ?? -1);
      if (ts !== 0) await page.keyboard.press('p');
      return page.evaluate(() => (window as { __debugTimeScale?: () => number }).__debugTimeScale?.() ?? -1);
    }, { timeout: 4000, intervals: [250] }).toBe(0);
    await expect(page.locator('.sd-pause')).toContainText('PAUSED');

    const tick1 = await page.evaluate(() => (window as { __debugTick?: () => number }).__debugTick?.() ?? -1);
    await page.waitForTimeout(900);
    const tick2 = await page.evaluate(() => (window as { __debugTick?: () => number }).__debugTick?.() ?? -1);
    expect(tick2).toBe(tick1); // sim frozen while paused

    // Resume via P → overlay gone, tick advances.
    await page.keyboard.press('p');
    await expect(page.locator('.sd-pause')).toHaveCount(0);
    await expect.poll(
      () => page.evaluate(() => (window as { __debugTick?: () => number }).__debugTick?.() ?? -1),
      { timeout: 4000, intervals: [200] },
    ).toBeGreaterThan(tick2);
  });
});
