// ── PLAYTEST: human-style skirmish that MUST prove real movement and combat.
// Run: PLAYTEST=1 PLAYTEST_SHOTS=/tmp/shard-dominion-playtest pnpm exec playwright test tests/liveness/_playtest.spec.ts --workers=1 --retries=0
import { test, expect } from '@playwright/test';

const SHOTS = process.env.PLAYTEST_SHOTS ??
  '/tmp/shard-dominion-playtest';

type SelUnit = { x: number; y: number; wx: number; wy: number; kind: string; hp: number; hasTarget: boolean; attackMove: boolean };
type Cam = { x: number; y: number; zoom: number };
type Match = { enemyUnits: number; playerUnits: number; enemyCredits: number };
type Rect = { x: number; y: number; w: number; h: number };
type TeamHp = { player: number; enemy: number };
type Eco = { credits: number };
type Buildings = { mcv: number; conyard: number; power_node: number; barracks: number; refinery: number; defense_turret: number };

test.describe('playtest session', () => {
  test.skip(!process.env.PLAYTEST, 'observation harness — run with PLAYTEST=1, not part of the gate suite');
  test('full skirmish via title menu', async ({ page }) => {
    test.setTimeout(600000);
    const log = (m: string) => console.log(`[PT ${(Date.now() - t0).toString().padStart(6)}ms] ${m}`);
    const t0 = Date.now();
    const shot = (name: string) => page.screenshot({ path: `${SHOTS}/${name}.png` });

    const sel = () => page.evaluate(() => (window as { __debugSelection?: () => number }).__debugSelection?.() ?? -1);
    const eva = () => page.evaluate(() => (window as { __debugEva?: () => { last: string } }).__debugEva?.()?.last ?? '');
    const eco = () => page.evaluate(() => (window as { __debugEconomy?: () => Eco }).__debugEconomy?.() ?? null);
    const match = () => page.evaluate(() => (window as { __debugMatch?: () => Match }).__debugMatch?.() ?? null);
    const bcount = () => page.evaluate(() => (window as { __debugBuildingCount?: () => Buildings }).__debugBuildingCount?.() ?? null);
    const upos = (k: string) => page.evaluate((kk) => (window as { __debugUnitScreenPos?: (kind: string) => { x: number; y: number } | null }).__debugUnitScreenPos?.(kk) ?? null, k);
    const camera = () => page.evaluate(() => (window as { __debugCamera?: () => Cam }).__debugCamera?.() ?? null);
    const field = () => page.evaluate(() => (window as { __debugBattlefieldRect?: () => Rect }).__debugBattlefieldRect?.() ?? { x: 0, y: 40, w: 600, h: 560 });
    const selected = () => page.evaluate(() => (window as { __debugSelectedUnits?: () => SelUnit[] }).__debugSelectedUnits?.() ?? []);
    const enemyPos = () => page.evaluate(() => (window as { __debugEnemyCombatScreenPos?: () => { x: number; y: number; hp: number } | null }).__debugEnemyCombatScreenPos?.() ?? null);
    const teamHp = () => page.evaluate(() => (window as { __debugTeamHp?: () => TeamHp }).__debugTeamHp?.() ?? { player: 0, enemy: 0 });

    const clamp = (sx: number, sy: number, bf: Rect): { x: number; y: number } => {
      const pad = 28;
      return {
        x: Math.max(bf.x + pad, Math.min(bf.x + bf.w - pad, sx)),
        y: Math.max(bf.y + pad, Math.min(bf.y + bf.h - pad, sy)),
      };
    };

    // ── 1. Title menu → SKIRMISH → START ──
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

    const box = (await page.locator('#game-canvas').boundingBox())!;
    const clickCanvas = async (sx: number, sy: number, button: 'left' | 'right' = 'left') => {
      await page.mouse.click(box.x + sx, box.y + sy, { button });
    };

    const enemyAlive = await match();
    log(`enemy at boot: ${JSON.stringify(enemyAlive)}`);
    expect(enemyAlive, 'match hook must be live').not.toBeNull();

    // ── 2. Box-select the troopers, long move — pathfinding feel ──
    const p0 = (await upos('infantry'))!;
    expect(p0.x).toBeGreaterThan(0);
    const bf0 = await field();
    await page.mouse.move(0, 0);
    await page.mouse.move(box.x + p0.x - 50, box.y + p0.y - 40);
    await page.mouse.down();
    await page.mouse.move(box.x + p0.x + 70, box.y + p0.y + 50, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(250);
    log(`box-select troopers: sel=${await sel()} (want 2)`);
    expect(await sel()).toBeGreaterThanOrEqual(1);

    const moveDest = clamp(p0.x + 80, p0.y - 80, bf0);
    await clickCanvas(moveDest.x, moveDest.y, 'right');
    const samples: number[] = [];
    let last = p0;
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(300);
      const p = (await upos('infantry'))!;
      samples.push(Math.round(Math.hypot(p.x - last.x, p.y - last.y)));
      last = p;
    }
    log(`move samples (px/300ms): ${samples.join(',')} — stalls=${samples.filter(s => s === 0).length}`);
    expect(samples.reduce((a, b) => a + b, 0)).toBeGreaterThan(20);
    await shot('05-after-move');

    // ── 3. Build a Barracks near base ──
    const cy = (await page.evaluate(() => (window as { __debugConYardScreenPos?: () => { x: number; y: number } | null }).__debugConYardScreenPos?.() ?? null))!;
    const jobReady = () => page.evaluate(() => (window as { __debugStructureJob?: () => { ready: boolean } | null }).__debugStructureJob?.()?.ready ?? false);
    const tBuild = Date.now();
    await page.keyboard.press('b');
    await page.waitForTimeout(200);
    for (let i = 0; i < 60 && !(await jobReady()); i++) await page.waitForTimeout(500);
    await page.keyboard.press('b');
    const place = clamp(cy.x - 60, cy.y + 50, await field());
    await clickCanvas(place.x, place.y);
    await page.waitForTimeout(300);
    log(`barracks placed: buildings=${JSON.stringify(await bcount())} eco=${JSON.stringify(await eco())}`);
    let builtAt = -1;
    for (let i = 0; i < 120; i++) {
      await page.waitForTimeout(500);
      if ((await eva()).includes('Construction complete')) { builtAt = Date.now() - tBuild; break; }
    }
    log(`barracks construction-complete after ${builtAt}ms (EVA='${await eva()}')`);
    await shot('06-barracks-built');

    // ── 4. Train 4 infantry ──
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
    expect(await sel()).toBeGreaterThanOrEqual(2);
    await page.keyboard.press('Control+1');
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight');
    const camFar = (await camera())!;
    await page.keyboard.press('1');
    await page.waitForTimeout(120);
    await page.keyboard.press('1');
    await page.waitForTimeout(200);
    const camBack = (await camera())!;
    log(`double-tap centre: cam moved ${Math.round(Math.abs(camBack.x - camFar.x))} world-units back`);

    // ── 6. Attack-move toward a verified enemy on the battlefield ──
    await page.keyboard.press('q');
    await page.waitForTimeout(200);
    const beforeOrder = await selected();
    expect(beforeOrder.length).toBeGreaterThanOrEqual(2);
    const startCentroid = {
      wx: beforeOrder.reduce((s, u) => s + u.wx, 0) / beforeOrder.length,
      wy: beforeOrder.reduce((s, u) => s + u.wy, 0) / beforeOrder.length,
      hp: beforeOrder.reduce((s, u) => s + u.hp, 0),
    };
    const hpBefore = await teamHp();
    const matchBefore = (await match())!;
    await shot('08-before-order');

    // Pan until an enemy is inside the playable rect, or settle on the NE battlefield.
    let target = await enemyPos();
    for (let i = 0; i < 80; i++) {
      const bf = await field();
      if (target && target.x >= bf.x + 20 && target.x <= bf.x + bf.w - 20 &&
          target.y >= bf.y + 20 && target.y <= bf.y + bf.h - 20) break;
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(40);
      target = await enemyPos();
    }
    const bf = await field();
    const aim = target
      ? clamp(target.x, target.y, bf)
      : clamp(bf.x + bf.w - 40, bf.y + 40, bf);
    log(`attack-move aim canvas=(${Math.round(aim.x)},${Math.round(aim.y)}) enemy=${JSON.stringify(target)} field=${JSON.stringify(bf)}`);

    await page.keyboard.press('a');
    await clickCanvas(aim.x, aim.y);
    await page.waitForTimeout(400);

    const afterOrder = await selected();
    const accepted = afterOrder.filter(u => u.attackMove && u.hasTarget);
    log(`attack-move accepted by ${accepted.length}/${afterOrder.length} selected`);
    expect(accepted.length, 'attack-move must be accepted by selected combat units').toBeGreaterThanOrEqual(1);
    await shot('09-during-move');

    let moved = false;
    for (let i = 0; i < 20 && !moved; i++) {
      await page.waitForTimeout(400);
      const now = await selected();
      if (now.length === 0) break;
      const cx = now.reduce((s, u) => s + u.wx, 0) / now.length;
      const cy = now.reduce((s, u) => s + u.wy, 0) / now.length;
      const dist = Math.hypot(cx - startCentroid.wx, cy - startCentroid.wy);
      log(`army travel ${Math.round(dist)} world-units`);
      if (dist >= 256) moved = true; // at least one tile
    }
    expect(moved, 'selected army must travel a meaningful world distance').toBe(true);

    // Engagement: enemy HP falls, a unit dies, player HP falls while they respond,
    // or enemy combat count decreases. Fail if none of these happen.
    let engaged = false;
    let lastEva = '';
    for (let i = 0; i < 50 && !engaged; i++) {
      await page.waitForTimeout(2000);
      const m = (await match())!;
      const hp = await teamHp();
      const e = await eva();
      if (e !== lastEva) { log(`EVA: '${e}' (units P${m.playerUnits}/E${m.enemyUnits} hp P${Math.round(hp.player)}/E${Math.round(hp.enemy)})`); lastEva = e; }
      const enemyHpDrop = hp.enemy < hpBefore.enemy - 15;
      const enemyCountDrop = m.enemyUnits < matchBefore.enemyUnits;
      const playerHpDrop = hp.player < hpBefore.player - 5;
      const selNow = await selected();
      const responding = selNow.some(u => u.attackMove || u.hasTarget);
      if (enemyHpDrop || enemyCountDrop || (playerHpDrop && responding)) {
        engaged = true;
        log(`engagement: enemyHpDrop=${enemyHpDrop} enemyCountDrop=${enemyCountDrop} playerHpDrop=${playerHpDrop}`);
        await shot('10-contact');
      }
      if (i === 8) await shot('10-mid-march');
      if (i % 10 === 9) log(`battle: P${m.playerUnits} vs E${m.enemyUnits}, hp=${JSON.stringify(hp)}`);
    }
    expect(engaged, 'playtest must observe real combat contact').toBe(true);
    await shot('11-after-engagement');

    // ── 7. Idle-harvester no-op check ──
    await page.keyboard.press('q'); await page.waitForTimeout(150);
    const selBefore = await sel();
    await page.keyboard.press('i'); await page.waitForTimeout(250);
    log(`I with no idle harvester: sel ${selBefore} -> ${await sel()} (no-op wanted)`);

    const m2 = (await match())!;
    log(`final state: P${m2.playerUnits} vs E${m2.enemyUnits}, eco=${JSON.stringify(await eco())}, buildings=${JSON.stringify(await bcount())} hp=${JSON.stringify(await teamHp())}`);
    await shot('12-final');
  });
});
