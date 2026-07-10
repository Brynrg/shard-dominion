// ── Production system: buildings buy units with real credits ────────────────────
// Runs after construction per SYSTEM_ORDER. Reads state only; does NOT construct anything.
import type { SimState } from '../state.js';
import type { UnitDef } from '../../loaders/units.js';
import { SIM_TICK_RATE } from '../loop.js';
import { worldToTile, tileToWorldCenter } from '../coords.js';
import { teamTier } from '../tech.js';
import type { EntityId } from '../ids.js';
import { unitComponents } from '../factory.js';
import { teamCredits, teamCells, spendCredits, spendCells } from '../ledger.js';
import { isOperational } from '../factory.js';
import { teamPowerShortage } from './power.js';
import { modCost, FACTIONS, type TeamFactions } from '../factions.js';

export function makeProductionSystem(units: readonly UnitDef[], factions?: TeamFactions, heroCarryKills = 0): { name: 'production'; run(state: SimState): void } {
  const factionFor = (team: string) => (team === 'player' ? (factions?.player ?? FACTIONS.concord) : (factions?.enemy ?? FACTIONS.concord));
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
        if (!isOperational(producer)) continue; // TP-3: scaffolding doesn't produce

        let job = active.get(producer.id);
        // start the next queued item if idle
        if (!job && prod.queue.length > 0) {
          const unitId = prod.queue[0]!;
          const def = units.find(u => u.id === unitId);
          if (!def) { producer.components.production = { ...prod, queue: prod.queue.slice(1) }; continue; }
          // Tech gate (XP-1): drop queued units above the team's HQ tier (sim-authoritative).
          if ((def.tier ?? 1) > teamTier(state, team as 'player' | 'enemy')) {
            producer.components.production = { ...prod, queue: prod.queue.slice(1) }; continue;
          }
          // Faction lock (XP-3): drop units another faction owns (e.g. Ghostwalker = Emberhand).
          if (def.factionLock && factionFor(team).id !== def.factionLock) {
            producer.components.production = { ...prod, queue: prod.queue.slice(1) }; continue;
          }
          // TP-2: pay from the TEAM LEDGER (all banks), not the first bank.
          const t2 = team as 'player' | 'enemy';
          const price = modCost(def.cost, factionFor(team)); // faction pricing (FG-6)
          const cellPrice = def.cellCost ?? 0;          // XP-2: elite units charge Cells too
          if (teamCredits(state, t2) < price || teamCells(state, t2) < cellPrice) continue; // PAUSED
          spendCredits(state, t2, price);               // pay ONCE, in full
          if (cellPrice > 0) spendCells(state, t2, cellPrice);
          job = { unitId, ticksLeft: Math.max(1, Math.round(def.buildTimeSeconds * SIM_TICK_RATE)) };
          active.set(producer.id, job);
          producer.components.production = { ...prod, queue: prod.queue.slice(1), progress: 0, current: unitId };
        }
        if (!job) continue;

        // Low power (FG-2): production runs at 60% speed — the build tick is
        // skipped on 2 of every 5 sim ticks. Deterministic (state.tick).
        if (teamPowerShortage(state, team) && state.tick % 5 < 2) continue;

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
          // Rally point (FG-1): fresh combat units move to the producer's rally;
          // harvesters ignore it and auto-mine (C&C behaviour).
          const rally = !isHarvester ? (producer.components.production?.rally ?? null) : null;
          const fm = factionFor(team);
          // CANONICAL factory (v0.42): produced units carry the exact same
          // components as seeded/triggered ones (flying, ammo, stealth, shields…).
          state.store.create({
            position: tileToWorldCenter({ tx: t.tx, ty: t.ty + 1 }),
            ...unitComponents(def, team as 'player' | 'enemy', fm, {
              target: rally,
              experienceKills: def.hero && team === 'player' ? heroCarryKills : 0,
            }),
          });
          active.delete(producer.id);
          producer.components.production = { ...producer.components.production!, progress: 0, current: null };
        }
      }
    },
  };
}
