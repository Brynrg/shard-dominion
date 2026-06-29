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
export interface MovementComponent { target: WorldPos | null; path: readonly WorldPos[]; speed: number }
export interface ResourceComponent { cargo: number; capacity: number } // harvester
export interface CombatComponent { weaponId: string | null; cooldownRemaining: number; targetId: EntityId | null }
export interface ExperienceComponent { kills: number; rank: number } // veterancy (dormant by default)
export interface RenderableComponent { spriteId: string }
export interface BuildingComponent { onSlab: boolean; buildProgress: number; powered: boolean }
export interface ProductionComponent { queue: readonly string[]; progress: number }

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
}

export type ComponentKey = keyof Components;

export interface Entity {
  readonly id: EntityId;
  readonly components: Components;
}
