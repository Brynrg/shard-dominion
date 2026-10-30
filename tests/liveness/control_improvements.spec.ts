import { test, expect, type Page } from '@playwright/test';

async function boot(page: Page) {
  await page.goto('/?mission=skirmish');
  await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } });
  await expect.poll(() => page.evaluate(() => window.__debugBriefing?.())).toBe(false);
}
async function action(page: Page, name: string) {
  const r = await page.evaluate(a => window.__debugButtonRect?.(a), name);
  expect(r).toBeTruthy();
  const box = (await page.locator('#game-canvas').boundingBox())!;
  await page.mouse.click(box.x + r!.x + r!.w / 2, box.y + r!.y + r!.h / 2);
}
const selected = (page: Page) => page.evaluate(() => window.__debugSelection?.());

test('menu paging reaches later structures and returns, without dropping squad selection', async ({ page }, info) => {
  await boot(page);
  await action(page, 'command:army');
  await expect.poll(() => selected(page)).toBe(2);
  const initial = await page.evaluate(() => window.__debugButtonRect?.('build:barracks'));
  expect(initial).toBeTruthy();
  await action(page, 'page:base:next');
  await expect.poll(() => page.evaluate(() => window.__debugButtonRect?.('build:barracks'))).toBeNull();
  await action(page, 'page:base:prev');
  await expect.poll(() => page.evaluate(() => window.__debugButtonRect?.('build:barracks'))).toBeTruthy();
  expect(await selected(page)).toBe(2);
  await page.screenshot({ path: info.outputPath('commands-and-pager.png') });
});

test('Shift-click edits selection; sidebar and paused hotkeys cannot issue orders', async ({ page }, info) => {
  await boot(page);
  await page.keyboard.press('q');
  await expect.poll(() => selected(page)).toBe(2);
  const unit = await page.evaluate(() => window.__debugSelectedUnits?.()[0]);
  const box = (await page.locator('#game-canvas').boundingBox())!;
  await page.keyboard.down('Shift');
  await page.mouse.click(box.x + unit!.x, box.y + unit!.y);
  await page.keyboard.up('Shift');
  await expect.poll(() => selected(page)).toBe(1);
  await page.keyboard.down('Shift');
  await page.mouse.click(box.x + unit!.x, box.y + unit!.y);
  await page.keyboard.up('Shift');
  await expect.poll(() => selected(page)).toBe(2);
  await page.mouse.click(box.x + 790, box.y + 590, { button: 'right' });
  expect((await page.evaluate(() => window.__debugSelectedUnits?.()))!.every(u => !u.hasTarget)).toBe(true);
  await page.keyboard.press('p');
  await page.keyboard.press('b');
  await page.keyboard.press('a');
  await page.keyboard.press('q');
  await page.keyboard.press('p');
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__debugStructureJob?.())).toBeNull();
  expect(await page.locator('#game-canvas').evaluate(e => (e as HTMLCanvasElement).style.cursor)).not.toBe('crosshair');
  await page.screenshot({ path: info.outputPath('selection-preserved.png') });
});

test('attack button arms a clear mode, right-click cancels, and stop clears a issued move', async ({ page }, info) => {
  await boot(page);
  await action(page, 'command:army');
  await expect.poll(() => selected(page)).toBe(2);
  await action(page, 'command:attack');
  const box = (await page.locator('#game-canvas').boundingBox())!;
  await page.mouse.move(box.x + 350, box.y + 300);
  await expect(page.locator('#game-canvas')).toHaveCSS('cursor', 'crosshair');
  await page.screenshot({ path: info.outputPath('attack-mode.png') });
  await page.mouse.click(box.x + 350, box.y + 300, { button: 'right' });
  await expect(page.locator('#game-canvas')).not.toHaveCSS('cursor', 'crosshair');
  expect((await page.evaluate(() => window.__debugSelectedUnits?.()))!.every(u => !u.hasTarget)).toBe(true);
  await page.mouse.click(box.x + 350, box.y + 300, { button: 'right' });
  await expect.poll(() => page.evaluate(() => window.__debugSelectedUnits?.().some(u => u.hasTarget))).toBe(true);
  await page.screenshot({ path: info.outputPath('order-routes.png') });
  await action(page, 'command:stop');
  await expect.poll(() => page.evaluate(() => window.__debugSelectedUnits?.().some(u => u.hasTarget))).toBe(false);
});

test('Home centres base in playable space; pause guide and held pause key are safe', async ({ page }, info) => {
  await boot(page);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Home');
  await expect.poll(async () => {
    return page.evaluate(() => {
      const p = window.__debugConYardScreenPos?.(), r = window.__debugBattlefieldRect?.();
      return p && r ? Math.abs(p.x - (r.x + r.w / 2)) : 999;
    });
  }).toBeLessThan(2);
  await page.keyboard.down('p');
  await page.keyboard.down('p'); // repeat must not immediately resume
  await page.keyboard.up('p');
  await expect(page.locator('.sd-pause')).toBeVisible();
  await page.getByText('CONTROLS & TACTICS', { exact: true }).click();
  await expect(page.getByText('Shift-click toggles a unit', { exact: false })).toBeVisible();
  await page.screenshot({ path: info.outputPath('controls-guide.png') });
  await page.getByRole('button', { name: /RESUME/ }).click();
  await page.keyboard.press('q');
  await expect.poll(() => selected(page)).toBe(2); // keyboard focus restored
});

test('footer command buttons are not overlapped by the sell/repair/strike rect', async ({ page }) => {
  // Regression: at ROWS_PER_PAGE = 9 the STRUCT tab's HQ-tier row + 9 build rows
  // + the pager pushed the flow cursor into the fixed footer band. The
  // sell/repair/strike rect is pushed BEFORE the command buttons, and buttonAt
  // returns the first match, so clicking ARMY demolished the selected building.
  await boot(page);
  const conyard = await page.evaluate(() => window.__debugConYardScreenPos?.());
  expect(conyard).toBeTruthy();
  const box = (await page.locator('#game-canvas').boundingBox())!;
  await page.mouse.click(box.x + conyard!.x, box.y + conyard!.y);
  // Selecting our own Construction Yard is what pushes `sell:selected`.
  await expect.poll(() => page.evaluate(() => window.__debugButtonRect?.('sell:selected'))).toBeTruthy();

  expect(await page.evaluate(() => window.__debugRectOverlaps?.())).toEqual([]);

  const before = (await page.evaluate(() => window.__debugBuildingCount?.()))!.conyard;
  await action(page, 'command:army');
  await expect.poll(() => selected(page)).toBeGreaterThan(0);
  expect((await page.evaluate(() => window.__debugBuildingCount?.()))!.conyard).toBe(before);
});
