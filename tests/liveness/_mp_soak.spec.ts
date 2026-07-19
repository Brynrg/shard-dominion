// ── MP SOAK (not a gate): two real browsers, the real relay, a real contested
// match played for minutes — the strongest machine surrogate for the human
// 2-player field test. Run explicitly: MPSOAK=1 npx playwright test tests/liveness/_mp_soak.spec.ts
// Both seats build, train, and attack each other on realistic human cadence;
// desync is checked continuously; both seats must agree on the visible world.
import { test, expect, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RELAY_PORT = 8791;
let relay: ChildProcess;

test.beforeAll(async () => {
  relay = spawn('node', [path.join(__dirname, '../../server/relay.mjs'), String(RELAY_PORT)], { stdio: 'pipe' });
  await new Promise<void>((resolve, reject) => {
    relay.stdout!.on('data', (d) => { if (String(d).includes('listening')) resolve(); });
    relay.on('error', reject);
    setTimeout(() => reject(new Error('relay did not start')), 5000);
  });
});
test.afterAll(() => { relay?.kill(); });

test.describe('mp soak', () => {
  test.skip(!process.env.MPSOAK, 'long soak — run with MPSOAK=1, not part of the gate suite');
  test('5-minute contested 1v1: continuous lockstep, zero desync, seats agree', async ({ browser }) => {
    test.setTimeout(600000);
    const log = (m: string) => console.log(`[SOAK ${(Date.now() - t0).toString().padStart(6)}ms] ${m}`);
    const t0 = Date.now();

    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();
    const url = `/?mp=1&room=soak-${Date.now() % 100000}&relay=ws://localhost:${RELAY_PORT}&mission=skirmish`;
    await a.goto(url);
    await b.goto(url);
    for (const p of [a, b]) {
      await p.waitForSelector('#game-canvas', { timeout: 15000 });
      await p.locator('#game-canvas').click({ position: { x: 400, y: 300 } });
    }
    const tick = (p: Page) => p.evaluate(() => (window as any).__debugTick?.() ?? -1);
    const mp = (p: Page) => p.evaluate(() => (window as any).__debugMp?.() ?? null);
    const match = (p: Page) => p.evaluate(() => (window as any).__debugMatch?.() ?? null);
    const cyPos = (p: Page) => p.evaluate(() => (window as any).__debugConYardScreenPos?.() ?? null);

    await expect.poll(() => tick(a), { timeout: 20000, intervals: [300] }).toBeGreaterThan(30);
    log(`both seats live: seats=[${(await mp(a))?.seat},${(await mp(b))?.seat}]`);

    // Each seat plays like a human: build a barracks, then train + attack-move
    // waves on a loop. Seat B is the 'enemy' seat — same verbs, mirrored.
    // NOTE: only seat 0 ('player') owns a ConYard on the skirmish map — seat 1
    // plays from its pre-seeded base. Placement probes several offsets because
    // tiles near the base may be occupied (the sim refuses invalid tiles).
    const playOpening = async (p: Page): Promise<void> => {
      const box = (await p.locator('#game-canvas').boundingBox())!;
      const cy = await cyPos(p);
      if (!cy) return;
      // RA flow (v0.55): start the sidebar job, wait READY, then try tiles.
      await p.keyboard.press('b');
      const jobReady = () => p.evaluate(() => (window as any).__debugStructureJob?.()?.ready ?? false);
      for (let i = 0; i < 60 && !(await jobReady()); i++) await p.waitForTimeout(500);
      for (const [dx, dy] of [[80, -60], [-60, 50], [-90, -50], [60, 70]] as [number, number][]) {
        await p.keyboard.press('b'); // READY → arm placement
        await p.mouse.click(box.x + Math.max(40, cy.x + dx), box.y + Math.min(560, cy.y + dy));
        await p.waitForTimeout(400);
        const bc = await p.evaluate(() => (window as any).__debugBuildingCount?.() ?? null);
        if ((bc?.barracks ?? 0) > 0) return;
        await p.keyboard.press('Escape'); // drop a refused ghost before retrying
      }
    };
    await playOpening(a);
    await playOpening(b);
    log('both seats placed a barracks');

    // Waves: every ~20s each seat queues 2 infantry and attack-moves its army
    // at the other base; desync is polled every wave. ~5 minutes of play.
    const WAVES = 14;
    for (let w = 0; w < WAVES; w++) {
      for (const p of [a, b]) {
        await p.keyboard.press('t');
        await p.keyboard.press('t');
        await p.keyboard.press('q');
        await p.waitForTimeout(150);
        await p.keyboard.press('a');
        const box = (await p.locator('#game-canvas').boundingBox())!;
        const s = await mp(p);
        // seat 0 pushes NE (enemy base), seat 1 pushes SW (player base).
        if (s?.seat === 0) await p.mouse.click(box.x + 700, box.y + 90);
        else await p.mouse.click(box.x + 120, box.y + 500);
      }
      await a.waitForTimeout(20000);
      const [ma, mb, sa, sb, ta, tb] = [await match(a), await match(b), await mp(a), await mp(b), await tick(a), await tick(b)];
      log(`wave ${w + 1}/${WAVES}: ticks A${ta}/B${tb} · A sees P${ma?.playerUnits}/E${ma?.enemyUnits} · B sees P${mb?.playerUnits}/E${mb?.enemyUnits} · desync A:${sa?.desynced} B:${sb?.desynced}`);
      expect(sa?.desynced, `seat A desynced at wave ${w + 1}`).toBe(false);
      expect(sb?.desynced, `seat B desynced at wave ${w + 1}`).toBe(false);
      // Both seats run ONE sim: their world views must agree exactly.
      expect(ma?.playerUnits, `unit-count divergence at wave ${w + 1}`).toBe(mb?.playerUnits);
      expect(ma?.enemyUnits, `unit-count divergence at wave ${w + 1}`).toBe(mb?.enemyUnits);
    }

    const [ta, tb] = [await tick(a), await tick(b)];
    log(`soak done: ticks A${ta}/B${tb} (${Math.round(Math.max(ta, tb) / 20 / 60 * 10) / 10}min of sim), zero desync`);
    expect(Math.max(ta, tb)).toBeGreaterThan(4000); // >3.3 minutes of lockstep sim actually ran
    await ctxA.close();
    await ctxB.close();
  });
});
