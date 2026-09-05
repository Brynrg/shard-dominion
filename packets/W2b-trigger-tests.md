# Packet W2b — `tests/unit/w2_triggers.test.ts` (vitest) for the widened trigger vocabulary

> Emit ONE complete file. Modules under test are in the context (`missionTriggers.ts`, `objectives.ts`,
> `fog.ts`); style reference `fg4_triggers.test.ts` (context). Lint: no unused vars (never bind an entity id
> you don't read), no `any`, `noUncheckedIndexedAccess` (use `!` after `store.get(id)`).

## Exact APIs
- `makeSimState({ seed: 1, mapWidth: 32, mapHeight: 32 })` (`../../src/sim/state.js`); `state.store.create(bag)` returns an `EntityId`; `state.store.get(id)!`; `state.store.all()`.
- Build units with `unitComponents(def, team, FACTIONS.concord)` (`../../src/sim/factory.js`, `../../src/sim/factions.js`) spread with `position: tileToWorldCenter({ tx, ty })` (`../../src/sim/coords.js`). `loadUnits(unitsData)` from `../../src/loaders/units.js` + `import unitsData from '../../data/units.json' with { type: 'json' }`; use `units.find(u => u.id === 'infantry')!`.
- `makeObjectivesSystem(objectives, failures, triggers, units)` from `../../src/sim/systems/objectives.js`; the system exposes `messages`, `result.objectives` (`{ id?, text, primary, complete }[]`), `cameraRequests`, `activeReveals()`, `firedTriggerIds()`. Run with `const systems = orderSystems([sys]); runTick(state, systems);` (`../../src/sim/loop.js` also exports `SIM_TICK_RATE` = 20). A `survive` objective `{ type: 'survive', seconds: 999, primary: true, text: 'x' }` keeps a mission alive.
- `makeFogSystem('player', () => sys.activeReveals())` from `../../src/sim/systems/fog.js`; after `runTick(state, orderSystems([sys, fog]))` check `fog.visible.has('20,20')`.
- Trigger shape: `{ id, when: {...}, actions: [...] }` with conditions `unitEnters {team, region:{tx,ty,r}}`, `destroyed {team, kind}`, `hpBelow {team, kind, fraction}`, `triggerFired: id`, `delaySeconds`, and actions `message {speaker?, text, seconds?}`, `addObjective {objective}`, `completeObjective {id}`, `removeUnits {team, kind?, region?}`, `reveal {region, seconds?}`, `panCamera {tx, ty}`.

## Tests (one `describe('W2 — trigger vocabulary')`)
1. `unitEnters`: no player unit in region (tx 20, ty 20, r 2) → after a tick no message; create an infantry at (20,20) → next tick the message is queued; it fires only once (a further 5 ticks: still exactly one message).
2. `destroyed` latch: enemy barracks entity (`{ position, building: { onSlab: true, buildProgress: 100, powered: true }, faction: { team: 'enemy', faction: 'barracks' }, health: { hp: 100, maxHp: 100 } }`) alive → no fire; set `hp = 0` → fires next tick. Also: a trigger whose kind NEVER existed does not fire.
3. `hpBelow` fraction 0.5: infantry at full hp → no fire; set hp to 40% → fires.
4. `triggerFired` + `delaySeconds`: trigger A `timeSeconds: 1`; trigger B `{ triggerFired: 'A', delaySeconds: 2 }` → B's message appears only after ≥ 2 s (40 ticks) beyond A firing, not before (check at A+30 ticks: absent; at A+41: present).
5. `addObjective` + `completeObjective`: a time trigger adds `{ type: 'build', id: 'extra', team: 'player', kind: 'barracks', primary: false, text: 'Build one' }` → `result.objectives` now has 2 entries with the new one incomplete; a second trigger `completeObjective 'extra'` → it reads complete (no barracks ever built).
6. `removeUnits` with region: two player infantry, one inside (20,20 r2) and one outside → after the trigger, `state.store.all()` holds only the outside one.
7. `reveal` → fog: before the trigger `fog.visible.has('20,20')` is false (no player units near); after the trigger with `seconds: 1` it is true; after `1 * SIM_TICK_RATE + 2` more ticks it is false again (reveal expired).
8. `panCamera` pushes `{ tx: 5, ty: 6, tick }` onto `sys.cameraRequests`; `message.seconds: 1` expires after ~20 ticks while a default message is still there.

## Output format (STRICT)
```
=== FILE: tests/unit/w2_triggers.test.ts ===
…
=== END ===
```
