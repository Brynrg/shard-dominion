// ── Hero Ascendancy tests: veterancy grows the hero's HP + command aura ─────────
import { describe, it, expect } from 'vitest';
import { makeSimState } from '../../src/sim/state.js';
import { makeHeroSystem } from '../../src/sim/systems/hero.js';
import { makeDamageSystem } from '../../src/sim/systems/damage.js';
import { orderSystems, runTick } from '../../src/sim/loop.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import { loadUnits } from '../../src/loaders/units.js';
import { loadWeapons } from '../../src/loaders/loader.js';
import unitsData from '../../data/units.json' with { type: 'json' };
import weaponsData from '../../data/weapons.json' with { type: 'json' };

const units = loadUnits(unitsData);
const weapons = loadWeapons(weaponsData);
const WARDEN_HP = units.find(u => u.id === 'warden')!.hp; // 150

describe('Hero Ascendancy', () => {
  it('the hero max HP grows with veterancy rank and heals on ascension', () => {
    const state = makeSimState({ seed: 1, mapWidth: 16, mapHeight: 16 });
    const hero = state.store.create({
      position: tileToWorldCenter({ tx: 5, ty: 5 }),
      faction: { team: 'player', faction: 'warden' },
      health: { hp: WARDEN_HP, maxHp: WARDEN_HP },
      experience: { kills: 0, rank: 0 },
    });
    const sys = orderSystems([makeHeroSystem(units)]);

    runTick(state, sys); // rank 0 → no change
    expect(state.store.get(hero)!.components.health!.maxHp).toBe(WARDEN_HP);

    // Rack up kills to rank 3 (>=15) → +75% max HP, healed to full.
    state.store.get(hero)!.components.experience!.kills = 15;
    state.store.get(hero)!.components.health!.hp = 40; // wounded before ascension
    runTick(state, sys);
    const h = state.store.get(hero)!.components.health!;
    expect(h.maxHp).toBe(Math.round(WARDEN_HP * 1.75));
    expect(h.hp).toBe(h.maxHp); // healed on rank-up
  });

  it('the command aura scales with the hero rank (+15% at r0 → +30% at r3)', () => {
    function allyDamage(heroKills: number): number {
      const state = makeSimState({ seed: 2, mapWidth: 16, mapHeight: 16 });
      // A friendly hero next to the shooter.
      state.store.create({
        position: tileToWorldCenter({ tx: 5, ty: 5 }),
        faction: { team: 'player', faction: 'warden' },
        health: { hp: 300, maxHp: 300 },
        experience: { kills: heroKills, rank: 0 },
      });
      const shooter = state.store.create({
        position: tileToWorldCenter({ tx: 5, ty: 6 }),
        faction: { team: 'player', faction: 'infantry' }, // 0 kills — aura is the only bonus
        combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
      });
      const target = state.store.create({
        position: tileToWorldCenter({ tx: 5, ty: 7 }),
        faction: { team: 'enemy', faction: 'infantry' },
        armor: { armorClass: 'NONE' },
        health: { hp: 1000, maxHp: 1000 },
      });
      state.store.get(shooter)!.components.combat!.targetId = target;
      runTick(state, orderSystems([makeDamageSystem(weapons)]));
      return 1000 - state.store.get(target)!.components.health!.hp;
    }
    const r0 = allyDamage(0);   // +15% aura
    const r3 = allyDamage(15);  // +30% aura
    expect(r0).toBeGreaterThan(0);
    expect(r3 / r0).toBeCloseTo(1.30 / 1.15, 3);
  });
});
