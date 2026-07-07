// ── Production system: buildings buy units with real credits ────────────────────
// Runs after construction per SYSTEM_ORDER. Reads state only; does NOT construct anything.
import type { SimState } from '../state.js';
import type { UnitDef } from '../../loaders/units.js';
import { SIM_TICK_RATE } from '../loop.js';
import { worldToTile, tileToWorldCenter } from '../coords.js';
import type { EntityId } from '../ids.js';

export function makeProductionSystem(units: readonly UnitDef[]): { name: 'production'; run(state: SimState): void } {
  // Progress state per producer entity id — MUST live in the factory closure (one
  // per sim), not at module scope, or jobs leak across sims/matches and break
  // determinism (module-scope version caused free spawns under reused entity ids).
  const active = new Map<EntityId, { unitId: string; ticksLeft: number }>();
  return {
    name: 'production' as const,
    run(state: SimState): void {
      for (const producer of state.store.all()) {
        const prod = producer.components.production;
        const pos = producer.components.position;
        const team = producer.components.faction?.team;
        if (!prod || !pos || !team) continue;

        let job = active.get(producer.id);
        // start the next queued item if idle
        if (!job && prod.queue.length > 0) {
          const unitId = prod.queue[0]!;
          const def = units.find(u => u.id === unitId);
          if (!def) { producer.components.production = { ...prod, queue: prod.queue.slice(1) }; continue; }
          // find the team's credits pool
          const bank = state.store.all().find(e => e.components.faction?.team === team && e.components.economy)?.components.economy;
          if (!bank || bank.credits < def.cost) continue; // PAUSED — insufficient credits
          bank.credits -= def.cost;                        // pay ONCE, in full
          job = { unitId, ticksLeft: Math.max(1, Math.round(def.buildTimeSeconds * SIM_TICK_RATE)) };
          active.set(producer.id, job);
          producer.components.production = { ...prod, queue: prod.queue.slice(1), progress: 0, current: unitId };
        }
        if (!job) continue;

        job.ticksLeft -= 1;
        const def = units.find(u => u.id === job.unitId);
        if (def) {
          const total = Math.max(1, Math.round(def.buildTimeSeconds * SIM_TICK_RATE));
          producer.components.production = { ...producer.components.production!, progress: Math.round(100 * (1 - job.ticksLeft / total)) };
        }
        if (job.ticksLeft <= 0 && def) {
          // spawn adjacent (one tile south of the producer). Harvesters get a harvest
          // FSM (they auto-mine); everything else gets a combat component.
          const t = worldToTile(pos);
          const isHarvester = def.id === 'harvester';
          state.store.create({
            position: tileToWorldCenter({ tx: t.tx, ty: t.ty + 1 }),
            health: { hp: def.hp, maxHp: def.hp },
            armor: { armorClass: def.armorClass },
            movement: { target: null, path: [], speed: def.speed },
            faction: { team, faction: def.id },
            ...(isHarvester
              ? { harvest: { state: 'SEEK' as const, targetTile: null, targetRefinery: null, cargo: 0 } }
              : { combat: { weaponId: def.weaponId, cooldownRemaining: 0, targetId: null } }),
          });
          active.delete(producer.id);
          producer.components.production = { ...producer.components.production!, progress: 0, current: null };
        }
      }
    },
  };
}
