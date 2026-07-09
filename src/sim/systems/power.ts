// ── Power system: PER-TEAM supply vs demand → powered flags (FG-2) ─────────────
// Runs after construction per SYSTEM_ORDER. Reads state only; does NOT construct
// anything. Was global (both teams pooled — a latent bug); now each team's grid
// stands alone, and low power imposes soft penalties (production slowdown in
// production.ts, turret fire-rate in damage.ts) — never a full shutdown.
import type { SimState } from '../state.js';

/** Team power balance: supply − demand < 0 ⇒ shortage (soft penalties apply). */
export function teamPowerShortage(state: SimState, team: string): boolean {
  let supply = 0, demand = 0;
  for (const e of state.store.all()) {
    if (e.components.faction?.team !== team) continue;
    const p = e.components.power;
    if (p) { supply += p.powerSupply; demand += p.powerDemand; }
  }
  return supply < demand;
}

export function makePowerSystem(): { name: 'power'; run(state: SimState): void } {
  return {
    name: 'power' as const,
    run(state: SimState): void {
      // Per-team totals (a building powers only its own side).
      const supply = new Map<string, number>();
      const demand = new Map<string, number>();
      for (const e of state.store.all()) {
        const p = e.components.power;
        const team = e.components.faction?.team;
        if (!p || !team) continue;
        supply.set(team, (supply.get(team) ?? 0) + p.powerSupply);
        demand.set(team, (demand.get(team) ?? 0) + p.powerDemand);
      }
      for (const e of state.store.all()) {
        const building = e.components.building;
        const team = e.components.faction?.team;
        if (!building || !team) continue;
        building.powered = (supply.get(team) ?? 0) >= (demand.get(team) ?? 0);
      }
    },
  };
}
