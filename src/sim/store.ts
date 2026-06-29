// ── CONTRACT: EntityStore — the single source of truth for entities ──────────
// Units AND buildings are entities here, never separate arrays. The store
// assigns ids monotonically; `create` takes components only. Iteration is in
// ascending-id (== creation) order so any order-dependent state is
// deterministic and replay-safe.
import type { Components, Entity } from './components.js';
import { asEntityId, type EntityId } from './ids.js';

export interface EntityStore {
  /** Create an entity from components; the store assigns and returns the id. */
  create(components: Components): EntityId;
  get(id: EntityId): Entity | undefined;
  has(id: EntityId): boolean;
  remove(id: EntityId): void;
  /** All entities in ascending-id (creation) order — deterministic. */
  all(): readonly Entity[];
  count(): number;
}

export function makeEntityStore(): EntityStore {
  // Map preserves insertion order; ids are monotonic, so insertion order is
  // ascending id. A removed id is never reissued, so the invariant holds.
  const entities = new Map<number, Entity>();
  let nextId = 1;

  return {
    create(components: Components): EntityId {
      const id = asEntityId(nextId++);
      entities.set(id, { id, components });
      return id;
    },
    get(id: EntityId): Entity | undefined {
      return entities.get(id);
    },
    has(id: EntityId): boolean {
      return entities.has(id);
    },
    remove(id: EntityId): void {
      entities.delete(id);
    },
    all(): readonly Entity[] {
      return Array.from(entities.values());
    },
    count(): number {
      return entities.size;
    },
  };
}
