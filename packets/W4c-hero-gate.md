# Packet W4c — `tests/liveness/w4_hero.spec.ts` (Playwright gate): the hero is on the field and F1 casts

> Emit ONE complete Playwright spec modelled EXACTLY on the context spec (`controls.spec.ts` style:
> `page.goto('/?mission=m1_first_light')`, `await page.waitForSelector('#game-canvas')`, click the canvas at
> (400, 300) to take command, `page.keyboard.press(...)`, `expect.poll(..., { timeout: 8000, intervals: [300] })`).

## Debug hooks available on `window`
- `__debugHero?: () => { kind: string; hp: number; cooldowns: Record<string, number> } | null` — the viewer's living hero.
- `__debugMessages?: () => { speaker: string; text: string }[]` — live comm messages.

## Tests (`test.describe('W4 hero kit gate')`)
1. **The Warden stands with the squad at boot**: after taking command, `__debugHero()` is non-null with `kind === 'warden'` and `hp > 0`.
2. **O selects the hero and F1 casts Rally Surge**: press `o`, wait 200 ms, press `F1`; poll until `__debugHero()?.cooldowns.rally_surge` is a number `> 0` (the cast started its cooldown). Then press `F1` again and assert the cooldown did NOT reset upward (read it, wait 300 ms, read again: the second value is `<=` the first — it is counting down, not restarted).
3. **F2 (Aegis) also casts**: press `o`, `F2`; poll until `cooldowns.aegis > 0`.

Use `page.evaluate(() => (window as { __debugHero?: () => { kind: string; hp: number; cooldowns: Record<string, number> } | null }).__debugHero?.() ?? null)` for reads — no `any`.

## Output format (STRICT)
```
=== FILE: tests/liveness/w4_hero.spec.ts ===
…
=== END ===
```
