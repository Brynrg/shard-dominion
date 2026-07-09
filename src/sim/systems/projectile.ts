// ── Projectile system: shells in flight → splash at impact (FG-3) ──────────────
// Fills the reserved 'projectile' SYSTEM_ORDER slot (after combatTargeting, before
// damage). damage.ts SPAWNS projectiles for SHELL/SIEGE weapons instead of applying
// instant damage; this system flies them to their captured impact point and
// detonates: matrix-scaled damage to every enemy within the splash radius. Dumb
// ballistic — the impact point is fixed at fire time, so fast units can dodge
// shells (the C&C feel: artillery punishes clumps and buildings, not dancers).
// Sim-pure and deterministic (no RNG; iteration in store order).
import type { SimState } from '../state.js';
import type { WeaponsFile } from '../../loaders/schemas.js';
import { TILE_SUBUNITS } from '../coords.js';
import { world } from '../coords.js';

export function makeProjectileSystem(weapons: WeaponsFile): { name: 'projectile'; run(state: SimState): void } {
  return {
    name: 'projectile' as const,
    run(state: SimState): void {
      for (const e of state.store.all()) {
        const proj = e.components.projectile;
        const pos = e.components.position;
        if (!proj || !pos) continue;

        const dx = proj.target.wx - pos.wx;
        const dy = proj.target.wy - pos.wy;
        const distSq = dx * dx + dy * dy;

        if (distSq > proj.speed * proj.speed) {
          // Still flying.
          const dist = Math.sqrt(distSq);
          e.components.position = world(pos.wx + (dx / dist) * proj.speed, pos.wy + (dy / dist) * proj.speed);
          continue;
        }

        // ── Impact: splash damage to enemies of the source team ──────────────
        const weapon = weapons.weapons[proj.weaponId];
        if (weapon) {
          const splashWorld = (weapon.splash ?? 0.6) * TILE_SUBUNITS; // shells get a small default splash
          for (const victim of state.store.all()) {
            const vf = victim.components.faction;
            const vh = victim.components.health;
            const vp = victim.components.position;
            if (!vf || !vh || !vp || vh.hp <= 0) continue;
            if (vf.team === proj.sourceTeam) continue; // no friendly fire (keeps AI sane)
            const d = Math.hypot(vp.wx - proj.target.wx, vp.wy - proj.target.wy);
            if (d > splashWorld) continue;
            const armor = victim.components.armor?.armorClass ?? 'NONE';
            const mult = weapons.matrix[weapon.type]?.[armor] ?? 1;
            vh.hp -= weapon.damage * mult;
          }
        }
        state.store.remove(e.id); // the shell is spent (view FX fire off the id vanishing)
      }
    },
  };
}
