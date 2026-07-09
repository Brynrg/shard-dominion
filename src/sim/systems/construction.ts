// ── Construction system: build queue, drip-spend credits, ready structures ──────
// Runs after production per SYSTEM_ORDER. Reads state only; does NOT construct anything.
import type { SimState } from '../state.js';
import type { StructureDef } from '../../loaders/structures.js';
import { SIM_TICK_RATE } from '../loop.js';
import type { EntityId } from '../ids.js';
import type { EconomyComponent, PositionComponent } from '../components.js';
import type { CommandIntent } from '../../view/input.js';

/** Build queue entry. */
export interface BuildEntry {
  structureId: string;
  progress: number; // 0 to 100
}

/** Construction system output for the view. */
export interface ConstructionOutput {
  buildQueue: BuildEntry[];
  readyStructures: EntityId[];
}

export function makeConstructionSystem(
  structures: StructureDef[],
  commandQueue: { drain(): CommandIntent[] },
): { name: 'construction'; run(state: SimState): void; output: ConstructionOutput } {
  // Build a lookup map for structures
  const structureMap = new Map<string, StructureDef>();
  for (const s of structures) {
    structureMap.set(s.id, s);
  }

  // Build queue per ConYard
  const buildQueues = new Map<EntityId, BuildEntry[]>();

  // Ready structures to spawn (cleared each tick after processing)
  const readyStructures: EntityId[] = [];

  // Build progress per structure being built
  const buildProgress = new Map<EntityId, number>();

  return {
    name: 'construction' as const,
    output: { buildQueue: [], readyStructures: [] },
    run(state: SimState): void {
      // HQ tier upgrades (XP-1): tick every conyard's in-flight upgrade.
      for (const e of state.store.all()) {
        const t = e.components.tech;
        if (!t || t.upgradingTo == null) continue;
        const left = t.ticksLeft - 1;
        e.components.tech = left <= 0
          ? { tier: t.upgradingTo, upgradingTo: null, ticksLeft: 0 }
          : { ...t, ticksLeft: left };
      }

      // ── Repair pass (FG-2): toggled buildings heal over ~20s of full-hp time,
      // draining ~30% of the structure's cost per full heal from the team bank.
      // Auto-clears at full hp or an empty bank. Deterministic (no wall-clock).
      for (const e of state.store.all()) {
        const b = e.components.building; const h = e.components.health;
        if (!b?.repairing || !h) continue;
        if (h.hp >= h.maxHp) { b.repairing = false; continue; }
        const team = e.components.faction?.team;
        const bank = state.store.all().find(x => x.components.faction?.team === team && x.components.economy)?.components.economy;
        const def = structures.find(st => st.id === e.components.faction?.faction);
        const cost = def?.cost ?? 500;
        const healPerTick = h.maxHp / 400;                       // full heal ≈ 20s
        const creditPerTick = (cost * 0.3) / 400;                // ≈30% of cost per full heal
        if (!bank || bank.credits < creditPerTick) { b.repairing = false; continue; }
        bank.credits -= creditPerTick;
        h.hp = Math.min(h.maxHp, h.hp + healPerTick);
        if (h.hp >= h.maxHp) b.repairing = false;
      }

      readyStructures.length = 0;
      const outputQueue: BuildEntry[] = [];

      // First pass: find all ConYards and their build queues
      const conYards: { id: EntityId; pos: PositionComponent }[] = [];
      for (const e of state.store.all()) {
        const faction = e.components.faction;
        const building = e.components.building;
        const construction = e.components.construction;

        if (faction?.faction === 'construction_yard' && building && construction) {
          conYards.push({ id: e.id, pos: e.components.position! });
          if (!buildQueues.has(e.id)) {
            buildQueues.set(e.id, []);
          }
        }
      }

      // Second pass: process build queue for each ConYard
      for (const conYard of conYards) {
        const queue = buildQueues.get(conYard.id) ?? [];
        const economy = conYard.id in state.store.all().map((e) => e.id)
          ? state.store.get(conYard.id)?.components.economy as EconomyComponent | undefined
          : undefined;

        // Process the first item in queue (single build thread)
        if (queue.length > 0) {
          const entry = queue[0]!;
          const structure = structureMap.get(entry.structureId);
          if (!structure) {
            queue.shift(); // Remove invalid structure
            continue;
          }

          // Calculate build progress per tick
          const buildTimeTicks = structure.buildTimeSeconds * SIM_TICK_RATE;
          const progressPerTick = 100 / buildTimeTicks;

          // Drip-spend credits per tick
          const costPerTick = structure.cost / buildTimeTicks;

          // Check if we have enough credits
          if (economy?.credits && economy.credits >= costPerTick) {
            // Deduct credits
            economy.credits -= costPerTick;

            // Advance progress
            const currentProgress = buildProgress.get(conYard.id) ?? 0;
            const newProgress = Math.min(100, currentProgress + progressPerTick);
            buildProgress.set(conYard.id, newProgress);
            entry.progress = newProgress;

            // Check if build is complete
            if (newProgress >= 100) {
              // Mark as ready for spawning
              readyStructures.push(conYard.id);
              queue.shift(); // Remove from queue
              buildProgress.delete(conYard.id);
            }
          }
        }

        // Add to output queue for HUD
        for (const e of queue) {
          outputQueue.push({ structureId: e.structureId, progress: e.progress });
        }
      }

      // Third pass: process deploy and place-structure intents
      for (const intent of commandQueue.drain()) {
        if (intent.type === 'deploy') {
          // Deploy MCV to Construction Yard
          for (const e of state.store.all()) {
            const faction = e.components.faction;
            const position = e.components.position;
            if (faction?.faction === 'mcv' && position) {
              // Convert MCV to Construction Yard
              e.components.faction = { team: 'player', faction: 'construction_yard' };
              e.components.building = { onSlab: true, buildProgress: 100, powered: true };
              e.components.construction = { queue: [], progress: 0, currentStructureId: null };
              e.components.power = { powerSupply: 0, powerDemand: 0, powered: true };
              break;
            }
          }
        } else if (intent.type === 'place-structure' && intent.structureId && intent.tile) {
          // Try to place a structure
          const structure = structureMap.get(intent.structureId);
          if (!structure) continue;

          // Check if we have a ConYard with an active build queue
          let foundConYard = false;
          for (const conYard of conYards) {
            const queue = buildQueues.get(conYard.id) ?? [];
            if (queue.length > 0) {
              foundConYard = true;
              // Add to queue
              queue.push({ structureId: intent.structureId, progress: 0 });
              break;
            }
          }

          if (!foundConYard) {
            // No active build queue - try to start one from a ConYard
            for (const conYard of conYards) {
              const queue = buildQueues.get(conYard.id) ?? [];
              if (queue.length === 0) {
                queue.push({ structureId: intent.structureId, progress: 0 });
                break;
              }
            }
          }
        }
      }

      this.output = { buildQueue: outputQueue, readyStructures };
    },
  };
}
