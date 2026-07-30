// ── PACING PROBE (not a gate): measure the SHAPE of a match ────────────────────
// Run: PACING=1 npx vitest run tests/balance/_pacing_probe.test.ts
// Asserts nothing. Prints the income curve, milestone affordability timings, the
// enemy's aggression timeline, and match length — the numbers a gameplay review
// needs but no existing harness reports.
import { describe, it } from 'vitest';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { orderSystems, runTick, SIM_TICK_RATE } from '../../src/sim/loop.js';
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
import { makeConstructionSystem } from '../../src/sim/systems/construction.js';
import { makeResearchSystem } from '../../src/sim/systems/research.js';
import { makeRegenSystem } from '../../src/sim/systems/regen.js';
import { makeHeroSystem } from '../../src/sim/systems/hero.js';
import { makeAiSystem } from '../../src/sim/systems/ai.js';
import { seedFromMission } from '../../src/sim/seedMission.js';
import { loadMission } from '../../src/loaders/missions.js';
import { makeTeamFactions, type FactionId } from '../../src/sim/factions.js';
import { loadUnits } from '../../src/loaders/units.js';
import { loadStructures } from '../../src/loaders/structures.js';
import { loadWeapons } from '../../src/loaders/loader.js';
import { loadRefinements } from '../../src/loaders/refinements.js';
import { loadEconomyConstants } from '../../src/loaders/economyConstants.js';
import { teamCredits } from '../../src/sim/ledger.js';
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

const mmss = (tick: number): string => {
  const s = Math.round(tick / SIM_TICK_RATE);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

interface Snap {
  tick: number;
  pCredits: number; eCredits: number;
  pHarv: number; eHarv: number;
  pArmy: number; eArmy: number;
  pArmyValue: number; eArmyValue: number;
  pBuildings: number; eBuildings: number;
  aiPlan: string;
  enemyInPlayerHalf: number;
}

function build(passivePlayer: boolean, difficulty: 'easy' | 'normal' | 'hard') {
  const mission = loadMission(skirmishData);
  const state = makeSimState({ seed: mission.map.seed, mapWidth: 32, mapHeight: 32 });
  const tf = makeTeamFactions('concord' as FactionId, 'emberhand' as FactionId);
  const meta = seedFromMission(state, mission, { units, structures, economy }, tf);
  const enemyAi = makeAiSystem(units, {
    team: 'enemy', attackTile: meta.playerStartTile, difficulty, factionId: 'emberhand',
  }, structures, refinements);
  const list = [
    makeMovementSystem(), makeHarvestSystem(economy, tf), makeCombatTargetingSystem(weapons),
    makeDamageSystem(weapons, refinements), makeProjectileSystem(weapons),
    makeConstructionSystem(structures, { drain: () => [] }),
    makeProductionSystem(units, tf), makePowerSystem(),
    makeVictorySystem(units), makeStealthSystem(), makePlanetEventSystem(units, refinements, tf),
    makeResearchSystem(), makeRegenSystem(tf), makeHeroSystem(units),
    enemyAi,
  ];
  if (!passivePlayer) {
    list.push(makeAiSystem(units, { team: 'player', attackTile: meta.objectiveTile, difficulty, factionId: 'concord' }, structures, refinements));
  }
  return { state, systems: orderSystems(list), enemyAi, meta };
}

function snap(state: SimState, plan: string, meta: { playerStartTile: { tx: number; ty: number } }): Snap {
  const costOf = (id: string): number => units.find(u => u.id === id)?.cost ?? 0;
  let pHarv = 0, eHarv = 0, pArmy = 0, eArmy = 0, pAV = 0, eAV = 0, pB = 0, eB = 0, inHalf = 0;
  for (const e of state.store.all()) {
    const f = e.components.faction; if (!f) continue;
    const alive = (e.components.health?.hp ?? 1) > 0; if (!alive) continue;
    const isP = f.team === 'player';
    if (e.components.building) { if (isP) pB++; else if (f.team === 'enemy') eB++; continue; }
    if (e.components.harvest) { if (isP) pHarv++; else if (f.team === 'enemy') eHarv++; continue; }
    if (e.components.combat) {
      if (isP) { pArmy++; pAV += costOf(f.faction); }
      else if (f.team === 'enemy') {
        eArmy++; eAV += costOf(f.faction);
        const p = e.components.position;
        if (p && Math.hypot(p.wx - meta.playerStartTile.tx * 32, p.wy - meta.playerStartTile.ty * 32) < 12 * 32) inHalf++;
      }
    }
  }
  return {
    tick: state.tick,
    pCredits: Math.round(teamCredits(state, 'player')), eCredits: Math.round(teamCredits(state, 'enemy')),
    pHarv, eHarv, pArmy, eArmy, pArmyValue: pAV, eArmyValue: eAV, pBuildings: pB, eBuildings: eB,
    aiPlan: plan, enemyInPlayerHalf: inHalf,
  };
}

describe('pacing probe', () => {
  it.skipIf(!process.env.PACING)('passive player: what does the AI do to someone who only harvests?', () => {
    for (const diff of ['easy', 'normal', 'hard'] as const) {
      const { state, systems, enemyAi, meta } = build(true, diff);
      const rows: Snap[] = [];
      const plans = new Map<string, number>();
      let firstContact = -1, playerDead = -1;
      for (let t = 0; t < 24000; t++) {
        runTick(state, systems);
        const plan = enemyAi.debugState();
        plans.set(plan, (plans.get(plan) ?? 0) + 1);
        if (t % 400 === 0) {
          const s = snap(state, plan, meta);
          rows.push(s);
          if (firstContact < 0 && s.enemyInPlayerHalf > 0) firstContact = t;
        }
        if (playerDead < 0 && t % 40 === 0) {
          const anyP = [...state.store.all()].some(e => e.components.faction?.team === 'player' && (e.components.health?.hp ?? 0) > 0);
          if (!anyP) { playerDead = t; break; }
        }
      }
      console.log(`\n=== PASSIVE PLAYER · difficulty=${diff} ===`);
      console.log(`first enemy in player half: ${firstContact < 0 ? 'NEVER' : mmss(firstContact)} | player wiped: ${playerDead < 0 ? 'NEVER (survived 20 min doing nothing)' : mmss(playerDead)}`);
      console.log(`AI plan time share: ${[...plans.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${Math.round(100 * v / [...plans.values()].reduce((a, b) => a + b, 0))}%`).join(' ')}`);
      console.log('time   | pCr   eCr  | pHarv eHarv | pArmy eArmy | pAV   eAV   | pBld eBld | plan');
      for (const r of rows.filter((_, i) => i % 3 === 0)) {
        console.log(`${mmss(r.tick).padStart(5)}  | ${String(r.pCredits).padStart(5)} ${String(r.eCredits).padStart(5)} | ${String(r.pHarv).padStart(5)} ${String(r.eHarv).padStart(5)} | ${String(r.pArmy).padStart(5)} ${String(r.eArmy).padStart(5)} | ${String(r.pArmyValue).padStart(5)} ${String(r.eArmyValue).padStart(5)} | ${String(r.pBuildings).padStart(4)} ${String(r.eBuildings).padStart(4)} | ${r.aiPlan}`);
      }
    }
  });

  it.skipIf(!process.env.PACING)('milestone affordability: how long until the player can afford each thing?', () => {
    const { state, systems, enemyAi, meta } = build(true, 'normal');
    const targets: [string, number][] = [
      ['Barracks 300', 300], ['Power 400', 400], ['Refinery 1200', 1200],
      ['HQ Tier2 1000', 1000], ['War Factory 1000', 1000], ['Radar 600', 600],
      ['Proc Plant 800', 800], ['HQ Tier3 2000', 2000],
      ['Refinement T1 (~900)', 900], ['Refinement T2 1800', 1800],
    ];
    const cumulative = [300, 400, 1200, 1000, 600, 1000, 800, 2000];
    let need = 0; const hits: string[] = [];
    let idx = 0;
    let peak = 0;
    for (let t = 0; t < 24000; t++) {
      runTick(state, systems);
      const cr = teamCredits(state, 'player');
      peak = Math.max(peak, cr);
      if (idx < cumulative.length) {
        if (need === 0) need = cumulative[idx]!;
        if (cr >= need) { hits.push(`${targets[idx]![0]} affordable-in-isolation @ ${mmss(t)}`); idx++; need = 0; }
      }
    }
    console.log('\n=== MILESTONE AFFORDABILITY (passive, normal) ===');
    for (const h of hits) console.log('  ' + h);
    console.log(`  peak bank over 20 min: ◈${Math.round(peak)}`);
    console.log(`  final bank: ◈${Math.round(teamCredits(state, 'player'))}  (enemy ◈${Math.round(teamCredits(state, 'enemy'))})`);
    console.log(`  ai plan at end: ${enemyAi.debugState()}  meta=${JSON.stringify(meta.playerStartTile)}`);
  });

  it.skipIf(!process.env.PACING)('AI-vs-AI: how long is a real match, and how does it end?', () => {
    console.log('\n=== AI vs AI MATCH LENGTH ===');
    const { state, systems, enemyAi, meta } = build(false, 'normal');
    const marks: string[] = [];
    let lastPlan = '';
    for (let t = 0; t < 30000; t++) {
      runTick(state, systems);
      const plan = enemyAi.debugState();
      if (plan !== lastPlan) { marks.push(`${mmss(t)} enemy→${plan}`); lastPlan = plan; }
      if (t % 40 === 0) {
        const s = snap(state, plan, meta);
        if (s.pBuildings === 0 || s.eBuildings === 0) {
          console.log(`  decided @ ${mmss(t)} — player bld ${s.pBuildings}, enemy bld ${s.eBuildings}`);
          console.log(`  final: pArmy ${s.pArmy} (◈${s.pArmyValue}) vs eArmy ${s.eArmy} (◈${s.eArmyValue})`);
          break;
        }
        if (t === 29960) console.log(`  NO DECISION in 25 min — pBld ${s.pBuildings} eBld ${s.eBuildings}`);
      }
    }
    console.log(`  enemy plan transitions (first 30): ${marks.slice(0, 30).join(' | ')}`);
    console.log(`  total transitions: ${marks.length}`);
  });
});
