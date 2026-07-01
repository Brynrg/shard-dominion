# Packet S4A — first blood: one unit kills another, a side wins

> **Read `AGENTS.md`, `BUILD_CONSTITUTION.md`, `PROGRESS.md` first.** Do ONLY this slice. S0–S3 gates must keep
> passing. This is the FIRST combat slice — keep it to the gate below; the full roster/RPS is S4B/S4C.

## Goal (the player-visible gate)
Two combat units (one **infantry**, one **vehicle**) on opposite teams **auto-target and shoot each other**;
damage uses the **locked `data/weapons.json` matrix**; a unit at **0 HP is destroyed**; when one side has no units
left, a **VICTORY / DEFEAT** banner shows. Selected/damaged units show a **health bar**.

## You MAY edit only these files
```
src/sim/systems/combatTargeting.ts  (create — 'combatTargeting' slot: each armed unit picks the nearest enemy in range)
src/sim/systems/damage.ts           (create — 'damage' slot: on cooldown, deal weapon.damage × matrix[type][armor]
                                       to the target; 0 HP → mark dead)
src/sim/systems/victory.ts          (create — 'victory' slot: if a team has no combat units, set a win/lose result)
src/sim/systems/movement.ts         (extend ONLY if a unit must move into range; keep minimal)
src/view/renderer.ts                (extend — health bars on damaged/selected units; a VICTORY/DEFEAT banner)
src/main.ts                         (seed one player + one enemy combat unit near each other; register the systems)
src/sim/components.ts               (ADDITIVE ONLY — e.g. `weapon`/`armor`/`dead` fields if the existing
                                       HealthComponent/CombatComponent don't cover it; do NOT change existing shapes)
src/loaders/units.ts + data/units.json   (create — infantry + vehicle defs: hp, armorClass, weaponId, speed, team;
                                       a NEW loader, do NOT touch the pinned schemas.ts/loader.ts)
tests/unit/combat.test.ts           (create)
tests/liveness/s4a.spec.ts          (create — model on s3.spec.ts)
```
**Do NOT touch** the immutable contract layer, including `data/weapons.json` and `src/sim/combat-types.ts` — you
**import** the weapon defs + the damage matrix + `WEAPON_TYPES`/`ARMOR_CLASSES` from there (that's the whole point:
the matrix is already locked). Deploy/economy/selection from S0–S3 keep working.

## Architecture rails (AGENTS.md applied)
- **Damage from the contract matrix, no literals:** `damage = weapon.damage × matrix[weapon.type][target.armorClass]`,
  read from the loaded `weapons.json`. Fire rate = `weapon.cooldownSeconds`; convert to ticks via `SIM_TICK_RATE`
  (cooldown counter decremented per tick). Range compared in WORLD units via the contract coords (no inline pixel math).
- **Sim-pure systems:** targeting/damage/victory read `state` only; no DOM/Date/Math.random (use `state.rng` if you
  need any randomness — you shouldn't for S4A). Health bars + banner are the VIEW's job (renderer).
- **For S4A keep projectiles simple:** hitscan (apply damage directly on a ready cooldown when a target is in range).
  Travel-time projectiles, splash, stances, and attack-move are S4B — OUT of scope here.
- **Death:** a unit at HP ≤ 0 is removed from the store (or flagged `dead` and skipped, then culled) — pick one and
  be consistent; the entity must actually leave play. **Victory:** count living combat units per team; when a team
  hits 0, set a result the renderer reads (expose it like the command system exposes markers — NOT via `(state as any)`).
- Additive components only; register systems via `orderSystems` (SYSTEM_ORDER already has `combatTargeting`,
  `projectile`, `damage`, `victory` slots).

## Acceptance (paste real output)
- `pnpm run verify` green — `combat.test.ts` proves: `damage = weapon.damage × matrix[type][armor]` for a couple of
  type/armor pairs; a unit reduced to 0 HP is removed; victory result is set when one team has no units; a unit does
  NOT fire while its cooldown is unexpired or the target is out of range.
- `pnpm run test:live` green — `s4a.spec.ts`: seed a player + enemy unit in range; assert (via a debug hook, e.g.
  `__debugUnitCount()` / `__debugVictory()`) that one unit's HP drops, the loser is removed, and a win/lose result is
  set; a health bar renders; screenshot saved. **S0/S1/S2/S3 gates still pass.**
- One conventional commit; update `PROGRESS.md`; **CALL `kanban_complete`** (do not exit without it).

## Out of scope (S4B/S4C and later)
The RPS triangle on the full weapon set, travel-time projectiles, splash/friendly-fire, stances, attack-move,
faction tanks, the 23-unit roster, veterancy. Just: two units fight, one dies, a side wins, health bars show.
