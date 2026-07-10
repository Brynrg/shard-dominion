// ── Balance-validation sprint (XP plan §11): AI-vs-AI headless matchups ─────────
// Runs ONLY with BALANCE=1 (skipped in the normal suite). Two full AI stacks fight
// on the skirmish valley; we record who dies and when. The deterministic sim makes
// each matchup a pure function of (factions, seed).
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

function alive(state: SimState, team: 'player' | 'enemy'): boolean {
  for (const e of state.store.all()) {
    if (e.components.faction?.team !== team) continue;
    if (e.components.production) return true;
    if (e.components.combat && (e.components.health?.hp ?? 0) > 0 && !e.components.building) return true;
  }
  return false;
}

function playMatch(pf: FactionId, ef: FactionId, maxTicks = 24000): { winner: string; ticks: number } {
  const mission = loadMission(skirmishData);
  const state = makeSimState({ seed: mission.map.seed, mapWidth: 32, mapHeight: 32 });
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
    if (!p && !e) return { winner: 'draw', ticks: t };
    if (!p) return { winner: `${ef}(E)`, ticks: t };
    if (!e) return { winner: `${pf}(P)`, ticks: t };
  }
  // TP-6 adjudication: a match that reaches the cap with BOTH economies exhausted
  // is decided on points (remaining structures + army + bank). Sieges can no longer
  // stall (the finisher commits the stronger side); only mutual exhaustion lands here.
  const points = (team: 'player' | 'enemy'): number => {
    let p = 0;
    for (const e of state.store.all()) {
      if (e.components.faction?.team !== team) continue;
      if ((e.components.health?.hp ?? 0) <= 0) continue;
      if (e.components.building) p += 2;
      else if (e.components.combat) p += 1;
    }
    for (const e of state.store.all()) {
      if (e.components.faction?.team === team && e.components.economy) p += (e.components.economy.credits ?? 0) / 500;
    }
    return p;
  };
  const pp = points('player'), ep = points('enemy');
  const margin = Math.abs(pp - ep) / Math.max(pp, ep, 1);
  if (margin < 0.1) return { winner: 'deadlock', ticks: maxTicks };
  return { winner: pp > ep ? `${pf}(P·pts)` : `${ef}(E·pts)`, ticks: maxTicks };
}

describe.skipIf(!process.env.BALANCE)('balance sweep — AI vs AI', () => {
  const matchups: [FactionId, FactionId][] = [
    ['concord', 'concord'], ['concord', 'emberhand'], ['emberhand', 'concord'],
    ['concord', 'shardborn'], ['emberhand', 'shardborn'], ['shardborn', 'emberhand'],
  ];
  for (const [pf, ef] of matchups) {
    it(`${pf} vs ${ef}`, () => {
      const r = playMatch(pf, ef);
      const mins = (r.ticks / 20 / 60).toFixed(1);
      console.log(`RESULT ${pf} vs ${ef}: winner=${r.winner} at ${mins}min`);
      expect(r.winner).not.toBe('draw');
      expect(r.winner, 'matches must CONCLUDE or adjudicate decisively (TP-6)').not.toBe('timeout');
      expect(r.winner, 'no dead-even deadlocks').not.toBe('deadlock');
    });
  }
});
