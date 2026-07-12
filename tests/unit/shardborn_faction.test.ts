// ── Shardborn faction identity: living-crystal regen + Chorus kinship ───────────
import { describe, it, expect } from 'vitest';
import { makeSimState } from '../../src/sim/state.js';
import { makeRegenSystem } from '../../src/sim/systems/regen.js';
import { makePlanetEventSystem } from '../../src/sim/systems/planetEvent.js';
import { orderSystems, runTick, SIM_TICK_RATE } from '../../src/sim/loop.js';
import { makeTeamFactions } from '../../src/sim/factions.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import { loadUnits } from '../../src/loaders/units.js';
import unitsData from '../../data/units.json' with { type: 'json' };

const units = loadUnits(unitsData);

describe('Shardborn faction identity', () => {
  it('living crystal: a wounded Shardborn unit regenerates; a Concord one does not', () => {
    const state = makeSimState({ seed: 1, mapWidth: 12, mapHeight: 12 });
    const tf = makeTeamFactions('shardborn', 'concord');
    const shard = state.store.create({
      position: tileToWorldCenter({ tx: 3, ty: 3 }), faction: { team: 'player', faction: 'infantry' },
      health: { hp: 40, maxHp: 100 },
    });
    const concord = state.store.create({
      position: tileToWorldCenter({ tx: 5, ty: 5 }), faction: { team: 'enemy', faction: 'infantry' },
      health: { hp: 40, maxHp: 100 },
    });
    const sys = orderSystems([makeRegenSystem(tf)]);
    for (let t = 0; t < SIM_TICK_RATE * 5; t++) runTick(state, sys); // 5 seconds
    expect(state.store.get(shard)!.components.health!.hp).toBeGreaterThan(40); // mended
    expect(state.store.get(concord)!.components.health!.hp).toBe(40);          // unchanged
  });

  it('regen never overheals past max', () => {
    const state = makeSimState({ seed: 2, mapWidth: 12, mapHeight: 12 });
    const tf = makeTeamFactions('shardborn', 'concord');
    const e = state.store.create({
      position: tileToWorldCenter({ tx: 3, ty: 3 }), faction: { team: 'player', faction: 'infantry' },
      health: { hp: 98, maxHp: 100 },
    });
    const sys = orderSystems([makeRegenSystem(tf)]);
    for (let t = 0; t < SIM_TICK_RATE * 10; t++) runTick(state, sys);
    expect(state.store.get(e)!.components.health!.hp).toBe(100);
  });

  it('Chorus kinship: the planet hunts the Concord extractor, never the Shardborn one', () => {
    const PB = tileToWorldCenter({ tx: 3, ty: 3 }), EB = tileToWorldCenter({ tx: 22, ty: 22 });
    // Which side's base does the Riftmaw wake next to? (spawns at the bitten tile
    // nearest the "heaviest extractor" anchor bank.)
    function huntedSide(playerFaction: string): 'player' | 'enemy' | 'none' {
      const state = makeSimState({ seed: 5, mapWidth: 28, mapHeight: 28 });
      const tf = makeTeamFactions(playerFaction, 'concord');
      // Player mines far more than the enemy — normally the planet hunts the player.
      state.store.create({ position: PB, faction: { team: 'player', faction: 'refinery' }, economy: { credits: 0, refineryStorage: 0, maxStorage: 99999, minedTotal: 9000 } });
      state.store.create({ position: EB, faction: { team: 'enemy', faction: 'refinery' }, economy: { credits: 0, refineryStorage: 0, maxStorage: 99999, minedTotal: 3000 } });
      // Bitten tiles (0<d≤500) beside each base + a big depletion driver to fire an awakening.
      state.shardDensity.set('4,4', 200);
      state.shardDensity.set('21,21', 200);
      state.shardDensity.set('13,13', 4000);
      const sys = orderSystems([makePlanetEventSystem(units, [], tf)]);
      runTick(state, sys);                       // establish prev density
      state.shardDensity.set('13,13', 0);        // deplete 4000 → totalMined ≥ 3000 → awaken
      runTick(state, sys);
      const maw = state.store.all().find(e => e.components.faction?.faction === 'riftmaw');
      const p = maw?.components.position;
      if (!p) return 'none';
      return Math.hypot(p.wx - PB.wx, p.wy - PB.wy) < Math.hypot(p.wx - EB.wx, p.wy - EB.wy) ? 'player' : 'enemy';
    }
    expect(huntedSide('concord')).toBe('player');    // not kin → heaviest extractor is hunted
    expect(huntedSide('shardborn')).toBe('enemy');   // kin → skipped, planet hunts the Concord enemy
  });
});
