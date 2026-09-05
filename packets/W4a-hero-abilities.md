# Packet W4a — hero ABILITIES: data-driven active kit, cooldowns, effects, HUD bar, tests

> Orchestrated build (branch `feat/wc3-parity`). Read `AGENTS.md` §1, §3, §4. The review's #1 gap:
> heroes are a passive aura with 3 kill-ranks — no active abilities. This packet adds a WC3-class
> kit: each hero gets two DATA-defined abilities on cooldowns, cast with F1/F2 (or a HUD button),
> resolved in the pure sim. The orchestrator pre-adds the two components below and the
> `'ability'` SYSTEM_ORDER slot (right after `'hero'`), the stateHash lines, the damage.ts buff
> multiplier, and splices your snippets into command.ts / input.ts / hud.ts. You write the modules.

## Pre-existing contract you can rely on (already in `src/sim/components.ts`)
```ts
export interface AbilityComponent { cooldowns: Record<string, number> } // abilityId → ticks left (0 = ready)
export interface BuffComponent { dmgBonus: number; dmgUntilTick: number } // rally: +dmgBonus (e.g. 0.35) while tick < dmgUntilTick
// Components bag: ability?: AbilityComponent; buff?: BuffComponent;
```
`SYSTEM_ORDER` contains `'ability'` after `'hero'`. `TILE_SUBUNITS` from `./coords.js` converts tiles→world.
`SIM_TICK_RATE` (20) from `./loop.js`. Never `Math.random` / `Date`. `noUncheckedIndexedAccess` is ON. No `any`.

## 1. `src/loaders/units.ts` — emit the COMPLETE file
Add, before `UnitSchema`:
```ts
export const AbilitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  key: z.enum(['F1', 'F2', 'F3']),
  kind: z.enum(['rally', 'mend', 'blink', 'nova', 'ward']),
  cooldownSeconds: z.number().positive(),
  radiusTiles: z.number().positive(),
  magnitude: z.number().nonnegative(),      // rally: dmg bonus fraction · mend: HP healed · nova: damage · ward: shield HP · blink: unused
  durationSeconds: z.number().positive().optional(), // rally only
  targeted: z.boolean().default(false),     // true = needs a world point (blink, nova); false = centred on the hero
  desc: z.string().optional(),
});
export type AbilityDef = z.infer<typeof AbilitySchema>;
```
and on `UnitSchema`: `abilities: z.array(AbilitySchema).default([])` with a doc comment (W4: hero kit).

## 2. `src/sim/abilities.ts` (NEW, pure)
```ts
export function abilityOf(def: UnitDef, abilityId: string): AbilityDef | undefined
export function abilityReady(hero: Entity, abilityId: string): boolean   // no ability component or cooldown 0 → true
export function castAbility(state: SimState, hero: Entity, def: UnitDef, ability: AbilityDef, target: WorldPos | null): boolean
```
`castAbility` returns false (and changes nothing) when: hero hp ≤ 0; ability not ready; `targeted` but `target` is null; blink target farther than `radiusTiles * TILE_SUBUNITS` from the hero. Otherwise applies the effect, sets `hero.components.ability.cooldowns[ability.id] = Math.round(cooldownSeconds * SIM_TICK_RATE)` (create the component if missing) and returns true. Effects (team = hero's team; "friendly" = same team, has `health`, hp>0, NO `building`; "hostile" = any other team incl. neutral, has `health`, hp>0; radius in world units = `radiusTiles * TILE_SUBUNITS`, distance = `Math.hypot`):
- `rally`: every friendly within radius of the hero (hero included) gets `buff = { dmgBonus: magnitude, dmgUntilTick: state.tick + round((durationSeconds ?? 8) * SIM_TICK_RATE) }`.
- `mend`: every friendly within radius: `hp = Math.min(maxHp, hp + magnitude)`.
- `blink`: hero `position` becomes the target (clamped inside the grid: 0 ≤ wx < grid.width*TILE_SUBUNITS, same for wy); clear `movement.target = null`, `movement.path = []`, `attackMove = false`, `orderQueue = []`, and `combat.targetId = null`.
- `nova`: centre = `target` (targeted) — every hostile within radius takes `magnitude` damage: shields absorb first (`shield.hp`), remainder off `health.hp` (may go ≤ 0; victory.ts culls).
- `ward`: every friendly within radius: `shield = { hp: magnitude, max: Math.max(existing?.max ?? 0, magnitude), regenDelay: 0 }`.
Iterate `state.store.all()` in order (deterministic). Integers only where the hash quantises (hp may be fractional elsewhere; keep as-is).

## 3. `src/sim/systems/ability.ts` (NEW)
`makeAbilitySystem(): { name: 'ability'; run(state) }` — each tick: for every entity with `ability`, decrement each cooldown > 0 by 1; for every entity with `buff` where `state.tick >= buff.dmgUntilTick`, delete `e.components.buff`.

## 4. `=== FILE: SNIPPET/command.ability.ts ===` — a `case 'ability':` block for the command switch
Context: inside `run()` the loop is `for (const intent of queue.drain()) { const actor = …; switch (intent.type) { … } }` and `units: readonly UnitDef[]` is in scope. The existing superweapon case looks like:
```ts
          case 'superweapon': {
            const def = structures.find(sd => sd.id === intent.structureId);
            if (!def?.superweapon) break;
            …
            markers.push({ target: intent.target, remaining: STRIKE_DELAY });
            break;
          }
```
Yours: find the FIRST selected entity of `actor` whose `faction.faction` unit def has `abilities.length > 0` and contains `intent.abilityId`; call `castAbility(state, hero, def, ability, intent.target ?? null)`; on success and when `intent.target` is set, `markers.push({ target: intent.target, remaining: 10 })`. Import line to add at top (state it as a comment on the first line of the snippet): `import { abilityOf, castAbility } from '../abilities.js';`
The intent shape (orchestrator adds to `CommandIntent`): `{ type: 'ability'; abilityId: string; target?: WorldPos }`.

## 5. `=== FILE: SNIPPET/hud.abilityBar.ts ===` — one function for hud.ts
```ts
function drawAbilityBar(px: number, by: number, bw: number): number  // returns the new `by`
```
Uses in-scope `context`, `simState`, `viewerTeam`, `rects`, `units` (UnitDef[]), `COLORS`. Finds the first selected own unit whose def has abilities. For each ability draw a 26px-high button (style: same as the REPAIR button — `context.fillRect` tint, 1px stroke, `bold 12px monospace`): left `[F1] Rally Surge`, right-aligned `READY` in `COLORS.success` or `12s` countdown in `#ffe9b0` (`Math.ceil(ticks / 20)`); when on cooldown overlay a darker fill proportional to `ticksLeft / totalTicks` is NOT available (total not stored) — instead draw the countdown text and dim the button (alpha 0.5). Push `rects.push({ action: \`ability:${ab.id}\`, x: px + 8, y: by, w: bw, h: 26, enabled: ready })`. Advance `by += 30` per button; return `by`. No ability-holder selected → return `by` unchanged.

## 6. `tests/unit/abilities.test.ts` (NEW)
Use `makeSimState({ seed: 1, mapWidth: 32, mapHeight: 32 })`, `loadUnits(unitsData)` (data/units.json now carries `abilities` on `warden` [rally F1 `rally_surge`, ward F2 `aegis`], `vane` [blink F1 `shadowstep`, nova F2 `ember_strike`], `razor` [rally, mend], `tempest` [nova, ward]) and `unitComponents(def, team, FACTIONS.concord)` from `../../src/sim/factory.js` to create entities (`state.store.create({ position: tileToWorldCenter({tx,ty}), ...unitComponents(...) })`). Tests:
1. rally applies `buff` to a friendly within radius, not to one outside, not to an enemy; the ability system removes the buff after the duration.
2. mend heals a damaged friendly up to maxHp, never above.
3. blink moves the hero to an in-range point and clears its movement; an out-of-range point returns false and moves nothing.
4. nova damages enemies (and a neutral riftmaw) in radius, never friendlies; shields absorb first.
5. ward grants shields to friendlies in radius.
6. cooldown: a second cast returns false; after `cooldownSeconds * SIM_TICK_RATE` ticks of the ability system it succeeds again.
Don't bind entity ids you never read (lint).

## Output format (STRICT) — six blocks, no prose outside them
```
=== FILE: src/loaders/units.ts ===
=== FILE: src/sim/abilities.ts ===
=== FILE: src/sim/systems/ability.ts ===
=== FILE: SNIPPET/command.ability.ts ===
=== FILE: SNIPPET/hud.abilityBar.ts ===
=== FILE: tests/unit/abilities.test.ts ===
```
