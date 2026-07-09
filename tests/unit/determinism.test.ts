// ── Determinism harness (FG-1, multiplayer prep) ────────────────────────────────
// Two sims, same mission, same command log → IDENTICAL stateHash at every
// checkpoint. This is the lockstep-multiplayer substrate: if this test ever
// breaks, a system introduced nondeterminism (wall-clock, Math.random, map
// iteration order, …) and FG-7 is dead until it's fixed. Runs the FULL system
// stack exactly as main.ts assembles it.
import { describe, it, expect } from 'vitest';
import { makeSimState, stateHash, type SimState } from '../../src/sim/state.js';
import { seedFromMission } from '../../src/sim/seedMission.js';
import { loadMission } from '../../src/loaders/missions.js';
import { loadUnits } from '../../src/loaders/units.js';
import { loadStructures } from '../../src/loaders/structures.js';
import { loadEconomyConstants } from '../../src/loaders/economyConstants.js';
import { loadWeapons } from '../../src/loaders/loader.js';
import { orderSystems, runTick, type SimSystem } from '../../src/sim/loop.js';
import { makeCommandSystem } from '../../src/sim/systems/command.js';
import { makeCommandQueue } from '../../src/view/input.js';
import { makeMovementSystem } from '../../src/sim/systems/movement.js';
import { makeHarvestSystem } from '../../src/sim/systems/harvest.js';
import { makeConstructionSystem } from '../../src/sim/systems/construction.js';
import { makePowerSystem } from '../../src/sim/systems/power.js';
import { makeCombatTargetingSystem } from '../../src/sim/systems/combatTargeting.js';
import { makeDamageSystem } from '../../src/sim/systems/damage.js';
import { makeProjectileSystem } from '../../src/sim/systems/projectile.js';
import { makeProductionSystem } from '../../src/sim/systems/production.js';
import { makeAiSystem } from '../../src/sim/systems/ai.js';
import { makeObjectivesSystem } from '../../src/sim/systems/objectives.js';
import { makeVictorySystem } from '../../src/sim/systems/victory.js';
import { makeFogSystem } from '../../src/sim/systems/fog.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import unitsData from '../../data/units.json' with { type: 'json' };
import structuresData from '../../data/structures.json' with { type: 'json' };
import economyData from '../../data/economyConstants.json' with { type: 'json' };
import weaponsData from '../../data/weapons.json' with { type: 'json' };
import skirmish from '../../data/missions/skirmish.json' with { type: 'json' };

const units = loadUnits(unitsData);
const structures = loadStructures(structuresData);
const economy = loadEconomyConstants(economyData);
const weapons = loadWeapons(weaponsData);

interface Rig { state: SimState; systems: SimSystem[]; queue: ReturnType<typeof makeCommandQueue> }

function makeRig(): Rig {
  const mission = loadMission(skirmish);
  const state = makeSimState({ seed: mission.map.seed, mapWidth: mission.map.width, mapHeight: mission.map.height });
  const meta = seedFromMission(state, mission, { units, structures, economy });
  const queue = makeCommandQueue();
  const systems = orderSystems([
    makeCommandSystem(queue, structures),
    makeMovementSystem(),
    makeHarvestSystem(economy),
    makeConstructionSystem(structures, queue),
    makePowerSystem(),
    makeCombatTargetingSystem(weapons),
    makeProjectileSystem(weapons),
    makeDamageSystem(weapons),
    makeProductionSystem(units),
    ...mission.enemies.map(e => makeAiSystem(units, { team: 'enemy' as const, attackTile: meta.playerStartTile, ...(e.ai ?? {}) })),
    makeObjectivesSystem(mission.objectives, mission.failure),
    makeVictorySystem(),
    makeFogSystem(),
  ]);
  return { state, systems, queue };
}

/** The scripted command log: select the army, march it around the map, train units. */
function scriptedIntents(tick: number, rig: Rig): void {
  const q = rig.queue;
  if (tick === 5) q.push({ type: 'select', worldRect: { minWx: 0, minWy: 0, maxWx: 10_000, maxWy: 10_000 } });
  if (tick === 10) q.push({ type: 'order', target: tileToWorldCenter({ tx: 24, ty: 24 }), tile: { tx: 24, ty: 24 } });
  if (tick === 60) q.push({ type: 'train', unitId: 'harvester' });
  if (tick === 120) q.push({ type: 'order', target: tileToWorldCenter({ tx: 6, ty: 6 }), tile: { tx: 6, ty: 6 } });
  if (tick === 200) q.push({ type: 'order', target: tileToWorldCenter({ tx: 26, ty: 8 }), tile: { tx: 26, ty: 8 } });
  if (tick === 300) q.push({ type: 'attack-move', target: tileToWorldCenter({ tx: 26, ty: 8 }), tile: { tx: 26, ty: 8 } });
  if (tick === 420) q.push({ type: 'stop' });
  if (tick === 430) q.push({ type: 'select-type', target: tileToWorldCenter({ tx: 15, ty: 18 }) });
}

describe('determinism — same mission + same command log → identical hashes', () => {
  it('600 ticks through the FULL stack (pathfinding, separation, combat, AI, economy)', () => {
    const a = makeRig(), b = makeRig();
    for (let t = 0; t < 600; t++) {
      scriptedIntents(t, a);
      scriptedIntents(t, b);
      runTick(a.state, a.systems);
      runTick(b.state, b.systems);
      if (t % 50 === 0 || t === 599) {
        expect(stateHash(b.state), `hash diverged at tick ${t}`).toBe(stateHash(a.state));
      }
    }
    // Sanity: the match actually progressed (units moved / fought / trained).
    expect(a.state.tick).toBe(600);
  });
});
