// ── Victory system: cull dead units + decide win/lose ──────────────────────────
// Runs LAST in SYSTEM_ORDER (after audio). Pure sim: no DOM, no wall-clock.
import type { SimState } from '../state.js';
import type { UnitDef } from '../../loaders/units.js';

export interface VictoryResult { over: boolean; winner: 'player' | 'enemy' | null }
export interface VictorySystem { name: 'victory'; run(state: SimState): void; result: VictoryResult }

// The 'victory' system: (1) remove any unit at 0 HP (death); (2) once combat has
// begun, if one side has no living combat units AND no producers, record the winner.
// Sim-pure.
export function makeVictorySystem(units: readonly UnitDef[] = []): VictorySystem {
  // XP-2 salvage: kinds that die into wrecks, worth ~30% of cost.
  const wreckValue = new Map<string, number>();
  for (const u of units) if (u.leavesWreck) wreckValue.set(u.id, Math.round(u.cost * 0.3));
  const result: VictoryResult = { over: false, winner: null };
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

      // 3) census: LIVING combat units per side, and whether each side still owns a
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

      // 3) decide ONLY once both sides have existed in the match (avoid a false win
      //    when only one side was ever seeded). Track "both seen" across ticks.
      const bothSidesSeen = playerSeen && enemySeen;
      // A side is defeated when it has NO living combat units AND NO producers
      if (bothSidesSeen && player === 0 && !playerHasProducer) { result.over = true; result.winner = 'enemy'; }
      else if (bothSidesSeen && enemy === 0 && !enemyHasProducer) { result.over = true; result.winner = 'player'; }
    },
  };
}
