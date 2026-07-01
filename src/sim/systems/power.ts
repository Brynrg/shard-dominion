// ── Power system: base-wide supply vs demand → powered flag ────────────────────
// Runs after construction per SYSTEM_ORDER. Reads state only; does NOT construct anything.
import type { SimState } from '../state.js';

export function makePowerSystem(): { name: 'power'; run(state: SimState): void } {
  return {
    name: 'power' as const,
    run(state: SimState): void {
      // First pass: sum total supply and demand across all buildings
      let totalSupply = 0;
      let totalDemand = 0;

      for (const e of state.store.all()) {
        const power = e.components.power;
        if (power) {
          totalSupply += power.powerSupply;
          totalDemand += power.powerDemand;
        }
      }

      // Determine if base has enough power
      const basePowered = totalSupply >= totalDemand;

      // Second pass: set powered flag for all buildings
      for (const e of state.store.all()) {
        const building = e.components.building;
        if (building) {
          building.powered = basePowered;
        }
      }
    },
  };
}
