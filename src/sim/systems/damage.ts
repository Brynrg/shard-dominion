// ── Damage system: resolve weapon damage against targets ──────────────────────
// Runs in SYSTEM_ORDER after combatTargeting (so targets are set) and before
// agitation/planetEvent. Pure sim: no DOM, no wall-clock, no screen concepts.
import type { SimState } from '../state.js';
import type { WeaponsFile } from '../../loaders/schemas.js';
import { SIM_TICK_RATE } from '../loop.js';
import { TILE_SUBUNITS } from '../coords.js';
import { teamPowerShortage } from './power.js';
import type { WorldPos } from '../coords.js';

/** Distance between two world positions. */
function distance(a: WorldPos, b: WorldPos): number {
  return Math.hypot(a.wx - b.wx, a.wy - b.wy);
}

// The 'damage' system: for each unit with a weapon, a target, and a ready cooldown,
// deal weapon.damage × matrix[weapon.type][targetArmor] to the target's hp, then
// reset the cooldown. Range is checked in WORLD units. Sim-pure (state only).
export function makeDamageSystem(weapons: WeaponsFile): { name: 'damage'; run(state: SimState): void } {
  return {
    name: 'damage' as const,
    run(state: SimState): void {
      // Hero aura (FG-5): a living Warden emboldens nearby friendlies (+15% damage).
      const wardens: { team: string; pos: WorldPos }[] = [];
      for (const w of state.store.all()) {
        const wf = w.components.faction;
        const wk = wf?.faction;
        if (wf && (wk === 'warden' || wk === 'vane') && (w.components.health?.hp ?? 0) > 0 && w.components.position) {
          wardens.push({ team: wf.team, pos: w.components.position });
        }
      }
      const AURA = 4 * TILE_SUBUNITS;

      for (const e of state.store.all()) {
        const combat = e.components.combat;
        const pos = e.components.position;
        if (!combat || !pos || combat.weaponId === null) continue;

        // 1) tick the cooldown down (min 0)
        if (combat.cooldownRemaining > 0) {
          combat.cooldownRemaining -= 1;
          continue;
        }

        // 2) resolve target + its health/armor/pos; skip if gone
        const target = combat.targetId !== null ? state.store.get(combat.targetId) : undefined;
        const th = target?.components.health;
        const tpos = target?.components.position;
        if (!target || !th || !tpos) continue;

        // 3) range check (WORLD units): weapon.range tiles → world = range * TILE_SUBUNITS
        const weapon = weapons.weapons[combat.weaponId];
        if (!weapon) continue;

        const dist = distance(pos, tpos);
        const rangeWorld = weapon.range * TILE_SUBUNITS;
        if (dist > rangeWorld) continue;

        // 4) resolve the hit. SHELL/SIEGE weapons launch a PROJECTILE (FG-3) at the
        // target's CURRENT position — the projectile system flies it and splashes
        // at impact (dodgeable, punishes clumps/buildings). Everything else stays
        // instant-hit: damage = weapon.damage × matrix[weapon.type][armor].
        // Artillery (XP-4): can't fire inside its minimum range.
        if (weapon.minRange != null && dist < weapon.minRange * TILE_SUBUNITS) continue;
        if (weapon.type === 'SHELL' || weapon.type === 'SIEGE') {
          const team = e.components.faction?.team ?? 'neutral';
          state.store.create({
            position: { wx: pos.wx, wy: pos.wy },
            projectile: {
              weaponId: combat.weaponId,
              sourceTeam: team,
              target: { wx: tpos.wx, wy: tpos.wy },
              speed: TILE_SUBUNITS * 0.6, // ~12 tiles/s at 20 Hz
            },
          });
        } else {
          const armor = target.components.armor?.armorClass ?? 'NONE';
          const mult = weapons.matrix[weapon.type]?.[armor] ?? 0;
          // Veterancy (FG-5): +15% damage per rank (3 kills → rank 1, 8 → rank 2).
          const kills = e.components.experience?.kills ?? 0;
          const rank = kills >= 8 ? 2 : kills >= 3 ? 1 : 0;
          // Hero aura: +15% when a friendly Warden stands within 4 tiles.
          const team = e.components.faction?.team;
          const inAura = wardens.some(w => w.team === team && distance(pos, w.pos) <= AURA);
          th.hp -= weapon.damage * mult * (1 + 0.15 * rank) * (inAura ? 1.15 : 1);
          // Kill attribution → the shooter's experience (projectile kills unattributed v1).
          if (th.hp <= 0) {
            const xp = e.components.experience ?? { kills: 0, rank: 0 };
            xp.kills += 1;
            xp.rank = xp.kills >= 8 ? 2 : xp.kills >= 3 ? 1 : 0;
            e.components.experience = xp;
          }
        }

        // 5) reset cooldown: weapon.cooldown seconds → ticks. Armed BUILDINGS
        // (turrets) fire 50% slower while their team is power-starved (FG-2).
        const lowPowerTurret = e.components.building &&
          teamPowerShortage(state, e.components.faction?.team ?? '');
        combat.cooldownRemaining = Math.round(weapon.cooldown * SIM_TICK_RATE * (lowPowerTurret ? 1.5 : 1));
        // XP-3: firing breaks stealth for 5s (the stealth system counts it down).
        if (e.components.stealth) e.components.stealth = { cloaked: false, decloakTicks: 100 };
        // XP-4 counter-battery: siege fire pings the radar through fog for 3s.
        if (weapon.type === 'SIEGE') combat.revealedTicks = 60;
      }
    },
  };
}
