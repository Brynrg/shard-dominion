# Packet W4a-test — `tests/unit/abilities.test.ts` (vitest) for the hero kit

> Emit ONE complete file. The modules under test are in the context (`src/sim/abilities.ts`,
> `src/sim/systems/ability.ts`, `src/sim/factory.ts`). Style reference: `tests/unit/fg4_triggers.test.ts`
> (context). Lint rules: no unused variables (do NOT bind an entity id you never read), no `any`,
> `noUncheckedIndexedAccess` (use `!` after `store.get(id)` where you know it exists).

## Exact APIs (do not guess)
- `makeSimState({ seed: 1, mapWidth: 32, mapHeight: 32 })` from `../../src/sim/state.js`.
- `state.store.create(componentsBag)` takes the components bag DIRECTLY (no `{ components: … }` wrapper) and RETURNS AN `EntityId` (a number). Read an entity back with `state.store.get(id)!`.
- Build a unit's bag with `unitComponents(def, team, FACTIONS.concord)` from `../../src/sim/factory.js` (+ `FACTIONS` from `../../src/sim/factions.js`), spread into the bag with a `position`: `state.store.create({ position: tileToWorldCenter({ tx, ty }), ...unitComponents(def, 'player', FACTIONS.concord) })`. `tileToWorldCenter` from `../../src/sim/coords.js`; `TILE_SUBUNITS` there too.
- `loadUnits(unitsData)` from `../../src/loaders/units.js` with `import unitsData from '../../data/units.json' with { type: 'json' }`. Heroes and kits in data: `warden` → `rally_surge` (rally, radius 6, magnitude 0.35, 8s) + `aegis` (ward, radius 5, magnitude 40); `vane` → `shadowstep` (blink, radius 8, targeted) + `ember_strike` (nova, radius 2.5, magnitude 60, targeted); `razor` → `overcharge` (rally) + `field_mend` (mend, radius 5, magnitude 35); `tempest` → `crystal_barrage` (nova) + `crystal_ward` (ward). Use `def.abilities.find(a => a.id === '…')!`.
- `castAbility(state, heroEntity, heroDef, abilityDef, target | null): boolean` from `../../src/sim/abilities.js`. Non-targeted kinds centre on the hero; nova centres on `target`.
- `makeAbilitySystem()` from `../../src/sim/systems/ability.js`; run it with `const systems = orderSystems([makeAbilitySystem()]); runTick(state, systems);` (`orderSystems`, `runTick`, `SIM_TICK_RATE` from `../../src/sim/loop.js`). `runTick` advances `state.tick`.
- Components: `health { hp, maxHp }`, `shield { hp, max, regenDelay }`, `buff { dmgBonus, dmgUntilTick }`, `ability { cooldowns }`, `position { wx, wy }`, `movement { target, path, attackMove?, orderQueue? }`, `faction { team, faction }`. Concord units spawn with a 20-HP shield from `unitComponents` (`shieldHp: 20`) — account for it in the nova test (60 damage → 20 absorbed, 40 off hp) or delete `e.components.shield` first.

## Tests (one `describe('W4 — hero abilities')`)
1. rally: ally 2 tiles away gets `buff.dmgBonus === 0.35`; ally 12 tiles away does not; an enemy 2 tiles away does not; after `8 * SIM_TICK_RATE + 1` ticks of the ability system the ally's `buff` is `undefined`.
2. mend: ally at hp 10 → after Field Mend hp === 45 (10 + 35); ally at hp maxHp-5 → exactly maxHp.
3. blink: target 3 tiles away → hero position equals the target, `movement.target === null`, `movement.path` empty; target 20 tiles away → returns false, position unchanged.
4. nova (`ember_strike` at the enemy's position): enemy shield 20 → 0 and hp reduced by 40; a neutral `riftmaw` (def `units.find(u => u.id === 'riftmaw')`, team `'neutral'`) in radius loses 60 hp (riftmaws get no Concord shield? — they DO if built via unitComponents with FACTIONS.concord; pass `FACTIONS.emberhand` for the riftmaw to avoid the shield); a friendly in radius is untouched.
5. ward: ally within radius has `shield.hp === 40`; ally outside does not gain one beyond the base 20.
6. cooldown: second immediate cast returns false; after `Math.round(cooldownSeconds * SIM_TICK_RATE)` ticks of the ability system it returns true.

## Output format (STRICT)
```
=== FILE: tests/unit/abilities.test.ts ===
…
=== END ===
```
