# Packet P0a — destructible buildings: the match becomes WINNABLE (small, scaffolded)

> **Read `AGENTS.md` + `PROGRESS.md` first.** Operator play-test finding: the match can't be won because
> buildings have no health. ONE small slice: every building gets `health` + `armor: BUILDING`, making them
> targetable/destroyable by the EXISTING combat stack (no combat-system changes needed — targeting already
> attacks anything with health in range, damage already reads the BUILDING matrix column, victory already
> counts producers). Work in place.
> Files: `src/main.ts`, `src/sim/systems/command.ts`, `tests/unit/destructible.test.ts` (create).

## 1. main.ts — seeded buildings get health + armor (hp from data where it exists)
- Player refinery: `health: { hp: 1500, maxHp: 1500 }, armor: { armorClass: 'BUILDING' }`
- Enemy refinery (the AI bank): same 1500.
- Enemy barracks: `health: { hp: 800, maxHp: 800 }, armor: { armorClass: 'BUILDING' }`

## 2. command.ts — buildings created at runtime get the same
- In the `deploy` handler (MCV → ConYard): add `health` from the `construction_yard` structure def
  (`structures.find(s => s.id === 'construction_yard')?.hp ?? 2000`) + `armor: { armorClass: 'BUILDING' }`.
- In the `place-structure` handler: the spawned structure already gets building/power — ADD
  `health: { hp: structure.hp, maxHp: structure.hp }` and `armor: { armorClass: 'BUILDING' }`.

## 3. Required test — `tests/unit/destructible.test.ts` (full-stack, like rps_battle.test.ts)
- A player rifle unit in range of an enemy BUILDING-armor structure (with health) damages it each ready
  cooldown by `weapon.damage × matrix.BULLET.BUILDING` (assert the exact hp drop after one tick).
- A building reduced to 0 hp is REMOVED from the store after a tick (victory system culls it).
- **Winnable match proof:** seed an enemy barracks (health + production + faction) + one enemy combat unit,
  and a player squad in range of both; run the full stack (`combatTargeting`, `damage`, `victory` via
  `orderSystems` + `runTick`) until the enemy unit AND barracks are destroyed → `victory.result` =
  `{ over: true, winner: 'player' }` (the producer rule now resolves — no producers + no units = defeat).

## Acceptance
`pnpm run verify` green (all 97 prior tests still pass) AND `pnpm run test:live` green (all 7 gates — the s6a
match gate must still pass; the AI wave may now also shoot your buildings, which is correct). One commit; update
`PROGRESS.md`; **CALL `kanban_complete`.**
