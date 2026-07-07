// ── AI decision loop: keep producing + attack in continuous waves (S6B) ─────────
// Runs after production per SYSTEM_ORDER. Reads/commands only; constructs nothing.
// Sim-pure: no DOM/Date/Math.random.
import type { SimState } from '../state.js';
import type { UnitDef } from '../../loaders/units.js';
import { tileToWorldCenter, type TilePos } from '../coords.js';
import type { EntityId } from '../ids.js';

export interface AiConfig {
  team: 'enemy';
  unitId: string;        // what it builds (e.g. 'infantry')
  armySize: number;      // send a wave once this many fresh combat units exist
  attackTile: TilePos;   // the player start area it assaults
}

// The 'ai' system:
// (1) ECONOMY — if the AI team's producer is idle and it can afford the unit, queue one.
// (2) WAVES — accumulate newly-built combat units; each time `armySize` fresh (never-yet-
//     sent) units exist, order that batch to march on the attack tile and mark them
//     dispatched. Committed units are never re-ordered here (combatTargeting owns them in
//     range); dead units are pruned so the set can't grow unbounded. Result: sustained,
//     rolling pressure instead of a single one-shot attack.
export function makeAiSystem(units: readonly UnitDef[], cfg: AiConfig): { name: 'ai'; run(state: SimState): void } {
  const def = units.find(u => u.id === cfg.unitId);
  const dispatched = new Set<EntityId>();

  return {
    name: 'ai' as const,
    run(state: SimState): void {
      if (!def) return;

      // (1) keep the producer busy
      const bank = state.store.all().find(e => e.components.faction?.team === cfg.team && e.components.economy)?.components.economy;
      for (const e of state.store.all()) {
        const prod = e.components.production;
        if (!prod || e.components.faction?.team !== cfg.team) continue;
        if (prod.queue.length === 0 && bank && bank.credits >= def.cost) {
          e.components.production = { ...prod, queue: [cfg.unitId] }; // replace; queue is readonly
        }
      }

      // (2) continuous attack waves with rolling reinforcement
      const army = state.store.all().filter(e =>
        e.components.faction?.team === cfg.team &&
        e.components.combat &&
        (e.components.health?.hp ?? 0) > 0 &&
        e.components.movement,
      );

      // Prune the dispatched set: drop ids that are no longer living army units.
      for (const id of dispatched) {
        if (!army.some(u => u.id === id)) dispatched.delete(id);
      }

      const fresh = army.filter(u => !dispatched.has(u.id));

      if (fresh.length >= cfg.armySize) {
        const target = tileToWorldCenter(cfg.attackTile);
        const wave = fresh.slice(0, cfg.armySize);
        for (const u of wave) {
          if (u.components.movement?.target === null && u.components.combat?.targetId === null) {
            u.components.movement.target = target; // march; targeting overrides in range
            dispatched.add(u.id);
          }
        }
      }
    },
  };
}
