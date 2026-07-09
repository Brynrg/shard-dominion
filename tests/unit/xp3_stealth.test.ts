// ── XP-3: stealth/detection + faction locks + hero cap generalization ───────────
import { describe, it, expect, beforeEach } from 'vitest';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { orderSystems, runTick } from '../../src/sim/loop.js';
import { makeStealthSystem } from '../../src/sim/systems/stealth.js';
import { makeCombatTargetingSystem } from '../../src/sim/systems/combatTargeting.js';
import { makeProductionSystem } from '../../src/sim/systems/production.js';
import { loadUnits } from '../../src/loaders/units.js';
import { loadWeapons } from '../../src/loaders/loader.js';
import { FACTIONS } from '../../src/sim/factions.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import unitsData from '../../data/units.json' with { type: 'json' };
import weaponsData from '../../data/weapons.json' with { type: 'json' };

const units = loadUnits(unitsData);
const weapons = loadWeapons(weaponsData);

function ghost(state: SimState, tx: number, ty: number) {
  return state.store.create({
    position: tileToWorldCenter({ tx, ty }),
    movement: { target: null, path: [], speed: 15 },
    combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
    stealth: { cloaked: true, decloakTicks: 0 },
    faction: { team: 'player', faction: 'ghostwalker' },
    health: { hp: 30, maxHp: 30 },
  });
}
function rifleman(state: SimState, team: 'player' | 'enemy', tx: number, ty: number) {
  return state.store.create({
    position: tileToWorldCenter({ tx, ty }),
    movement: { target: null, path: [], speed: 12 },
    combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
    faction: { team, faction: 'infantry' },
    health: { hp: 20, maxHp: 20 },
  });
}

describe('XP-3 — stealth', () => {
  let state: SimState;
  beforeEach(() => { state = makeSimState({ seed: 9, mapWidth: 32, mapHeight: 32 }); });

  it('a cloaked unit cannot be targeted; a decloaked one can', () => {
    const g = ghost(state, 10, 10);
    const shooter = rifleman(state, 'enemy', 11, 10); // adjacent! but proximity detects at 1.5t...
    // Move the shooter 3 tiles away: outside proximity detection, inside rifle range.
    state.store.get(shooter)!.components.position = tileToWorldCenter({ tx: 13, ty: 10 });
    const sys = orderSystems([makeStealthSystem(), makeCombatTargetingSystem(weapons)]);
    runTick(state, sys);
    expect(state.store.get(g)!.components.stealth!.cloaked).toBe(true);
    expect(state.store.get(shooter)!.components.combat!.targetId).toBeNull();
    // Force a decloak window → the shooter acquires it.
    state.store.get(g)!.components.stealth = { cloaked: false, decloakTicks: 100 };
    runTick(state, sys);
    expect(state.store.get(shooter)!.components.combat!.targetId).toBe(g);
  });

  it('proximity (1.5t) and scout vehicles (5t) detect cloaked units', () => {
    const g = ghost(state, 10, 10);
    rifleman(state, 'enemy', 11, 10); // 1 tile — proximity detection
    const sys = orderSystems([makeStealthSystem()]);
    runTick(state, sys);
    expect(state.store.get(g)!.components.stealth!.cloaked).toBe(false);
    // Remove the rifleman; a scout 4 tiles out still sees it.
    for (const e of state.store.all()) if (e.components.faction?.faction === 'infantry') state.store.remove(e.id);
    state.store.create({
      position: tileToWorldCenter({ tx: 14, ty: 10 }),
      movement: { target: null, path: [], speed: 15 },
      combat: { weaponId: 'scout_gun', cooldownRemaining: 0, targetId: null },
      faction: { team: 'enemy', faction: 'scout_vehicle' },
      health: { hp: 80, maxHp: 80 },
    });
    runTick(state, sys);
    expect(state.store.get(g)!.components.stealth!.cloaked).toBe(false);
  });

  it('faction lock: a Concord side cannot produce Ghostwalkers (job dropped)', () => {
    state.store.create({
      position: tileToWorldCenter({ tx: 8, ty: 8 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'refinery' },
      economy: { credits: 5000, refineryStorage: 5000, maxStorage: 9000 },
      health: { hp: 1500, maxHp: 1500 },
    });
    state.store.create({
      position: tileToWorldCenter({ tx: 10, ty: 8 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'barracks' },
      production: { queue: ['ghostwalker'], progress: 0 },
      tech: { tier: 2, upgradingTo: null, ticksLeft: 0 },
      health: { hp: 800, maxHp: 800 },
    });
    const concord = orderSystems([makeProductionSystem(units, { player: FACTIONS.concord, enemy: FACTIONS.concord })]);
    for (let i = 0; i < 200; i++) runTick(state, concord);
    expect(state.store.all().some(e => e.components.faction?.faction === 'ghostwalker')).toBe(false);
    // The same queue under the Emberhand produces (and the spawn is CLOAKED).
    const bar = state.store.all().find(e => e.components.production)!;
    bar.components.production = { queue: ['ghostwalker'], progress: 0 };
    const ember = orderSystems([makeProductionSystem(units, { player: FACTIONS.emberhand, enemy: FACTIONS.concord })]);
    for (let i = 0; i < 200; i++) runTick(state, ember);
    const g = state.store.all().find(e => e.components.faction?.faction === 'ghostwalker');
    expect(g).toBeDefined();
    expect(g!.components.stealth?.cloaked).toBe(true);
  });
});
