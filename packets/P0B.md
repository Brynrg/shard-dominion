# Packet P0b — the PLAYER can build an army: train units from a barracks (scaffolded)

> **Read `AGENTS.md` + `PROGRESS.md` first.** Operator play-test: "the AI plays but I can't." Root cause — the
> player has no way to produce units. This slice gives the player a Barracks + a train hotkey, so you can build an
> army and actually fight. The production system (S6A-1) already builds+spawns from a queue; you're adding the
> INPUT to fill the player's queue + seeding the player a barracks. Work in place.
> Files: `src/view/input.ts` (train intents + keys), `src/sim/systems/command.ts` (handle 'train'),
> `src/main.ts` (seed a player barracks + HUD hint hooks), `src/view/hud.ts` (show a build hint + the player queue),
> `tests/unit/train.test.ts` (create).

## 1. input.ts — a train intent + hotkeys
Add to `CommandIntent`: `| { type: 'train'; unitId: string }`. In `onKeyDown` (keep existing keys working):
`'t'|'T'` → `queue.push({ type: 'train', unitId: 'infantry' })`; `'r'|'R'` → `{ type: 'train', unitId: 'rocket_trooper' }`.

## 2. command.ts — handle 'train'
```ts
case 'train': {
  // append to the player's barracks queue (first player entity with a production component)
  const barracks = state.store.all().find(e =>
    e.components.faction?.team === 'player' && e.components.production);
  if (barracks && barracks.components.production) {
    const p = barracks.components.production;
    barracks.components.production = { ...p, queue: [...p.queue, intent.unitId] }; // queue is readonly — replace
  }
  break;
}
```

## 3. main.ts — seed a player barracks so training works immediately
Next to the player base add a barracks (producer, destructible):
```ts
state.store.create({ position: tileToWorldCenter({ tx: cx - 1, ty: cy + 3 }),
  building: { onSlab: true, buildProgress: 100, powered: true },
  faction: { team: 'player', faction: 'barracks' },
  production: { queue: [], progress: 0 },
  health: { hp: 800, maxHp: 800 }, armor: { armorClass: 'BUILDING' } });
```
Also expose `window.__debugPlayerQueue = () => <player barracks production.queue.length>` (declare on Window) so the
gate can prove training. NOTE: the production system pays from the team's first economy entity — the player
refinery starts at 500 credits (enough for a few units at cost 100/200); good enough for P0b.

## 4. hud.ts — a one-line build hint + the player's queue
Add a HUD line: `T: Infantry (100)   R: Rocket (200)` and, if the player barracks has a non-empty queue or active
build, show `Building: <unitId> …` (read the player barracks' production component). Keep it minimal + legible.

## 5. Required test — `tests/unit/train.test.ts`
- Seed a player barracks (production) + a player refinery (economy 500). Push `{type:'train',unitId:'infantry'}`,
  run `[makeCommandSystem(...), makeProductionSystem(units)]` via runTick once → the barracks queue contains
  'infantry' (or is already building it). Run ~65 ticks → a new player infantry entity exists AND credits dropped
  by 100. Two train intents → two units eventually spawn (queue processed in order).
- A train intent with NO player barracks present does nothing (no crash).

## Acceptance
`pnpm run verify` green (all 100 prior tests still pass) AND `pnpm run test:live` green (7 gates). One commit;
update `PROGRESS.md`; **CALL `kanban_complete`.**
