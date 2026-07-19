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
      // ── RA build flow (v0.55): tick the per-team SIDEBAR structure jobs. Low
      // power halves construction speed (the RA manual's low-power penalty).
      for (const team of ['player', 'enemy']) {
        const job = state.structureBuild.get(team);
        if (!job || job.ticksLeft <= 0) continue;
        let supply = 0, demand = 0;
        for (const e of state.store.all()) {
          if (e.components.faction?.team !== team) continue;
          const pw = e.components.power;
          if (pw) { supply += pw.powerSupply; demand += pw.powerDemand; }
        }
        // Deterministic half-rate: skip every other tick while underpowered.
        if (supply < demand && state.tick % 2 === 0) continue;
        job.ticksLeft = Math.max(0, job.ticksLeft - 1);
      }

      // ── TP-3: construction SITES build up in real time. Placement spawns a
      // building at buildProgress 0 / 20% hp; this pass advances progress per the
      // def's buildTimeSeconds and grows hp toward max. At 100 it's operational
      // (production/power/turret systems gate on isOperational).
      // v0.55: a site placed from a READY sidebar job served its build time in the
      // sidebar already — on the field it only UNFOLDS (~3s, RA-style).
      for (const site of state.store.all()) {
        const b = site.components.building;
        const h = site.components.health;
        if (!b || !h || b.buildProgress >= 100) continue;
        if ((h.hp ?? 0) <= 0) continue;
        const kind = site.components.faction?.faction ?? '';
        const def = structureMap.get(kind);
        const seconds = b.unfoldFast ? 3 : (def?.buildTimeSeconds ?? 10);
        const step = 100 / (seconds * 20);
        b.buildProgress = Math.min(100, b.buildProgress + step);
        // hp climbs from the 20% scaffold toward max alongside progress.
        const targetHp = Math.max(h.hp, h.maxHp * (0.2 + 0.8 * (b.buildProgress / 100)));
        h.hp = Math.min(h.maxHp, targetHp);
        if (b.buildProgress >= 100) b.buildProgress = 100;
      }

      // Aura addons (XP-4): infirmaries heal nearby own infantry, machine shops
      // heal own vehicles (1.5 hp/s within 3 tiles; needs power).
      for (const src of state.store.all()) {
        const kind = src.components.faction?.faction;
        if (kind !== 'infirmary' && kind !== 'machine_shop') continue;
        if ((src.components.health?.hp ?? 0) <= 0) continue;
        if (src.components.power && src.components.power.powered === false) continue;
        const sp = src.components.position; const team = src.components.faction?.team;
        if (!sp || !team) continue;
        const R = 3 * 256; const RATE = 1.5 / 20;
        for (const u of state.store.all()) {
          if (u.components.faction?.team !== team || u.components.building) continue;
          const h = u.components.health; const up = u.components.position;
          if (!h || !up || h.hp <= 0 || h.hp >= h.maxHp) continue;
          const cls = u.components.armor?.armorClass;
          const wants = kind === 'infirmary' ? cls === 'LIGHT' : (cls === 'MEDIUM' || cls === 'HEAVY');
          if (!wants) continue;
          const dx = up.wx - sp.wx, dy = up.wy - sp.wy;
          if (dx * dx + dy * dy <= R * R) h.hp = Math.min(h.maxHp, h.hp + RATE);
        }
      }

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
