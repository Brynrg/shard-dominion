// ── XP-5 Sky-lite: air targeting rules, ammo/rearm, storms, shields ─────────────
import { describe, it, expect, beforeEach } from 'vitest';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { orderSystems, runTick } from '../../src/sim/loop.js';
import { makeCombatTargetingSystem } from '../../src/sim/systems/combatTargeting.js';
import { makeDamageSystem } from '../../src/sim/systems/damage.js';
import { makeStealthSystem } from '../../src/sim/systems/stealth.js';
import { isStormActive } from '../../src/sim/systems/planetEvent.js';
import { loadWeapons } from '../../src/loaders/loader.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import weaponsData from '../../data/weapons.json' with { type: 'json' };

const weapons = loadWeapons(weaponsData);

function gunship(state: SimState, team: 'player' | 'enemy', tx: number, ty: number, ammo = 6) {
  return state.store.create({
    position: tileToWorldCenter({ tx, ty }),
    movement: { target: null, path: [], speed: 22, flying: true },
    combat: { weaponId: 'quad_missile', cooldownRemaining: 0, targetId: null, ammo, ammoMax: 6 },
    faction: { team, faction: 'gunship' },
    health: { hp: 120, maxHp: 120 },
    armor: { armorClass: 'AIR' },
  });
}
function rifleman(state: SimState, team: 'player' | 'enemy', tx: number, ty: number) {
  return state.store.create({
    position: tileToWorldCenter({ tx, ty }),
    movement: { target: null, path: [], speed: 12 },
    combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
    faction: { team, faction: 'infantry' },
    health: { hp: 20, maxHp: 20 },
    armor: { armorClass: 'LIGHT' },
  });
}

describe('XP-5 — air rules', () => {
  let state: SimState;
  beforeEach(() => { state = makeSimState({ seed: 6, mapWidth: 32, mapHeight: 32 }); });

  it('rifles CAN hit air (0.6×) but siege cannot target it; rockets prefer nothing about it', () => {
    const g = gunship(state, 'enemy', 12, 10);
    const rifle = rifleman(state, 'player', 10, 10);
    const arty = state.store.create({
      position: tileToWorldCenter({ tx: 15, ty: 10 }),
      movement: { target: null, path: [], speed: 7 },
      combat: { weaponId: 'siege_cannon', cooldownRemaining: 0, targetId: null },
      faction: { team: 'player', faction: 'longbow' },
      health: { hp: 90, maxHp: 90 },
      armor: { armorClass: 'HEAVY' },
    });
    const sys = orderSystems([makeCombatTargetingSystem(weapons)]);
    runTick(state, sys);
    expect(state.store.get(rifle)!.components.combat!.targetId).toBe(g);   // bullets vs air: 0.6
    expect(state.store.get(arty)!.components.combat!.targetId).toBeNull(); // siege vs air: 0
  });

  it('an empty gunship holds fire; a skypad rearm refills for 1 Cell', () => {
    const g = gunship(state, 'player', 10, 10, 0);
    rifleman(state, 'enemy', 11, 10);
    // Bank + skypad beside the gunship.
    state.store.create({
      position: tileToWorldCenter({ tx: 9, ty: 10 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'skypad' },
      power: { powerSupply: 0, powerDemand: 15, powered: true },
      health: { hp: 800, maxHp: 800 },
    });
    state.store.create({
      position: tileToWorldCenter({ tx: 8, ty: 8 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'refinery' },
      economy: { credits: 500, refineryStorage: 500, maxStorage: 2000, cells: 2 },
      health: { hp: 1500, maxHp: 1500 },
    });
    const sys = orderSystems([makeStealthSystem(), makeCombatTargetingSystem(weapons), makeDamageSystem(weapons)]);
    const enemyHp = () => state.store.all().find(e => e.components.faction?.team === 'enemy')!.components.health!.hp;
    const hp0 = enemyHp();
    runTick(state, sys); // empty: no fire… but the rearm also happens this tick
    // After rearm ticks, ammo refills (1 cell spent) and it fires.
    for (let i = 0; i < 20; i++) runTick(state, sys);
    const bank = state.store.all().find(e => e.components.economy)!.components.economy!;
    expect(bank.cells).toBe(1); // one cell consumed by the rearm
    expect(state.store.get(g)!.components.combat!.ammo).toBeLessThanOrEqual(6);
    expect(enemyHp()).toBeLessThan(hp0); // it fired after rearming
  });

  it('storms are a deterministic clock and hurt flyers', () => {
    expect(isStormActive(0)).toBe(false);
    expect(isStormActive(4200)).toBe(true);  // last 600 of each 4800
    expect(isStormActive(4799)).toBe(true);
    expect(isStormActive(4800)).toBe(false);
  });

  it('Concord shields absorb before hp and regenerate', () => {
    const victim = rifleman(state, 'player', 11, 10);
    state.store.get(victim)!.components.shield = { hp: 20, max: 20, regenDelay: 0 };
    rifleman(state, 'enemy', 10, 10);
    const sys = orderSystems([makeCombatTargetingSystem(weapons), makeDamageSystem(weapons)]);
    runTick(state, sys);
    runTick(state, sys);
    const v = state.store.get(victim)!;
    expect(v.components.shield!.hp).toBeLessThan(20); // shield ate it
    expect(v.components.health!.hp).toBe(20);          // hp untouched so far
  });
});
