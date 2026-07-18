// ── PLAYTEST (not a gate): drive a human-like skirmish session and LOG friction.
// Run explicitly: npx playwright test tests/liveness/_playtest.spec.ts
// Asserts almost nothing — its output is the observations log + screenshots in
// the scratchpad. Benchmarked against WC3 / C&C Red Alert smoothness.
import { test } from '@playwright/test';

const SHOTS = process.env.PLAYTEST_SHOTS ??
  '/private/tmp/claude-501/-Users-jonathangarnett-Code-games-shard-dominion/c3b6deff-7de9-41f4-92c8-77a138577947/scratchpad/playtest';

test.describe('playtest session', () => {
  test.skip(!process.env.PLAYTEST, 'observation harness — run with PLAYTEST=1, not part of the gate suite');
  test('full skirmish via title menu', async ({ page }) => {
    test.setTimeout(600000);
    const log = (m: string) => console.log(`[PT ${(Date.now() - t0).toString().padStart(6)}ms] ${m}`);
    const t0 = Date.now();
    const shot = (name: string) => page.screenshot({ path: `${SHOTS}/${name}.png` });

    const sel = () => page.evaluate(() => (window as any).__debugSelection?.() ?? -1);
    const eva = () => page.evaluate(() => (window as any).__debugEva?.()?.last ?? '');
    const eco = () => page.evaluate(() => (window as any).__debugEconomy?.() ?? null);
    const match = () => page.evaluate(() => (window as any).__debugMatch?.() ?? null);
    const bcount = () => page.evaluate(() => (window as any).__debugBuildingCount?.() ?? null);
    const upos = (k: string) => page.evaluate((kk) => (window as any).__debugUnitScreenPos?.(kk) ?? null, k);
    const camera = () => page.evaluate(() => (window as any).__debugCamera?.() ?? null);

    // ── 1. Title menu → SKIRMISH → START (the flow gates never test) ──
    await page.goto('/');
    await page.waitForSelector('#game-canvas', { timeout: 15000 });
    await shot('01-title');
    await page.getByRole('button', { name: 'SKIRMISH' }).click();
    await shot('02-skirmish-setup');
    await page.getByRole('button', { name: 'START' }).click();
    await page.waitForTimeout(800);
    await shot('03-briefing');
    await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(500);
    log(`menu-flow boot: match=${JSON.stringify(await match())} eco=${JSON.stringify(await eco())}`);
    await shot('04-ingame');

    // Enemy must exist via the MENU flow (buildings incl. enemy base).
    const enemyAlive = await page.evaluate(() => {
      const m = (window as any).__debugMatch?.();
      return m ? { units: m.enemyUnits, credits: m.enemyCredits } : null;
    });
    log(`enemy at boot: ${JSON.stringify(enemyAlive)}`);

    // ── 2. Box-select the troopers, long move — pathfinding feel ──
    const p0 = (await upos('infantry'))!;
    await page.mouse.move(0, 0);
    const box = (await page.locator('#game-canvas').boundingBox())!;
    await page.mouse.move(box.x + p0.x - 50, box.y + p0.y - 40);
    await page.mouse.down();
    await page.mouse.move(box.x + p0.x + 70, box.y + p0.y + 50, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(250);
    log(`box-select troopers: sel=${await sel()} (want 2)`);

    await page.mouse.click(box.x + p0.x + 150, box.y + p0.y - 150, { button: 'right' });
    const samples: number[] = [];
    let last = p0;
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(300);
      const p = (await upos('infantry'))!;
      samples.push(Math.round(Math.hypot(p.x - last.x, p.y - last.y)));
      last = p;
    }
    log(`move samples (px/300ms): ${samples.join(',')} — stalls=${samples.filter(s => s === 0).length}`);
    await shot('05-after-move');

    // ── 3. Build a Barracks near base; time it; EVA construction-complete ──
    const cy = (await page.evaluate(() => (window as any).__debugConYardScreenPos?.() ?? null))!;
    await page.keyboard.press('b');
    await page.mouse.click(box.x + cy.x - 60, box.y + cy.y + 50);
    const tBuild = Date.now();
    await page.waitForTimeout(300);
    log(`barracks placed: buildings=${JSON.stringify(await bcount())} eco=${JSON.stringify(await eco())}`);
    // wait for construction complete (EVA line or building operational) max 60s
    let builtAt = -1;
    for (let i = 0; i < 120; i++) {
      await page.waitForTimeout(500);
      if ((await eva()).includes('Construction complete')) { builtAt = Date.now() - tBuild; break; }
    }
    log(`barracks construction-complete after ${builtAt}ms (EVA='${await eva()}')`);
    await shot('06-barracks-built');

    // ── 4. Train 4 infantry; time per unit; EVA unit-ready ──
    for (let i = 0; i < 4; i++) await page.keyboard.press('t');
    const tTrain = Date.now();
    log(`queued 4 infantry: eco=${JSON.stringify(await eco())}`);
    let lastArmy = (await match())!.playerUnits;
    const unitTimes: number[] = [];
    for (let i = 0; i < 240 && unitTimes.length < 4; i++) {
      await page.waitForTimeout(500);
      const m = (await match())!;
      if (m.playerUnits > lastArmy) { unitTimes.push(Date.now() - tTrain); lastArmy = m.playerUnits; }
    }
    log(`unit-ready times: ${unitTimes.map(t => Math.round(t / 1000) + 's').join(', ')} (EVA='${await eva()}')`);
    await shot('07-army');

    // ── 5. Group + double-tap centre ──
    await page.keyboard.press('q');
    await page.waitForTimeout(250);
    log(`Q army: sel=${await sel()}`);
    await page.keyboard.press('Control+1');
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight');
    const camFar = (await camera())!;
    await page.keyboard.press('1');
    await page.waitForTimeout(120);
    await page.keyboard.press('1');
    await page.waitForTimeout(200);
    const camBack = (await camera())!;
    log(`double-tap centre: cam moved ${Math.round(Math.abs(camBack.x - camFar.x))} world-units back`);

    // ── 6. Attack-move the army NE toward the enemy; observe engagement ──
    await page.keyboard.press('a');
    await page.mouse.click(box.x + 700, box.y + 80);
    log('attack-move launched toward enemy base');
    // sample battle state every 2s for 90s: army counts + EVA lines
    let lastEva = '';
    for (let i = 0; i < 45; i++) {
      await page.waitForTimeout(2000);
      const m = (await match())!;
      const e = await eva();
      if (e !== lastEva) { log(`EVA: '${e}' (units P${m.playerUnits}/E${m.enemyUnits})`); lastEva = e; }
      if (i % 10 === 9) { log(`battle: P${m.playerUnits} vs E${m.enemyUnits}, eco=${JSON.stringify(await eco())}`); await shot(`08-battle-${i}`); }
    }
    await shot('09-late');

    // ── 7. Idle-harvester no-op check + sell a wall ──
    await page.keyboard.press('q'); await page.waitForTimeout(150);
    const selBefore = await sel();
    await page.keyboard.press('i'); await page.waitForTimeout(250);
    log(`I with no idle harvester: sel ${selBefore} -> ${await sel()} (no-op wanted)`);

    const m2 = (await match())!;
    log(`final state: P${m2.playerUnits} vs E${m2.enemyUnits}, eco=${JSON.stringify(await eco())}, buildings=${JSON.stringify(await bcount())}`);
    await shot('10-final');
  });
});
