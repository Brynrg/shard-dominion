// ── Difficulty gate (Phase A3): Easy/Normal/Hard must be genuinely different ────
// The measured problem before the overhaul: a passive player died at 4:10 on Easy and
// 3:16 on Hard — the whole difficulty range was 54 seconds wide, and there was no
// setting at which a beginner could learn the game.
//
// This gate pits a COMPETENT BASELINE PLAYER (the Normal personality, driving the
// player seat) against each difficulty over several seeds and asserts the win rate
// actually moves. Run with BALANCE_DIFFICULTY=1 (it is a multi-second simulation).
import { describe, it, expect } from 'vitest';
import { makeSimState } from '../../src/sim/state.js';
import { orderSystems, runTick } from '../../src/sim/loop.js';
import { makeMovementSystem } from '../../src/sim/systems/movement.js';
import { makeHarvestSystem } from '../../src/sim/systems/harvest.js';
import { makeCombatTargetingSystem } from '../../src/sim/systems/combatTargeting.js';
import { makeDamageSystem } from '../../src/sim/systems/damage.js';
import { makeProjectileSystem } from '../../src/sim/systems/projectile.js';
import { makeProductionSystem } from '../../src/sim/systems/production.js';
import { makeConstructionSystem } from '../../src/sim/systems/construction.js';
import { makePowerSystem } from '../../src/sim/systems/power.js';
import { makeVictorySystem } from '../../src/sim/systems/victory.js';
import { makeStealthSystem } from '../../src/sim/systems/stealth.js';
import { makePlanetEventSystem } from '../../src/sim/systems/planetEvent.js';
import { makeResearchSystem } from '../../src/sim/systems/research.js';
import { makeRegenSystem } from '../../src/sim/systems/regen.js';
import { makeHeroSystem } from '../../src/sim/systems/hero.js';
import { makeAiSystem } from '../../src/sim/systems/ai.js';
import { AI_PERSONALITIES } from '../../src/sim/aiPersonality.js';
import { makeDefeatTracker } from '../../src/sim/defeat.js';
import { seedFromMission } from '../../src/sim/seedMission.js';
import { loadMission } from '../../src/loaders/missions.js';
import { makeTeamFactions, type FactionId } from '../../src/sim/factions.js';
import { loadUnits } from '../../src/loaders/units.js';
import { loadStructures } from '../../src/loaders/structures.js';
import { loadWeapons } from '../../src/loaders/loader.js';
import { loadRefinements } from '../../src/loaders/refinements.js';
import { loadEconomyConstants } from '../../src/loaders/economyConstants.js';
import unitsData from '../../data/units.json' with { type: 'json' };
import structuresData from '../../data/structures.json' with { type: 'json' };
import weaponsData from '../../data/weapons.json' with { type: 'json' };
import refinementsData from '../../data/refinements.json' with { type: 'json' };
import economyData from '../../data/economyConstants.json' with { type: 'json' };
import skirmishData from '../../data/missions/skirmish.json' with { type: 'json' };

const units = loadUnits(unitsData);
const structures = loadStructures(structuresData);
const weapons = loadWeapons(weaponsData);
const refinements = loadRefinements(refinementsData);
const economy = loadEconomyConstants(economyData);

const MATCH_TICKS = 20 * 60 * 25; // 25 minutes of sim

type Outcome = 'player' | 'enemy' | 'draw';

/** One match: a Normal-personality BASELINE PLAYER vs `difficulty` on the enemy seat. */
function playMatch(difficulty: 'easy' | 'normal' | 'hard', seed: number): { winner: Outcome; ticks: number } {
  const mission = loadMission(skirmishData);
  const state = makeSimState({ seed, mapWidth: mission.map.width, mapHeight: mission.map.height });
  const tf = makeTeamFactions('concord' as FactionId, 'emberhand' as FactionId);
  const meta = seedFromMission(state, mission, { units, structures, economy }, tf);
  const systems = orderSystems([
    makeMovementSystem(), makeHarvestSystem(economy, tf, refinements),
    makeCombatTargetingSystem(weapons), makeDamageSystem(weapons, refinements),
    makeProjectileSystem(weapons), makeConstructionSystem(structures, { drain: () => [] }),
    makeProductionSystem(units, tf), makePowerSystem(), makeVictorySystem(units),
    makeStealthSystem(), makePlanetEventSystem(units, refinements, tf), makeResearchSystem(),
    makeRegenSystem(tf), makeHeroSystem(units),
    // The baseline "player": a competent opponent held constant across all three runs,
    // so any change in win rate is attributable to the ENEMY's difficulty alone.
    makeAiSystem(units, {
      team: 'player', attackTile: meta.objectiveTile,
      personality: AI_PERSONALITIES.normal, factionId: 'concord',
    }, structures, refinements),
    makeAiSystem(units, {
      team: 'enemy', attackTile: meta.playerStartTile,
      difficulty, factionId: 'emberhand',
    }, structures, refinements),
  ]);

  const defeat = makeDefeatTracker();
  for (let t = 0; t < MATCH_TICKS; t++) {
    runTick(state, systems);
    if (t % 40 !== 0) continue;
    defeat.observe(state);
    const p = defeat.isDefeated(state, 'player');
    const e = defeat.isDefeated(state, 'enemy');
    if (p && e) return { winner: 'draw', ticks: t };
    if (p) return { winner: 'enemy', ticks: t };
    if (e) return { winner: 'player', ticks: t };
  }
  return { winner: 'draw', ticks: MATCH_TICKS };
}

const SEEDS = [42, 1337, 2024, 77, 505];

describe('difficulty is a real curve (Phase A3)', () => {
  it.skipIf(!process.env.BALANCE_DIFFICULTY)('a competent player beats Easy, loses to Hard', () => {
    const rates: Record<string, { wins: number; losses: number; draws: number; avgMin: number }> = {};
    for (const diff of ['easy', 'normal', 'hard'] as const) {
      let wins = 0, losses = 0, draws = 0, ticks = 0;
      for (const seed of SEEDS) {
        const r = playMatch(diff, seed);
        if (r.winner === 'player') wins++; else if (r.winner === 'enemy') losses++; else draws++;
        ticks += r.ticks;
      }
      rates[diff] = { wins, losses, draws, avgMin: +(ticks / SEEDS.length / 20 / 60).toFixed(1) };
      console.log(`  ${diff.padEnd(6)} baseline-player record: ${wins}W ${losses}L ${draws}D over ${SEEDS.length} seeds · avg ${rates[diff]!.avgMin} min`);
    }

    // The gate asserts LOSSES, not wins, because a draw (the 25-minute cap) means
    // mutual exhaustion — informative for pacing, but it says nothing about whether
    // the difficulty tier can beat a competent opponent, which is the actual question.
    const losses = (d: string): number => rates[d]!.losses;

    // Easy must never beat a competent player. This is the beginner guarantee.
    expect(losses('easy'), 'times the baseline player LOST to Easy').toBe(0);
    // Hard must genuinely threaten one.
    expect(losses('hard'), 'times the baseline player lost to Hard').toBeGreaterThanOrEqual(2);
    // And the curve must be monotonic — that is the whole point of the gate.
    // (Pre-overhaul this was flat: a passive player died at 4:10 on Easy, 3:16 on Hard.)
    expect(losses('easy'), 'Easy loses less often than Normal').toBeLessThanOrEqual(losses('normal'));
    expect(losses('normal'), 'Normal loses less often than Hard').toBeLessThanOrEqual(losses('hard'));
  }, 600000);

  it.skipIf(!process.env.BALANCE_DIFFICULTY)('matches resolve in a plausible RTS length, not 6 minutes', () => {
    const lengths = SEEDS.map(s => playMatch('normal', s).ticks / 20 / 60);
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    console.log(`  normal match lengths (min): ${lengths.map(l => l.toFixed(1)).join(', ')} · avg ${avg.toFixed(1)}`);
    // Before the overhaul an AI-vs-AI match resolved in 5:48. RA/WC3/D2K run 15-30.
    expect(avg, 'average match length in minutes').toBeGreaterThanOrEqual(8);
  }, 600000);
});
