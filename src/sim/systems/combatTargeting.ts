// ── Combat targeting system: pick nearest in-range enemy ──────────────────────
// Runs in SYSTEM_ORDER before damage (so damage sees the target this sets).
// Pure sim: no DOM, no wall-clock, no screen concepts.
import type { SimState } from '../state.js';
import { isOperational } from '../factory.js';
import type { WeaponsFile } from '../../loaders/schemas.js';
import { refinementValue, type Refinement } from '../../loaders/refinements.js';
import { TILE_SUBUNITS } from '../coords.js';
import type { WorldPos } from '../coords.js';
import type { EntityId } from '../ids.js';

function distance(a: WorldPos, b: WorldPos): number { return Math.hypot(a.wx - b.wx, a.wy - b.wy); }

// The 'combatTargeting' system: each armed unit keeps a valid target, or picks the
// NEAREST living enemy within weapon range. Sim-pure (state only).
export function makeCombatTargetingSystem(weapons: WeaponsFile, refinements: readonly Refinement[] = []): { name: 'combatTargeting'; run(state: SimState): void } {
  return {
    name: 'combatTargeting' as const,
    run(state: SimState): void {
      for (const e of state.store.all()) {
        const combat = e.components.combat;
        const pos = e.components.position;
        const faction = e.components.faction;
        if (!combat || !pos || !faction || combat.weaponId === null) continue;
        if (e.components.building && !isOperational(e)) { combat.targetId = null; continue; } // TP-3
        // Stances (XP-4): hold-fire never acquires (and drops any current target).
        if (combat.stance === 'hold') { combat.targetId = null; continue; }

        const weapon = weapons.weapons[combat.weaponId];
        if (!weapon) continue;
        // Defensive stance (XP-4): only engage well inside range (no edge-chasing).
        // Refinement `range` (Extended Range) widens acquisition — the effect was
        // parsed and applied NOWHERE before Phase C2, making that refinement a no-op.
        const rangeBonus = 1 + refinementValue(state.refinements.get(faction.team)?.done, refinements, 'range');
        const rangeWorld = weapon.range * TILE_SUBUNITS * rangeBonus * (combat.stance === 'defensive' ? 0.7 : 1);
        const minRangeWorld = (weapon.minRange ?? 0) * TILE_SUBUNITS;

        // 1) If the current target is still valid (exists, alive, in range), keep it.
        const cur = combat.targetId !== null ? state.store.get(combat.targetId) : undefined;
        const curHealth = cur?.components.health;
        const curPos = cur?.components.position;
        if (cur && curHealth && curHealth.hp > 0 && curPos && distance(pos, curPos) <= rangeWorld
            && !cur.components.stealth?.cloaked) { // XP-3: a target that cloaks is LOST
          continue;
        }

        // 2) Otherwise scan for the nearest LIVING ENEMY (different team) in range.
        // Phase 2 enhancement: threat matrix prioritizes turrets > mobile units > harvesters.
        let bestId: EntityId | null = null;
        let bestScore = Infinity;
        for (const other of state.store.all()) {
          if (other.id === e.id) continue;
          const of = other.components.faction; const oh = other.components.health; const op = other.components.position;
          if (!of || !oh || !op) continue;
          if (of.team === faction.team) continue;   // skip allies
          if (of.team === 'neutral' && !other.components.combat) continue; // passive neutrals (derricks) aren't targets
          if (oh.hp <= 0) continue;                  // skip dead
          if (other.components.stealth?.cloaked) continue; // XP-3: can't target the unseen
          // Air (XP-5): a weapon whose matrix does nothing vs AIR never targets flyers.
          const oc = other.components.armor?.armorClass;
          if (oc === 'AIR' && (weapons.matrix[weapon.type]?.AIR ?? 0) <= 0) continue;
          const d = distance(pos, op);
          if (d < minRangeWorld) continue; // artillery ignores what's under its barrel
          if (d > rangeWorld) continue;    // range is a hard bound (true distance)

          // Phase 2 threat matrix: turrets/AA > mobile combat > harvesters/passives
          // Multipliers apply per-category: lower = higher priority
          const isTurret = other.components.building && other.components.combat;
          const isMobileCombat = other.components.combat && !other.components.building && !other.components.harvest;
          const isHarvester = other.components.harvest;

          let threatMult = 1.0;
          if (isTurret) threatMult = 0.7;           // turrets are 30% "closer" — high priority
          else if (isMobileCombat) threatMult = 1.0; // mobile units: standard
          else if (isHarvester) threatMult = 1.5;   // harvesters: deprioritized
          else threatMult = 1.5;                     // other passives: also deprioritized

          const score = d * threatMult;
          if (score < bestScore) { bestScore = score; bestId = other.id; }
        }
        combat.targetId = bestId; // null clears the target when nothing is in range
      }
    },
  };
}
