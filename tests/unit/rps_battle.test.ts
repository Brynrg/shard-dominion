// ── S4B-3: the RPS triangle DECIDES a battle ───────────────────────────────────
// Same armored (MEDIUM) vehicle vs two different squads, run through the full combat
// stack (targeting → damage → victory). Anti-vehicle ROCKETs beat it; anti-infantry
// BULLETs lose to it. That's the counter triangle deciding the fight, not just stats.
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

describe('RPS decides the battle', () => {
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

  // The armored target used in BOTH scenarios (MEDIUM armor, scout_gun, 60 HP).
  function seedVehicle() { return combatant(8, 5, 'enemy', 60, 'MEDIUM', 'scout_gun'); }

  it('anti-vehicle ROCKETs beat the armored vehicle (counter wins)', () => {
    combatant(5, 5, 'player', 20, 'LIGHT', 'inf_rocket');
    combatant(5, 6, 'player', 20, 'LIGHT', 'inf_rocket');
    const vehicleId = seedVehicle();

    for (let i = 0; i < 150; i++) runTick(state, systems);

    expect(state.store.get(vehicleId)).toBeUndefined();     // the vehicle died
    expect(victory.result.over).toBe(true);
    expect(victory.result.winner).toBe('player');            // rockets won
  });

  it('anti-infantry RIFLES lose to the SAME armored vehicle (wrong counter)', () => {
    combatant(5, 5, 'player', 20, 'LIGHT', 'rifle');
    combatant(5, 6, 'player', 20, 'LIGHT', 'rifle');
    const vehicleId = seedVehicle();

    for (let i = 0; i < 150; i++) runTick(state, systems);

    expect(state.store.get(vehicleId)).toBeDefined();        // the vehicle survived
    expect(victory.result.over).toBe(true);
    expect(victory.result.winner).toBe('enemy');             // rifles lost
  });
});
