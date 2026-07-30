// ── v0.24 gate: the AI runs a REAL economy and mounts sustained, funded pressure ─
// Proves E1: the enemy harvests its own field into income, funds production (army
// value climbs from zero), and escalates into an aggressive plan — without a static
// credit crutch — yet does not trivially overrun the player in the opening.
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, '../../screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

type Teams = Record<'player' | 'enemy', { credits: number; harvesters: number; army: number; armyValue: number }>;

test.describe('AI economy gate', () => {
  test('the AI harvests, funds an army, and escalates to pressure — but does not instawin', async ({ page }) => {
    await page.goto('/?mission=skirmish&difficulty=hard'); // hard = the shortest grace (45s) — this gate tests AI aggression mechanics, not difficulty pacing
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } }); // take command
    await page.waitForTimeout(400);

    const teams = () => page.evaluate(() => (window as { __debugEconomyTeams?: () => Teams }).__debugEconomyTeams?.());

    // The AI starts with exactly one harvester and no combat units.
    const t0 = await teams();
    expect(t0!.enemy.harvesters).toBe(1);
    expect(t0!.enemy.army).toBe(0);

    // Give it real time to harvest → BUILD ITS OWN BARRACKS (it starts without one
    // now — both sides open ConYard+Refinery+Power) → train → escalate past the 45s
    // hard grace. Poll for an aggressive plan.
    test.setTimeout(480_000);
    await expect.poll(
      () => page.evaluate(() => (window as { __debugAiState?: () => string }).__debugAiState?.() ?? ''),
      // Hard now masses a DECISIVE wave before turning aggressive (big-map tuning:
      // trickled squads died crossing 48 tiles) — the headless trace puts its first
      // aggressive plan at ~3-4.5 sim minutes.
      { timeout: 330_000, intervals: [2000] },
    ).toMatch(/Assault|Pressure|Raid/);

    // Economy is alive (harvester kept/rebuilt) and production was funded (army value climbed).
    const t1 = await teams();
    expect(t1!.enemy.harvesters).toBeGreaterThanOrEqual(1);
    expect(t1!.enemy.armyValue).toBeGreaterThanOrEqual(300);

    // ...but the AI has NOT trivially overrun the player in the opening.
    const victory = await page.evaluate(() => (window as { __debugVictory?: () => { over: boolean; winner: string | null } }).__debugVictory?.());
    expect(victory!.over && victory!.winner === 'enemy').toBeFalsy();

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'ai-economy.png'), fullPage: true });
  });
});
