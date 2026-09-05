// ── Ability system (W4): counts hero ability cooldowns down, expires rally buffs ──
// Runs in the 'ability' SYSTEM_ORDER slot (right after 'hero'). Pure: state + tick.
import type { SimState } from '../state.js';

export function makeAbilitySystem(): { name: 'ability'; run(state: SimState): void } {
  return {
    name: 'ability' as const,
    run(state: SimState): void {
      for (const e of state.store.all()) {
        const ab = e.components.ability;
        if (ab) {
          for (const key of Object.keys(ab.cooldowns)) {
            const left = ab.cooldowns[key] ?? 0;
            if (left > 0) ab.cooldowns[key] = left - 1;
          }
        }
        const buff = e.components.buff;
        if (buff && state.tick >= buff.dmgUntilTick) delete e.components.buff;
      }
    },
  };
}
