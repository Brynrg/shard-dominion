// ── Refinements (economy depth) tests: research flow + effect application ───────
// Composed-path: drive the real command system to START research, the real research
// system to COMPLETE it, and the real damage system to prove the effect lands.
import { describe, it, expect } from 'vitest';
import { makeSimState } from '../../src/sim/state.js';
import { makeCommandSystem } from '../../src/sim/systems/command.js';
import { makeResearchSystem } from '../../src/sim/systems/research.js';
import { makeDamageSystem } from '../../src/sim/systems/damage.js';
import { orderSystems, runTick, SIM_TICK_RATE } from '../../src/sim/loop.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import { loadRefinements, refinementValue } from '../../src/loaders/refinements.js';
import { loadWeapons } from '../../src/loaders/loader.js';
import refinementsData from '../../data/refinements.json' with { type: 'json' };
import weaponsData from '../../data/weapons.json' with { type: 'json' };
import type { CommandIntent } from '../../src/view/input.js';

const refinements = loadRefinements(refinementsData);
const weapons = loadWeapons(weaponsData);

function fakeQueue(intents: CommandIntent[]) {
  let pending = [...intents];
  return { drain(): CommandIntent[] { const x = pending; pending = []; return x; } };
}

describe('Refinements — economy depth', () => {
  it('research at a powered Processing Plant spends credits + Cells and completes after its timer', () => {
    const state = makeSimState({ seed: 1, mapWidth: 24, mapHeight: 24 });
    // A player Processing Plant (gate) + a bank with credits and Cells.
    state.store.create({
      position: tileToWorldCenter({ tx: 6, ty: 6 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'processing_plant' },
      health: { hp: 1000, maxHp: 1000 },
    });
    const bank = state.store.create({
      position: tileToWorldCenter({ tx: 8, ty: 6 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'refinery' },
      economy: { credits: 3000, refineryStorage: 0, maxStorage: 5000, cells: 3 },
      health: { hp: 1500, maxHp: 1500 },
    });
    const cmd = makeCommandSystem(fakeQueue([{ type: 'research', refinementId: 'munitions_doctrine', team: 'player' }]), [], ['warden', 'vane'], refinements);
    const systems = orderSystems([cmd, makeResearchSystem()]);

    runTick(state, systems); // command drains → research starts, cost paid up-front
    const led = state.refinements.get('player')!;
    expect(led.researching).toBe('munitions_doctrine');
    expect(state.store.get(bank)!.components.economy!.credits).toBe(1800); // 3000 - 1200
    expect(state.store.get(bank)!.components.economy!.cells).toBe(2);      // 3 - 1

    // Advance past the 45s timer → completed, no longer researching.
    for (let t = 0; t < SIM_TICK_RATE * 45 + 2; t++) runTick(state, systems);
    expect(led.researching).toBeNull();
    expect(led.done).toContain('munitions_doctrine');
    expect(refinementValue(led.done, refinements, 'damage')).toBeCloseTo(0.2);
  });

  it('Munitions Doctrine actually raises applied damage by +20% at point of use', () => {
    function shotDamage(withDoctrine: boolean): number {
      const state = makeSimState({ seed: 2, mapWidth: 24, mapHeight: 24 });
      if (withDoctrine) state.refinements.set('player', { done: ['munitions_doctrine'], researching: null, ticksLeft: 0 });
      const attacker = state.store.create({
        position: tileToWorldCenter({ tx: 5, ty: 5 }),
        faction: { team: 'player', faction: 'infantry' },
        combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
      });
      const target = state.store.create({
        position: tileToWorldCenter({ tx: 5, ty: 6 }),
        faction: { team: 'enemy', faction: 'infantry' },
        armor: { armorClass: 'NONE' },
        health: { hp: 1000, maxHp: 1000 },
      });
      state.store.get(attacker)!.components.combat!.targetId = target;
      const dmg = makeDamageSystem(weapons, refinements);
      const sys = orderSystems([dmg]);
      runTick(state, sys);
      return 1000 - state.store.get(target)!.components.health!.hp;
    }
    const base = shotDamage(false);
    const boosted = shotDamage(true);
    expect(base).toBeGreaterThan(0);
    expect(boosted).toBeCloseTo(base * 1.2, 4);
  });
});
