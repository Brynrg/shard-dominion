// ── Victory system: cull dead units + decide win/lose ──────────────────────────
// Runs LAST in SYSTEM_ORDER (after audio). Pure sim: no DOM, no wall-clock.
import type { SimState } from '../state.js';

export interface VictoryResult { over: boolean; winner: 'player' | 'enemy' | null }
export interface VictorySystem { name: 'victory'; run(state: SimState): void; result: VictoryResult }

// The 'victory' system: (1) remove any unit at 0 HP (death); (2) once combat has
// begun, if one side has no living combat units AND no producers, record the winner.
// Sim-pure.
export function makeVictorySystem(): VictorySystem {
  const result: VictoryResult = { over: false, winner: null };
  let playerSeen = false;
  let enemySeen = false;

  return {
    name: 'victory' as const,
    result,
    run(state: SimState): void {
      // 2) census: LIVING combat units per side, and whether each side still owns a
      //    producer. Producers are usually buildings with NO combat component, so
      //    this check must NOT be gated behind the combat check.
      let player = 0, enemy = 0;
      let playerHasProducer = false;
      let enemyHasProducer = false;
      for (const e of state.store.all()) {
        const team = e.components.faction?.team;
        if (team !== 'player' && team !== 'enemy') continue;

        if (e.components.production) {
          if (team === 'player') playerHasProducer = true;
          else enemyHasProducer = true;
        }

        if (!e.components.combat) continue;
        const h = e.components.health;
        if (!h || h.hp <= 0) continue; // living only
        if (team === 'player') player += 1;
        else enemy += 1;
      }

      // Track "both seen" across ticks (before death phase to capture units that exist)
      // A side is "seen" if it has either combat units OR producers
      if (player > 0 || playerHasProducer) playerSeen = true;
      if (enemy > 0 || enemyHasProducer) enemySeen = true;

      // 1) DEATH: cull entities whose health has hit 0.
      for (const e of state.store.all()) {
        const h = e.components.health;
        if (h && h.hp <= 0) state.store.remove(e.id);
      }
      if (result.over) return; // decision is sticky

      // 3) decide ONLY once both sides have existed in the match (avoid a false win
      //    when only one side was ever seeded). Track "both seen" across ticks.
      const bothSidesSeen = playerSeen && enemySeen;
      // A side is defeated when it has NO living combat units AND NO producers
      if (bothSidesSeen && player === 0 && !playerHasProducer) { result.over = true; result.winner = 'enemy'; }
      else if (bothSidesSeen && enemy === 0 && !enemyHasProducer) { result.over = true; result.winner = 'player'; }
    },
  };
}
