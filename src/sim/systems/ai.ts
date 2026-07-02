// ── AI decision loop system: build army then attack ─────────────────────────────
// Runs after production per SYSTEM_ORDER. Reads state only; does NOT construct anything.
import type { SimState } from '../state.js';
import type { UnitDef } from '../../loaders/units.js';
import { tileToWorldCenter, type TilePos } from '../coords.js';

export interface AiConfig {
  team: 'enemy';
  unitId: string;        // what it builds (e.g. 'infantry')
  armySize: number;      // attack when this many living combat units (e.g. 3)
  attackTile: TilePos;   // the player start area it assaults
}

// The 'ai' system: (1) ECONOMY — if the AI team's producer is idle (empty queue)
// and the team can afford the unit, queue one (the production system pays+builds).
// (2) ATTACK — count the team's living combat units; at armySize, order them all
// to move on the attack tile (movement.target; combatTargeting takes over in range).
// Sim-pure: no DOM/Date/Math.random.
export function makeAiSystem(units: readonly UnitDef[], cfg: AiConfig): { name: 'ai'; run(state: SimState): void } {
  const def = units.find(u => u.id === cfg.unitId);
  let attacking = false;
  return {
    name: 'ai' as const,
    run(state: SimState): void {
      if (!def) return;

      // team credits (first economy entity on the AI team)
      const bank = state.store.all().find(e => e.components.faction?.team === cfg.team && e.components.economy)?.components.economy;

      // (1) keep the producer busy
      for (const e of state.store.all()) {
        const prod = e.components.production;
        if (!prod || e.components.faction?.team !== cfg.team) continue;
        if (prod.queue.length === 0 && bank && bank.credits >= def.cost) {
          e.components.production = { ...prod, queue: [cfg.unitId] }; // replace, queue is readonly
        }
      }

      // (2) muster + attack
      const army = state.store.all().filter(e =>
        e.components.faction?.team === cfg.team && e.components.combat &&
        (e.components.health?.hp ?? 0) > 0 && e.components.movement);
      if (!attacking && army.length >= cfg.armySize) attacking = true;
      if (attacking) {
        const target = tileToWorldCenter(cfg.attackTile);
        for (const u of army) {
          if (u.components.movement && u.components.movement.target === null && u.components.combat?.targetId === null) {
            u.components.movement.target = target; // march; targeting overrides in range
          }
        }
      }
    },
  };
}
