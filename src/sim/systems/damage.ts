// ── Damage system: resolve weapon damage against targets ──────────────────────
// Runs in SYSTEM_ORDER after combatTargeting (so targets are set) and before
// agitation/planetEvent. Pure sim: no DOM, no wall-clock, no screen concepts.
import type { SimState } from '../state.js';
import type { WeaponsFile } from '../../loaders/schemas.js';
import { refinementValue, type Refinement } from '../../loaders/refinements.js';
import { veterancyRank } from '../factory.js';
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
export function makeDamageSystem(weapons: WeaponsFile, refinements: readonly Refinement[] = []): { name: 'damage'; run(state: SimState): void } {
  return {
    name: 'damage' as const,
    run(state: SimState): void {
      // Hero aura (FG-5): a living Warden emboldens nearby friendlies. Ascendancy
      // (character build): the bonus + radius grow with the hero's veterancy rank.
      const wardens: { team: string; pos: WorldPos; rank: number }[] = [];
      for (const w of state.store.all()) {
        const wf = w.components.faction;
        const wk = wf?.faction;
        if (wf && (wk === 'warden' || wk === 'vane') && (w.components.health?.hp ?? 0) > 0 && w.components.position) {
          wardens.push({ team: wf.team, pos: w.components.position, rank: veterancyRank(w.components.experience?.kills ?? 0) });
        }
      }

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
        // Air ammo (XP-5): an empty sortie holds fire until it rearms.
        if (combat.ammo != null && combat.ammo <= 0) continue;
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
          // Veterancy (FG-5): +15% damage per rank (3/8/15 kills → rank 1/2/3).
          const rank = veterancyRank(e.components.experience?.kills ?? 0);
          // Hero aura: +15% base, +5%/rank, radius (4+rank) tiles, best nearby hero wins.
          const team = e.components.faction?.team;
          let auraBonus = 0;
          for (const w of wardens) {
            if (w.team !== team) continue;
            if (distance(pos, w.pos) <= (4 + w.rank) * TILE_SUBUNITS) auraBonus = Math.max(auraBonus, 0.15 + 0.05 * w.rank);
          }
          // Refinements (economy depth): Munitions Doctrine boosts the attacker's
          // damage; Composite Plating cuts the defender's incoming damage.
          const atkBonus = 1 + refinementValue(team ? state.refinements.get(team)?.done : undefined, refinements, 'damage');
          const defTeam = target.components.faction?.team;
          const defCut = 1 - refinementValue(defTeam ? state.refinements.get(defTeam)?.done : undefined, refinements, 'armor');
          // Phase 2: veterancy armor bonus — experienced defenders reduce incoming
          // damage by 5% per rank, stacking with refinement armor.
          const defRank = veterancyRank(target.components.experience?.kills ?? 0);
          const defVetBonus = 1 - 0.05 * defRank;
          let dmg = weapon.damage * mult * (1 + 0.15 * rank) * (1 + auraBonus) * atkBonus * defCut * defVetBonus;
          // Concord shields (XP-5): the absorb pool eats damage first, then hp.
          const sh = target.components.shield;
          if (sh && sh.hp > 0) {
            const absorbed = Math.min(sh.hp, dmg);
            sh.hp -= absorbed; dmg -= absorbed; sh.regenDelay = 100; // 5s out-of-combat
          }
          th.hp -= dmg;
          // Kill attribution → the shooter's experience (projectile kills unattributed v1).
          if (th.hp <= 0) {
            const xp = e.components.experience ?? { kills: 0, rank: 0 };
            xp.kills += 1;
            xp.rank = veterancyRank(xp.kills);
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
        // XP-5: spend a round.
        if (combat.ammo != null) combat.ammo -= 1;
      }
    },
  };
}
