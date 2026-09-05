/**
 * Neutral map-feature kinds accepted by the seeder.
 *
 * - derrick: credit income when captured
 * - relay: Cell income
 * - wreck: salvage cargo
 * - spore_tower: Act IV capturable anchor, no income
 */
export const NEUTRAL_KINDS = ['derrick', 'relay', 'wreck', 'spore_tower'] as const;
export type NeutralKind = (typeof NEUTRAL_KINDS)[number];

export function isNeutralKind(kind: string): kind is NeutralKind {
  return (NEUTRAL_KINDS as readonly string[]).includes(kind);
}
