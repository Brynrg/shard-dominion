// ── Regen system: Shardborn "living crystal" self-heal (faction identity) ──────
// A side whose faction carries `regen` slowly mends every living unit + structure it
// owns (out of nowhere — no credits, unlike building repair). Pure/deterministic:
// reads team→faction mods, writes health (folded into stateHash via hp).
import type { SimState } from '../state.js';
import type { TeamFactions } from '../factions.js';
import { SIM_TICK_RATE } from '../loop.js';

export interface RegenSystem { readonly name: 'regen'; run(state: SimState): void }

export function makeRegenSystem(teamFactions: TeamFactions): RegenSystem {
  const rate = (team: string): number => {
    const f = team === 'player' ? teamFactions.player : team === 'enemy' ? teamFactions.enemy : null;
    return f?.regen ?? 0;
  };
  return {
    name: 'regen' as const,
    run(state: SimState): void {
      for (const e of state.store.all()) {
        const team = e.components.faction?.team;
        if (!team) continue;
        const floor = rate(team);
        if (floor <= 0) continue;
        const h = e.components.health;
        if (!h || h.hp <= 0 || h.hp >= h.maxHp) continue;
        // Buildings under construction don't regen (they're still going UP).
        if (e.components.building && (e.components.building.buildProgress ?? 100) < 100) continue;
        const perSec = Math.max(floor, h.maxHp * 0.004); // flat floor or 0.4%/s of max
        h.hp = Math.min(h.maxHp, h.hp + perSec / SIM_TICK_RATE);
      }
    },
  };
}
