// ── Multi-seed win-rate harness (balance tuning tool) ───────────────────────────
// The sweep (sweep.test.ts) plays each matchup ONCE on the mission seed — a single
// deterministic sample, so a stat tweak can flip it discontinuously. This harness
// plays every cross-faction matchup over N map seeds and reports per-faction win
// rates, which is the signal balance tuning actually needs. Runs ONLY with
// BALANCE_WINRATE=1 (it's ~30-60s). It asserts a fairness floor: no faction may
// lose EVERY game of the sweep (a 0% faction is a broken faction, not an underdog).
import { describe, it, expect } from 'vitest';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { orderSystems, runTick } from '../../src/sim/loop.js';
import { makeMovementSystem } from '../../src/sim/systems/movement.js';
import { makeHarvestSystem } from '../../src/sim/systems/harvest.js';
import { makeCombatTargetingSystem } from '../../src/sim/systems/combatTargeting.js';
import { makeDamageSystem } from '../../src/sim/systems/damage.js';
import { makeProjectileSystem } from '../../src/sim/systems/projectile.js';
import { makeProductionSystem } from '../../src/sim/systems/production.js';
import { makePowerSystem } from '../../src/sim/systems/power.js';
import { makeVictorySystem } from '../../src/sim/systems/victory.js';
import { makeStealthSystem } from '../../src/sim/systems/stealth.js';
import { makePlanetEventSystem } from '../../src/sim/systems/planetEvent.js';
import { makeAiSystem } from '../../src/sim/systems/ai.js';
import { seedFromMission } from '../../src/sim/seedMission.js';
import { loadMission } from '../../src/loaders/missions.js';
import { makeTeamFactions, type FactionId } from '../../src/sim/factions.js';
import { loadUnits } from '../../src/loaders/units.js';
import { loadStructures } from '../../src/loaders/structures.js';
import { loadWeapons } from '../../src/loaders/loader.js';
import { loadEconomyConstants } from '../../src/loaders/economyConstants.js';
import unitsData from '../../data/units.json' with { type: 'json' };
import structuresData from '../../data/structures.json' with { type: 'json' };
import weaponsData from '../../data/weapons.json' with { type: 'json' };
import economyData from '../../data/economyConstants.json' with { type: 'json' };
import skirmishData from '../../data/missions/skirmish.json' with { type: 'json' };

const units = loadUnits(unitsData);
const structures = loadStructures(structuresData);
const weapons = loadWeapons(weaponsData);
const economy = loadEconomyConstants(economyData);

const SEEDS = [42, 1337, 7, 2026, 99];

function alive(state: SimState, team: 'player' | 'enemy'): boolean {
  for (const e of state.store.all()) {
    if (e.components.faction?.team !== team) continue;
    if (e.components.production) return true;
    if (e.components.combat && (e.components.health?.hp ?? 0) > 0 && !e.components.building) return true;
  }
  return false;
}

/** Play one match on a given map seed; returns 'P' | 'E' | 'none' (deadlock/draw). */
function playMatch(pf: FactionId, ef: FactionId, seed: number, maxTicks = 24000): 'P' | 'E' | 'none' {
  const mission = loadMission(skirmishData);
  const state = makeSimState({ seed, terrainSeed: mission.map.seed, mapWidth: mission.map.width, mapHeight: mission.map.height });
  const tf = makeTeamFactions(pf, ef);
  const meta = seedFromMission(state, mission, { units, structures, economy }, tf);
  const systems = orderSystems([
    makeMovementSystem(), makeHarvestSystem(economy, tf), makeCombatTargetingSystem(weapons),
    makeDamageSystem(weapons), makeProjectileSystem(weapons), makeProductionSystem(units, tf),
    makePowerSystem(), makeVictorySystem(units), makeStealthSystem(), makePlanetEventSystem(units),
    makeAiSystem(units, { team: 'enemy', attackTile: meta.playerStartTile }, structures),
    makeAiSystem(units, { team: 'player', attackTile: meta.objectiveTile }, structures),
  ]);
  for (let t = 0; t < maxTicks; t++) {
    runTick(state, systems);
    if (t % 40 !== 0) continue;
    const p = alive(state, 'player'), e = alive(state, 'enemy');
    if (!p && !e) return 'none';
    if (!p) return 'E';
    if (!e) return 'P';
  }
  // Same points adjudication as the sweep (TP-6).
  const points = (team: 'player' | 'enemy'): number => {
    let pts = 0;
    for (const e of state.store.all()) {
      if (e.components.faction?.team !== team) continue;
      if ((e.components.health?.hp ?? 0) <= 0) continue;
      if (e.components.building) pts += 2;
      else if (e.components.combat) pts += 1;
    }
    for (const e of state.store.all()) {
      if (e.components.faction?.team === team && e.components.economy) pts += (e.components.economy.credits ?? 0) / 500;
    }
    return pts;
  };
  const pp = points('player'), ep = points('enemy');
  const margin = Math.abs(pp - ep) / Math.max(pp, ep, 1);
  if (margin < 0.1) return 'none';
  return pp > ep ? 'P' : 'E';
}

describe.skipIf(!process.env.BALANCE_WINRATE)('balance win rates — multi-seed', () => {
  it('no faction loses every cross-faction game', () => {
    const factions: FactionId[] = ['concord', 'emberhand', 'shardborn'];
    const wins: Record<FactionId, number> = { concord: 0, emberhand: 0, shardborn: 0 };
    const games: Record<FactionId, number> = { concord: 0, emberhand: 0, shardborn: 0 };
    for (const pf of factions) {
      for (const ef of factions) {
        if (pf === ef) continue;
        for (const seed of SEEDS) {
          const r = playMatch(pf, ef, seed);
          games[pf]++; games[ef]++;
          if (r === 'P') wins[pf]++;
          else if (r === 'E') wins[ef]++;
          console.log(`WINRATE ${pf} vs ${ef} seed=${seed}: ${r === 'P' ? pf : r === 'E' ? ef : 'none'}`);
        }
      }
    }
    for (const f of factions) {
      const rate = ((wins[f] / games[f]) * 100).toFixed(0);
      console.log(`TOTAL ${f}: ${wins[f]}/${games[f]} (${rate}%)`);
    }
    for (const f of factions) {
      expect(wins[f], `${f} must win at least one cross-faction game`).toBeGreaterThan(0);
    }
  }, 600000);
});
