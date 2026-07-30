// ── Defeat rule: ONE definition of "this side is finished" (Phase A4) ──────────
// Sim-pure. Shared by victory.ts (win/lose) and objectives.ts (`eliminate`
// objectives and `defeated` failures) so the three can never disagree.
//
// The old rule was "no producers AND no living combat units", which meant that after
// flattening a base you had to sweep a 32×32 map for the last stray rifleman before
// the match would end. That is the classic RTS anti-climax.
//
// The rule now follows Red Alert's convention: a side whose COMMAND STRUCTURE and
// PRODUCTION are both gone cannot come back, so it surrenders — victory.ts clears its
// remaining units. A side that never had a base at all (a mission's watch-post
// garrison, a creep camp) still falls back to the old army-and-producers test, so
// "destroy the watch-post" objectives keep working.
import type { SimState } from './state.js';

export interface DefeatTracker {
  /** Call once per tick BEFORE asking. Records whether a side ever fielded a base. */
  observe(state: SimState): void;
  /** True when this side can no longer fight on. */
  isDefeated(state: SimState, team: string): boolean;
  /** Whether the side ever had a base (exposed for tests/diagnostics). */
  everHadBase(team: string): boolean;
}

interface Census {
  conYard: boolean;
  producer: boolean;
  building: boolean;
  army: boolean;
}

function census(state: SimState, team: string): Census {
  const c: Census = { conYard: false, producer: false, building: false, army: false };
  for (const e of state.store.all()) {
    const f = e.components.faction;
    if (f?.team !== team) continue;
    const alive = (e.components.health?.hp ?? 1) > 0;
    if (!alive) continue;
    if (f.faction === 'construction_yard') c.conYard = true;
    if (e.components.production || e.components.construction) c.producer = true;
    if (e.components.building) c.building = true;
    else if (e.components.combat) c.army = true;
  }
  return c;
}

export function makeDefeatTracker(): DefeatTracker {
  const hadBase = new Set<string>();
  return {
    observe(state: SimState): void {
      for (const team of ['player', 'enemy']) {
        if (hadBase.has(team)) continue;
        const c = census(state, team);
        if (c.conYard || c.producer) hadBase.add(team);
      }
    },
    everHadBase(team: string): boolean { return hadBase.has(team); },
    isDefeated(state: SimState, team: string): boolean {
      const c = census(state, team);
      if (hadBase.has(team)) {
        // RA rule: command structure + production both gone → the side surrenders.
        // No map sweep for stragglers; victory.ts clears them.
        return !c.conYard && !c.producer;
      }
      // Never had a base (garrisons, creeps): the old test still applies.
      return !c.producer && !c.army && !c.building;
    },
  };
}

/** Remove a defeated side's surviving units — the surrender, so the field clears. */
export function surrender(state: SimState, team: string): number {
  let removed = 0;
  for (const e of state.store.all()) {
    const f = e.components.faction;
    if (f?.team !== team) continue;
    if (e.components.building) continue; // rubble stays; it is already harmless
    state.store.remove(e.id);
    removed += 1;
  }
  return removed;
}
