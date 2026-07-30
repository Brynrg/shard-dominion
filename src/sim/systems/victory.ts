// ── Victory system: cull dead units + decide win/lose ──────────────────────────
// Runs LAST in SYSTEM_ORDER (after audio). Pure sim: no DOM, no wall-clock.
import type { SimState } from '../state.js';
import type { UnitDef } from '../../loaders/units.js';
import { makeDefeatTracker, surrender } from '../defeat.js';

export interface VictoryResult {
  over: boolean;
  winner: 'player' | 'enemy' | null;
  /** Units cleared by the loser's surrender (Phase A4) — 0 until the match ends. */
  surrendered?: number;
}
export interface VictorySystem { name: 'victory'; run(state: SimState): void; result: VictoryResult }

// The 'victory' system: (1) remove any unit at 0 HP (death); (2) once combat has
// begun, if one side has no living combat units AND no producers, record the winner.
// Sim-pure.
export function makeVictorySystem(units: readonly UnitDef[] = []): VictorySystem {
  // XP-2 salvage: kinds that die into wrecks, worth ~30% of cost.
  const wreckValue = new Map<string, number>();
  for (const u of units) if (u.leavesWreck) wreckValue.set(u.id, Math.round(u.cost * 0.3));
  const result: VictoryResult = { over: false, winner: null };
  const defeat = makeDefeatTracker();
  let playerSeen = false;
  let enemySeen = false;

  return {
    name: 'victory' as const,
    result,
    run(state: SimState): void {
      // 1) SEEN — by EXISTENCE, BEFORE the cull. A side counts as having been in the
      //    match if it has any combat unit or producer present, even one at 0 HP that
      //    is about to be culled this tick. (Culling first, then reading "seen" from
      //    the living census, misses a unit that dies on its very first tick.)
      for (const e of state.store.all()) {
        const team = e.components.faction?.team;
        if (team !== 'player' && team !== 'enemy') continue;
        if (!e.components.combat && !e.components.production) continue;
        if (team === 'player') playerSeen = true;
        else enemySeen = true;
      }

      // 2) DEATH: cull entities whose health has hit 0. Vehicles leave WRECKS
      //    (XP-2): neutral salvage worth ~30% of cost, reclaimed by touch.
      for (const e of state.store.all()) {
        const h = e.components.health;
        if (h && h.hp <= 0) {
          const kind = e.components.faction?.faction ?? '';
          const value = wreckValue.get(kind);
          const pos = e.components.position;
          state.store.remove(e.id);
          if (value && pos) {
            state.store.create({
              position: { wx: pos.wx, wy: pos.wy },
              faction: { team: 'neutral', faction: 'wreck' },
              resource: { cargo: value, capacity: value },
            });
          }
        }
      }
      if (result.over) return; // decision is sticky

      // 3) DEFEAT: the shared RA-convention rule (src/sim/defeat.ts) — a side whose
      //    command structure and production are both gone surrenders. This replaced
      //    "no producers AND no living combat units", which forced the winner to sweep
      //    the map for the last stray rifleman before the match would end.
      defeat.observe(state);
      const bothSidesSeen = playerSeen && enemySeen;
      if (!bothSidesSeen) return; // never decide before both sides existed
      const playerOut = defeat.isDefeated(state, 'player');
      const enemyOut = defeat.isDefeated(state, 'enemy');
      if (playerOut && enemyOut) { result.over = true; result.winner = null; return; }
      if (playerOut) {
        result.over = true; result.winner = 'enemy';
        result.surrendered = surrender(state, 'player'); // clear the field
      } else if (enemyOut) {
        result.over = true; result.winner = 'player';
        result.surrendered = surrender(state, 'enemy');
      }
    },
  };
}
