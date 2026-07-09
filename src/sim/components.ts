// ── CONTRACT: the ONE entity shape ───────────────────────────────────────────
// An entity is `{ id, components }` with EXACTLY one nesting level under
// `components` — `entity.components.<componentKey>`, never a wrapper and never
// `entity.components.components`. A component's own fields (e.g. position.wx)
// are not "deeper nesting"; the banned thing is re-wrapping the bag. The store
// (store.ts) assigns the id — callers never pass one. This kills the
// double-nesting bug (`create({ id, components })`) by construction.
import type { WorldPos } from './coords.js';
import type { EntityId } from './ids.js';

/** Faction component carries a team (for friendly-fire / targeting) + faction id. */
export type Team = 'player' | 'enemy' | 'neutral';

export type PositionComponent = WorldPos; // { wx, wy } in WORLD fixed-point
export interface VelocityComponent { vx: number; vy: number } // world units / tick
export interface HealthComponent { hp: number; maxHp: number }
export interface FactionComponent { team: Team; faction: string }
export interface MovementComponent {
  target: WorldPos | null;
  path: readonly WorldPos[];
  speed: number;
  /** The target the current `path` was computed for — movement recomputes the path
   *  when target no longer matches (orders can retarget at any time). Additive (FG-1). */
  pathGoal?: WorldPos | null;
  /** Attack-move: while set, the unit HOLDS to fight whatever combatTargeting
   *  acquires en route, resuming toward `target` when the target dies/leaves.
   *  A plain move order clears it (forced move). Additive (FG-1). */
  attackMove?: boolean;
}
export interface ResourceComponent { cargo: number; capacity: number } // harvester
export interface CombatComponent { weaponId: string | null; cooldownRemaining: number; targetId: EntityId | null }
export interface ExperienceComponent { kills: number; rank: number } // veterancy (dormant by default)
export interface RenderableComponent { spriteId: string }
export interface BuildingComponent {
  onSlab: boolean;
  buildProgress: number;
  powered: boolean;
  /** Repair toggle (FG-2): while set and damaged, hp regenerates and credits drain
   *  (construction system). Cleared automatically at full hp / empty bank. Additive. */
  repairing?: boolean;
}
export interface ProductionComponent {
  queue: readonly string[];
  progress: number;
  current?: string | null;
  /** Rally point: freshly-produced combat units move here (harvesters auto-mine
   *  instead, C&C-style). Set by right-clicking ground with the producer selected.
   *  Additive (FG-1). */
  rally?: WorldPos | null;
}

/** Economy component for credits and storage. */
export interface EconomyComponent {
  credits: number;
  refineryStorage: number;
  maxStorage: number;
}

/** Harvest component for FSM state. IDLE = FSM suspended (e.g. by a manual move order). */
export interface HarvestComponent {
  state: 'SEEK' | 'HARVEST' | 'RETURN' | 'DOCK' | 'IDLE';
  targetTile: { tx: number; ty: number } | null;
  targetRefinery: EntityId | null;
  cargo: number;
}

/** Selection component - additive field on entities. */
export interface SelectionComponent {
  selected: boolean;
}

/** Armor component - additive field on entities. */
export interface ArmorComponent {
  armorClass: import('./combat-types.js').ArmorClass;
}

/** Construction component for build queue and progress. */
export interface ConstructionComponent {
  queue: readonly string[]; // structure IDs to build
  progress: number; // 0 to 100
  currentStructureId: string | null;
}

/** Power component for supply/demand tracking. */
export interface PowerComponent {
  powerSupply: number;
  powerDemand: number;
  powered: boolean;
}

/** The component bag. All optional: an entity has only the components it needs. */
export interface Components {
  position?: PositionComponent;
  velocity?: VelocityComponent;
  health?: HealthComponent;
  faction?: FactionComponent;
  movement?: MovementComponent;
  resource?: ResourceComponent;
  combat?: CombatComponent;
  experience?: ExperienceComponent;
  renderable?: RenderableComponent;
  building?: BuildingComponent;
  production?: ProductionComponent;
  economy?: EconomyComponent;
  harvest?: HarvestComponent;
  selection?: SelectionComponent;
  armor?: ArmorComponent;
  construction?: ConstructionComponent;
  power?: PowerComponent;
}

export type ComponentKey = keyof Components;

export interface Entity {
  readonly id: EntityId;
  readonly components: Components;
}
