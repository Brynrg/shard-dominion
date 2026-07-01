// ── Victory system: cull dead units + decide win/lose ──────────────────────────
// Runs LAST in SYSTEM_ORDER (after audio). Pure sim: no DOM, no wall-clock.
import type { SimState } from '../state.js';

export interface VictoryResult { over: boolean; winner: 'player' | 'enemy' | null }
export interface VictorySystem { name: 'victory'; run(state: SimState): void; result: VictoryResult }

// The 'victory' system: (1) remove any unit at 0 HP (death); (2) once combat has
// begun, if one side has no living combat units left, record the winner. Sim-pure.
export function makeVictorySystem(): VictorySystem {
  const result: VictoryResult = { over: false, winner: null };
  let playerSeen = false;
  let enemySeen = false;

  return {
    name: 'victory' as const,
    result,
    run(state: SimState): void {
      // 2) count LIVING combat units per side (a unit at 0 HP is dead, not counted).
      let player = 0, enemy = 0;
      for (const e of state.store.all()) {
        if (!e.components.combat) continue;
        const h = e.components.health;
        if (!h || h.hp <= 0) continue; // living only
        const team = e.components.faction?.team;
        if (team === 'player') player += 1;
        else if (team === 'enemy') enemy += 1;
      }

      // Track "both seen" across ticks (before death phase to capture units that exist)
      if (player > 0) playerSeen = true;
      if (enemy > 0) enemySeen = true;

      // 1) DEATH: cull entities whose health has hit 0.
      for (const e of state.store.all()) {
        const h = e.components.health;
        if (h && h.hp <= 0) state.store.remove(e.id);
      }
      if (result.over) return; // decision is sticky

      // 3) decide ONLY once both sides have existed in the match (avoid a false win
      //    when only one side was ever seeded). Track "both seen" across ticks.
      const bothSidesSeen = playerSeen && enemySeen;
      if (bothSidesSeen && player > 0 && enemy === 0) { result.over = true; result.winner = 'player'; }
      else if (bothSidesSeen && enemy > 0 && player === 0) { result.over = true; result.winner = 'enemy'; }
    },
  };
}
