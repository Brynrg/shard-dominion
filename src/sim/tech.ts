// ── HQ tech tiers (XP-1) ────────────────────────────────────────────────────────
// A team's tech tier = the highest tier across its living Construction Yards
// (no conyard → tier 1: you can still use what you have, not advance).
import type { SimState } from './state.js';

export function teamTier(state: SimState, team: 'player' | 'enemy'): number {
  let tier = 1;
  for (const e of state.store.all()) {
    if (e.components.faction?.team !== team) continue;
    if (!e.components.tech) continue;
    if ((e.components.health?.hp ?? 1) <= 0) continue;
    tier = Math.max(tier, e.components.tech.tier);
  }
  return tier;
}
