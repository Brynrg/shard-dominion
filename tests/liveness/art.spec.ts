import { test, expect } from '@playwright/test';

test('presentation art decodes and title remains usable at desktop and narrow sizes', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SHARD DOMINION' })).toBeVisible();
  const assets = ['title_backdrop', 'credits_backdrop', 'act1_card', 'act2_card', 'act3_card', 'act4_card',
    'portrait_corr', 'portrait_warden', 'portrait_vane', 'portrait_halex', 'portrait_yssel', 'portrait_chorus'];
  const decoded = await page.evaluate(async names => {
    const result: string[] = [];
    for (const name of names) {
      const img = new Image();
      img.src = `art/presentation/${name}.png`;
      await img.decode();
      if (img.naturalWidth >= 512 && img.naturalHeight >= 512) result.push(name);
    }
    return result;
  }, assets);
  expect(decoded).toEqual(assets);
  for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const title = await page.getByRole('heading', { name: 'SHARD DOMINION' }).boundingBox();
    const campaign = await page.getByRole('button', { name: /CAMPAIGN/ }).boundingBox();
    expect(title).not.toBeNull();
    expect(campaign).not.toBeNull();
    expect(title!.x + title!.width).toBeLessThanOrEqual(viewport.width);
    expect(campaign!.y + campaign!.height).toBeLessThan(viewport.height);
    await page.screenshot({ path: testInfo.outputPath(`title-${viewport.width}.png`) });
  }
  await page.getByRole('button', { name: /CAMPAIGN/ }).click();
  await expect(page.getByRole('button', { name: 'Mission 1: First Light', exact: true })).toBeVisible();
  await expect(page.locator('.sd-act-card')).toHaveCount(4);
  await page.screenshot({ path: testInfo.outputPath('campaign.png') });
  expect(errors).toEqual([]);
});

test('world labels cannot shift HUD text outside the command panel', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text, x, y, maxWidth) {
      if (text === 'COMMAND') {
        (window as unknown as { commandLabel: { alignment: string; x: number } }).commandLabel = {
          alignment: this.textAlign, x,
        };
      }
      if (maxWidth === undefined) fillText.call(this, text, x, y);
      else fillText.call(this, text, x, y, maxWidth);
    };
  });
  await page.goto('/?mission=skirmish');
  const manifest = await (await page.request.get('/art/manifest.json')).json() as { sheets: string[] };
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as { __debugSprites?: { loadedSheetCount(): number } }).__debugSprites?.loadedSheetCount(),
  ), { timeout: 15000 }).toBe(manifest.sheets.length);
  await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } });
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as { commandLabel?: { alignment: string; x: number } }).commandLabel,
  )).toEqual({ alignment: 'left', x: 618 });
  await page.screenshot({ path: testInfo.outputPath('battlefield.png') });
});
