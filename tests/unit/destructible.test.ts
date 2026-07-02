// ── P0a: destructible buildings — the match becomes WINNABLE ─────────────────────
// BULLET-vs-BUILDING damage on one tick; 0-hp building culled; full-stack winnable
// match proof (kill enemy unit + barracks -> victory winner player).
import { describe, it, expect, beforeEach } from 'vitest';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { makeCombatTargetingSystem } from '../../src/sim/systems/combatTargeting.js';
import { makeDamageSystem } from '../../src/sim/systems/damage.js';
import { makeVictorySystem, type VictorySystem } from '../../src/sim/systems/victory.js';
import { orderSystems, runTick, type SimSystem } from '../../src/sim/loop.js';
import { loadWeapons } from '../../src/loaders/loader.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import weaponsData from '../../data/weapons.json' with { type: 'json' };

const weapons = loadWeapons(weaponsData);

describe('Destructible buildings', () => {
  let state: SimState;
  let victory: VictorySystem;
  let systems: readonly SimSystem[];

  beforeEach(() => {
    state = makeSimState({ seed: 42, mapWidth: 32, mapHeight: 32 });
    victory = makeVictorySystem();
    systems = orderSystems([
      makeCombatTargetingSystem(weapons),
      makeDamageSystem(weapons),
      victory,
    ]);
  });

  function combatant(tx: number, ty: number, team: 'player' | 'enemy', hp: number, armor: 'NONE' | 'LIGHT' | 'MEDIUM' | 'HEAVY' | 'BUILDING', weaponId: string) {
    return state.store.create({
      position: tileToWorldCenter({ tx, ty }),
      health: { hp, maxHp: hp },
      armor: { armorClass: armor },
      combat: { weaponId, cooldownRemaining: 0, targetId: null },
      faction: { team, faction: 'unit' },
    });
  }

  function building(tx: number, ty: number, team: 'player' | 'enemy', hp: number) {
    return state.store.create({
      position: tileToWorldCenter({ tx, ty }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team, faction: 'generic_structure' },
      health: { hp, maxHp: hp },
      armor: { armorClass: 'BUILDING' },
    });
  }

  it('BULLET vs BUILDING deals exact damage on one tick', () => {
    // Rifle weapon damage is 8, matrix.BULLET.BUILDING is 0.2
    // So damage = 8 * 0.2 = 1.6 per tick
    const buildingId = building(5, 5, 'enemy', 100);
    combatant(4, 5, 'player', 20, 'LIGHT', 'rifle');

    // Run one tick to get one shot off
    runTick(state, systems);

    const buildingAfter = state.store.get(buildingId);
    expect(buildingAfter?.components.health?.hp).toBe(98.4); // 100 - 1.6
  });

  it('0-hp building is culled after a tick', () => {
    // Use scout_gun with 0.5s cooldown for faster testing
    // Damage = 10 * 0.2 = 2 per shot, 16 hp building dies in 8 shots
    // With 0.5s cooldown = 10 ticks per shot, 8 shots = 80 ticks
    const buildingId = building(5, 5, 'enemy', 16);
    combatant(4, 5, 'player', 20, 'LIGHT', 'scout_gun');

    for (let i = 0; i < 80; i++) {
      runTick(state, systems);
    }

    expect(state.store.get(buildingId)).toBeUndefined();
  });

  it('winnable match proof: kill enemy unit + barracks -> victory player', () => {
    // Seed enemy barracks (producer) + one enemy combat unit
    // Position enemy unit closer to player so player units target it first
    // Barracks at (12, 5), enemy unit at (10, 5), player units at (8, 5) and (8, 6)
    // Distance from player to enemy unit: |10 - 8| = 2 tiles = 64 world units
    // Distance from player to barracks: |12 - 8| = 4 tiles = 128 world units
    // Low-hp barracks (100 hp) so it dies quickly. It must be a real PRODUCER —
    // otherwise victory would fire the instant the enemy unit dies (a non-producer
    // building doesn't block defeat), and the barracks would never be attacked.
    const barracksId = state.store.create({
      position: tileToWorldCenter({ tx: 12, ty: 5 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'enemy', faction: 'barracks' },
      production: { queue: [], progress: 0 },
      health: { hp: 100, maxHp: 100 },
      armor: { armorClass: 'BUILDING' },
    });
    combatant(10, 5, 'enemy', 20, 'LIGHT', 'rifle');

    // Seed player squad in range of both with higher hp to survive longer
    // Player units need to survive until barracks dies
    // Enemy unit deals 4 damage per tick (rifle vs LIGHT)
    // Player units need hp > 200 * 4 = 800 to survive 200 ticks
    combatant(8, 5, 'player', 1000, 'LIGHT', 'inf_rocket');
    combatant(8, 6, 'player', 1000, 'LIGHT', 'inf_rocket');

    // Run until victory (enemy unit dies in 1 tick, barracks takes 20 damage per tick from each rocket = 40/tick)
    // Barracks dies in 3 ticks (100 / 40 = 2.5, rounded up)
    for (let i = 0; i < 200; i++) {
      runTick(state, systems);
      if (victory.result.over) break;
    }

    expect(victory.result.over).toBe(true);
    expect(victory.result.winner).toBe('player');
    expect(state.store.get(barracksId)).toBeUndefined();
  });
});
