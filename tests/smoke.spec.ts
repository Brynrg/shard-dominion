import { test, expect } from "@playwright/test";

const URL = "http://localhost:5175/";

// Required smoke per docs/browser-game-template-contract.md §4: the built game
// must render a game-root element and log no console errors. This runs in CI
// before deploy, so a broken build is caught before it can reach the portal.
test("game loads and renders without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(URL, { waitUntil: "load" });

  // game-root element appears within 3s (canvas / #game / [data-game-root] / #app)
  await expect(
    page.locator("canvas, #game, [data-game-root], #app").first(),
  ).toBeVisible({ timeout: 3000 });

  // give the first frames time to run, then assert a clean console
  await page.waitForTimeout(1500);
  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);

  // Extended smoke: verify game is playable for ~30s
  // - Check for game state indicators (credits, units, buildings)
  // - Verify no console errors during gameplay
  await page.waitForTimeout(15000); // 15s more
  expect(errors, `console errors after 15s:\n${errors.join("\n")}`).toEqual([]);

  // Check for basic game UI elements
  const credits = page.locator('[data-testid="credits"]');
  const units = page.locator('[data-testid="units"]');
  const buildings = page.locator('[data-testid="buildings"]');

  // At least one of these should be visible (game is running)
  await expect(credits.or(units.or(buildings)).first(), "game UI should be visible").toBeVisible({ timeout: 5000 });
});
