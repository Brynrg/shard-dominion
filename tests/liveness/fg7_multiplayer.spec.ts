// ── FG-7 gate: real 1v1 — relay process + two browser seats, one deterministic match ──
import { test, expect, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RELAY_PORT = 8790;

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

async function takeCommand(page: Page): Promise<void> {
  await page.waitForSelector('#game-canvas', { timeout: 10000 });
  await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } });
}

test('two seats join, the sims advance in lockstep, orders mirror, no desync', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  const url = `/?mp=1&room=gate-${Date.now() % 100000}&relay=ws://localhost:${RELAY_PORT}&mission=skirmish`;

  await a.goto(url);
  await b.goto(url);
  // Both canvases boot once the room fills (relay sends 'start').
  await takeCommand(a);
  await takeCommand(b);

  const tick = (p: Page) => p.evaluate(() => (window as { __debugTick?: () => number }).__debugTick?.() ?? -1);
  const mp = (p: Page) => p.evaluate(() => (window as { __debugMp?: () => { seat: number; desynced: boolean; peerLeft: boolean } }).__debugMp?.());

  // Both sims advance (lockstep releasing ticks as bundles flow).
  await expect.poll(() => tick(a), { timeout: 15000, intervals: [300] }).toBeGreaterThan(30);
  await expect.poll(() => tick(b), { timeout: 15000, intervals: [300] }).toBeGreaterThan(30);

  // Seat assignment: one 0, one 1.
  const ma = (await mp(a))!;
  const mb = (await mp(b))!;
  expect([ma.seat, mb.seat].sort()).toEqual([0, 1]);

  // Seat A orders its infantry across the map — seat B must SEE the movement.
  const posOnB = () => b.evaluate(() => (window as { __debugUnitScreenPos?: (k: string) => { x: number; y: number } | null }).__debugUnitScreenPos?.('infantry') ?? null);
  const before = await posOnB();
  const infA = await a.evaluate(() => (window as { __debugUnitScreenPos?: (k: string) => { x: number; y: number } | null }).__debugUnitScreenPos?.('infantry') ?? null);
  expect(infA).not.toBeNull();
  const boxA = (await a.locator('#game-canvas').boundingBox())!;
  await a.mouse.dblclick(boxA.x + infA!.x, boxA.y + infA!.y);          // select-all-of-type
  await a.mouse.click(boxA.x + infA!.x + 130, boxA.y + infA!.y - 130, { button: 'right' }); // move order
  await expect.poll(async () => {
    const p = await posOnB();
    return p && before ? Math.hypot(p.x - before.x, p.y - before.y) : 0;
  }, { timeout: 12000, intervals: [300] }).toBeGreaterThan(15);

  // The match never desynced on either seat.
  expect((await mp(a))!.desynced).toBe(false);
  expect((await mp(b))!.desynced).toBe(false);

  await ctxA.close();
  await ctxB.close();
});
