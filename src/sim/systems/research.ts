// ── Research system: advance in-progress refinements (economy depth) ───────────
// Pure/deterministic: reads + writes only state.refinements. The command system
// starts a research (spends credits/Cells, sets researching + ticksLeft); this
// system counts it down and moves it to `done` on completion. Effects are applied
// point-of-use by damage/harvest/planetEvent, keyed off `done`.
import type { SimState } from '../state.js';

export interface ResearchSystem { readonly name: 'research'; run(state: SimState): void }

export function makeResearchSystem(): ResearchSystem {
  return {
    name: 'research' as const,
    run(state: SimState): void {
      for (const led of state.refinements.values()) {
        if (!led.researching || led.ticksLeft <= 0) continue;
        led.ticksLeft -= 1;
        if (led.ticksLeft <= 0) {
          if (!led.done.includes(led.researching)) led.done.push(led.researching);
          led.researching = null;
          led.ticksLeft = 0;
        }
      }
    },
  };
}

/** Get-or-create a team's refinement ledger (used by the command system). */
export function teamLedger(state: SimState, team: string): SimState['refinements'] extends Map<string, infer L> ? L : never {
  let led = state.refinements.get(team);
  if (!led) { led = { done: [], researching: null, ticksLeft: 0 }; state.refinements.set(team, led); }
  return led;
}
