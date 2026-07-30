// ── AI knowledge model: what the AI is ALLOWED to know (Phase B4) ──────────────
// Before this, the AI read `state.store.all()` directly and was therefore fully
// omniscient — it knew your composition, your bank and your harvester's position
// through solid fog, so scouting had no purpose and map control had no reward.
//
// The AI now sees only what its own units and buildings can see, and REMEMBERS what
// it last saw. Structures are remembered permanently once spotted (you don't forget
// where a base is); mobile units fade out of memory after MEMORY_SECONDS.
//
// Sim-pure: state only, no DOM/Date/Math.random. All iteration is over the store's
// stable order and all maps are keyed by entity id, so replays stay bit-identical.
import type { SimState } from '../state.js';
import { worldToTile, TILE_SUBUNITS, type WorldPos } from '../coords.js';
import { SIM_TICK_RATE } from '../loop.js';
import type { EntityId } from '../ids.js';
import type { UnitDef } from '../../loaders/units.js';

/** Vision radius in tiles — matches the player's fog vision (fog.ts). */
export const AI_VISION_TILES = 6;
/** How long a mobile contact stays in memory after it drops out of sight. */
const MEMORY_SECONDS = 20;

export interface KnownEnemy {
  id: EntityId;
  kind: string;
  /** Last-known position — NOT necessarily where it is now. */
  pos: WorldPos;
  armorClass: string;
  isBuilding: boolean;
  isHarvester: boolean;
  isProducer: boolean;
  isFlying: boolean;
  /** Credit value, used for threat math. */
  value: number;
  lastSeenTick: number;
  /** True only while actually inside the AI's vision this tick. */
  visibleNow: boolean;
}

export interface AiKnowledge {
  /** Recompute vision + fold new sightings into memory. Call once per evaluation. */
  update(state: SimState): void;
  /** Everything the AI currently believes about the enemy. */
  readonly contacts: ReadonlyMap<EntityId, KnownEnemy>;
  /** Tile keys the AI can see right now. */
  readonly visible: ReadonlySet<string>;
  /** Believed hostile combat value within `radiusTiles` of a point. */
  threatNear(pos: WorldPos, radiusTiles: number): number;
  /** Believed hostile contacts within `radiusTiles`, freshest first by store order. */
  near(pos: WorldPos, radiusTiles: number): KnownEnemy[];
  /** Has the AI ever seen an enemy production/construction building? */
  knownProducers(): KnownEnemy[];
  /** Believed composition of the enemy army by armour class (Phase B5). */
  composition(): { light: number; armored: number; air: number };
}

export function makeAiKnowledge(
  team: 'player' | 'enemy',
  units: readonly UnitDef[],
): AiKnowledge {
  const contacts = new Map<EntityId, KnownEnemy>();
  const visible = new Set<string>();
  const costOf = (id: string): number => units.find(u => u.id === id)?.cost ?? 0;
  const memoryTicks = MEMORY_SECONDS * SIM_TICK_RATE;

  return {
    contacts,
    visible,
    update(state: SimState): void {
      // 1) Vision: every own entity lights a circle of AI_VISION_TILES.
      visible.clear();
      const eyes: { tx: number; ty: number }[] = [];
      for (const e of state.store.all()) {
        if (e.components.faction?.team !== team) continue;
        const p = e.components.position;
        if (!p) continue;
        eyes.push(worldToTile(p));
      }
      for (const t of eyes) {
        const r = AI_VISION_TILES;
        for (let ty = Math.max(0, t.ty - r); ty <= Math.min(state.grid.height - 1, t.ty + r); ty++) {
          for (let tx = Math.max(0, t.tx - r); tx <= Math.min(state.grid.width - 1, t.tx + r); tx++) {
            const dx = tx - t.tx, dy = ty - t.ty;
            if (dx * dx + dy * dy <= r * r) visible.add(`${tx},${ty}`);
          }
        }
      }

      // 2) Fold in what is visible now. A cloaked unit is NOT seen (stealth has to
      //    mean something against the AI too).
      for (const c of contacts.values()) c.visibleNow = false;
      for (const e of state.store.all()) {
        const f = e.components.faction;
        if (!f || f.team === team || f.team === 'neutral') continue;
        if ((e.components.health?.hp ?? 0) <= 0) continue;
        if (e.components.stealth?.cloaked) continue;
        const p = e.components.position;
        if (!p) continue;
        const t = worldToTile(p);
        if (!visible.has(`${t.tx},${t.ty}`)) continue;
        contacts.set(e.id, {
          id: e.id,
          kind: f.faction,
          pos: { wx: p.wx, wy: p.wy },
          armorClass: e.components.armor?.armorClass ?? 'NONE',
          isBuilding: !!e.components.building,
          isHarvester: !!e.components.harvest,
          isProducer: !!(e.components.production ?? e.components.construction),
          isFlying: !!e.components.movement?.flying,
          value: costOf(f.faction),
          lastSeenTick: state.tick,
          visibleNow: true,
        });
      }

      // 3) Forget: a contact confirmed DEAD (visible tile, entity gone) drops
      //    immediately; a mobile contact that merely wandered off fades after
      //    MEMORY_SECONDS; buildings are remembered for good.
      for (const [id, c] of [...contacts.entries()]) {
        const still = state.store.get(id);
        const alive = !!still && (still.components.health?.hp ?? 1) > 0;
        const t = worldToTile(c.pos);
        const canSeeItsLastSpot = visible.has(`${t.tx},${t.ty}`);
        if (!alive && canSeeItsLastSpot) { contacts.delete(id); continue; }
        if (c.isBuilding) continue; // permanent map knowledge
        if (!c.visibleNow && state.tick - c.lastSeenTick > memoryTicks) contacts.delete(id);
      }
    },
    threatNear(pos: WorldPos, radiusTiles: number): number {
      const r = radiusTiles * TILE_SUBUNITS;
      let total = 0;
      for (const c of contacts.values()) {
        if (c.isBuilding || c.isHarvester) continue; // static/economy isn't an assault
        if (Math.hypot(c.pos.wx - pos.wx, c.pos.wy - pos.wy) > r) continue;
        total += Math.max(c.value, 50); // an unknown-cost contact still counts for something
      }
      return total;
    },
    near(pos: WorldPos, radiusTiles: number): KnownEnemy[] {
      const r = radiusTiles * TILE_SUBUNITS;
      const out: KnownEnemy[] = [];
      for (const c of contacts.values()) {
        if (Math.hypot(c.pos.wx - pos.wx, c.pos.wy - pos.wy) <= r) out.push(c);
      }
      return out;
    },
    knownProducers(): KnownEnemy[] {
      const out: KnownEnemy[] = [];
      for (const c of contacts.values()) if (c.isProducer) out.push(c);
      return out;
    },
    composition(): { light: number; armored: number; air: number } {
      let light = 0, armored = 0, air = 0;
      for (const c of contacts.values()) {
        if (c.isBuilding || c.isHarvester) continue;
        // Classify by ARMOUR CLASS, not by a faction-id string match. The old code
        // compared `faction === 'vehicle'`, which only matched one legacy unit, so
        // every tank and scout was miscounted as infantry.
        if (c.armorClass === 'AIR' || c.isFlying) air++;
        else if (c.armorClass === 'MEDIUM' || c.armorClass === 'HEAVY') armored++;
        else light++;
      }
      return { light, armored, air };
    },
  };
}
