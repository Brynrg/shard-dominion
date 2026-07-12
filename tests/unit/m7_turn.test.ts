// ── M7 "The Turn" tests: the defection mission's scripted beats fire correctly ──
// The signature beat: at t=185 Sera Vane's raiders join the Warden as PLAYER-team
// units (the alliance forming mid-battle) + an 800-credit resupply. Also the t=8
// Directorate purge spawns the enemy assault. Composed-path: drives the authored
// mission JSON through the real objectives/trigger system.
import { describe, it, expect } from 'vitest';
import { makeSimState } from '../../src/sim/state.js';
import { makeObjectivesSystem } from '../../src/sim/systems/objectives.js';
import { orderSystems, runTick, SIM_TICK_RATE } from '../../src/sim/loop.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import { loadUnits } from '../../src/loaders/units.js';
import { loadMission } from '../../src/loaders/missions.js';
import unitsData from '../../data/units.json' with { type: 'json' };
import m7raw from '../../data/missions/m7_the_turn.json' with { type: 'json' };

const units = loadUnits(unitsData);

function playerFieldUnits(state: ReturnType<typeof makeSimState>): number {
  return state.store.all().filter(e => e.components.faction?.team === 'player' && !e.components.building).length;
}
function enemyCount(state: ReturnType<typeof makeSimState>): number {
  return state.store.all().filter(e => e.components.faction?.team === 'enemy').length;
}

describe('M7 — The Turn', () => {
  it('the Directorate purge (t=8) spawns the enemy assault, then Vane\'s raiders join as PLAYER units (t=185) with an 800cr resupply', () => {
    const m7 = loadMission(m7raw);
    const state = makeSimState({ seed: m7.map.seed, mapWidth: m7.map.width, mapHeight: m7.map.height });
    // A player economy bank for the resupply to land in (grantCredits target).
    const bank = state.store.create({
      position: tileToWorldCenter({ tx: 6, ty: 24 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'refinery' },
      economy: { credits: 0, refineryStorage: 0, maxStorage: 5000 },
      health: { hp: 1500, maxHp: 1500 },
    });
    // A producer so the player isn't "defeated" (no-producer-no-army) before the
    // triggers can run — the real mission seeds a Construction Yard + army.
    state.store.create({
      position: tileToWorldCenter({ tx: 5, ty: 24 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'construction_yard' },
      production: { queue: [], progress: 0 },
      health: { hp: 2000, maxHp: 2000 },
    });
    const sys = makeObjectivesSystem(m7.objectives, m7.failure, m7.triggers, units);
    const systems = orderSystems([sys]);

    const startPlayers = playerFieldUnits(state);

    // Past the t=8 purge: the Directorate assault has spawned.
    for (let t = 0; t < SIM_TICK_RATE * 9; t++) runTick(state, systems);
    expect(enemyCount(state)).toBeGreaterThanOrEqual(4);
    expect(sys.messages.some(m => m.speaker === 'DIRECTOR HALEX')).toBe(true);

    // Advance past the t=185 alliance beat.
    for (let t = 0; t < SIM_TICK_RATE * 185 + 4; t++) runTick(state, systems);

    // Vane's four raiders now fight for the player, and the resupply landed.
    expect(playerFieldUnits(state) - startPlayers).toBe(4);
    expect(state.store.get(bank)!.components.economy!.credits).toBe(800);
    expect(sys.firedTriggerIds()).toContain('t_vane_joins'); // the alliance beat fired (message itself has since expired)

    // The mission is a 5:00 survive: not yet won at ~194s.
    expect(sys.result.won).toBe(false);
  });

  it('M7 loads with the survive + link-up objectives and chains to Ashfall', () => {
    const m7 = loadMission(m7raw);
    expect(m7.objectives.find(o => o.type === 'survive' && o.primary)).toBeTruthy();
    expect(m7.objectives.some(o => o.type === 'reach' && o.id === 'link_up')).toBe(true);
    expect(m7.next).toBe('m8_ashfall');
  });
});
