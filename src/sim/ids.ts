// ── CONTRACT: branded ids ─────────────────────────────────────────────────
// A nominal brand so an EntityId can't be silently passed where a Tick is
// expected (or a raw number where an id is expected). Erased at runtime.
export type Brand<T, B extends string> = T & { readonly __brand: B };

export type EntityId = Brand<number, 'EntityId'>;
export type Tick = Brand<number, 'Tick'>;

export const asEntityId = (n: number): EntityId => n as EntityId;
export const asTick = (n: number): Tick => n as Tick;
