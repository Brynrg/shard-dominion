// ── TP-3 (v0.42): construction is REAL — sites build up, scaffolding is inert ───
import { describe, it, expect } from 'vitest';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { orderSystems, runTick } from '../../src/sim/loop.js';
import { makeCommandSystem, validatePlacement } from '../../src/sim/systems/command.js';
import { makeConstructionSystem } from '../../src/sim/systems/construction.js';
import { makeCombatTargetingSystem } from '../../src/sim/systems/combatTargeting.js';
import { makeProductionSystem } from '../../src/sim/systems/production.js';
import { makePowerSystem, teamPowerShortage } from '../../src/sim/systems/power.js';
import { structureComponents, isOperational } from '../../src/sim/factory.js';
import { makeCommandQueue } from '../../src/view/input.js';
import { loadStructures } from '../../src/loaders/structures.js';
import { loadUnits } from '../../src/loaders/units.js';
import { loadWeapons } from '../../src/loaders/loader.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import structuresData from '../../data/structures.json' with { type: 'json' };
import unitsData from '../../data/units.json' with { type: 'json' };
import weaponsData from '../../data/weapons.json' with { type: 'json' };

const structures = loadStructures(structuresData);
const units = loadUnits(unitsData);
const weapons = loadWeapons(weaponsData);

function base(state: SimState, credits = 5000) {
  state.store.create({ position: tileToWorldCenter({ tx: 8, ty: 8 }), ...structureComponents('construction_yard', 'player', structures) });
  state.store.create({ position: tileToWorldCenter({ tx: 10, ty: 8 }), ...structureComponents('refinery', 'player', structures, { credits, refineryMaxStorage: 9000 }) });
}

describe('TP-3 — sites build up over buildTimeSeconds', () => {
  it('a placed turret is inert scaffolding, then fires once complete', () => {
    const state = makeSimState({ seed: 4, mapWidth: 32, mapHeight: 32 });
    base(state);
    const queue = makeCommandQueue();
    const sys = orderSystems([
      makeCommandSystem(queue, structures),
      makeConstructionSystem(structures, queue),
      makeCombatTargetingSystem(weapons),
    ]);
    // RA build flow (v0.55): the sidebar job serves the build time; tests
    // fast-forward it, then place the READY structure.
    queue.push({ type: 'build-structure', structureId: 'defense_turret' });
    runTick(state, sys);
    { const j = state.structureBuild.get('player'); if (j) j.ticksLeft = 0; }
    queue.push({ type: 'place-structure', structureId: 'defense_turret', tile: { tx: 12, ty: 10 } });
    runTick(state, sys);
    const turret = state.store.all().find(e => e.components.faction?.faction === 'defense_turret')!;
    expect(turret).toBeDefined();
    expect(isOperational(turret)).toBe(false);
    expect(turret.components.health!.hp).toBeLessThan(turret.components.health!.maxHp); // 20% scaffold
    // An enemy walks into range — the SITE must not acquire it.
    state.store.create({
      position: tileToWorldCenter({ tx: 13, ty: 10 }),
      movement: { target: null, path: [], speed: 12 },
      combat: { weaponId: 'rifle', cooldownRemaining: 999, targetId: null },
      faction: { team: 'enemy', faction: 'infantry' },
      health: { hp: 20, maxHp: 20 },
    });
    runTick(state, sys);
    expect(turret.components.combat!.targetId).toBeNull();
    // Run one full build time (def-driven) + margin → operational + acquires.
    const ticks = structures.find(st => st.id === 'defense_turret')!.buildTimeSeconds * 20 + 30;
    for (let i = 0; i < ticks; i++) runTick(state, sys);
    expect(isOperational(turret)).toBe(true);
    expect(turret.components.health!.hp).toBe(turret.components.health!.maxHp);
    expect(turret.components.combat!.targetId).not.toBeNull();
  });

  it('a barracks site cannot train until complete; power flows only when built', () => {
    const state = makeSimState({ seed: 4, mapWidth: 32, mapHeight: 32 });
    base(state);
    const queue = makeCommandQueue();
    const sys = orderSystems([
      makeCommandSystem(queue, structures),
      makeConstructionSystem(structures, queue),
      makeProductionSystem(units),
      makePowerSystem(),
    ]);
    // RA build flow (v0.55): the sidebar job serves the build time; tests
    // fast-forward it, then place the READY structure.
    queue.push({ type: 'build-structure', structureId: 'barracks' });
    runTick(state, sys);
    { const j = state.structureBuild.get('player'); if (j) j.ticksLeft = 0; }
    queue.push({ type: 'place-structure', structureId: 'barracks', tile: { tx: 12, ty: 12 } });
    // RA build flow (v0.55): the sidebar job serves the build time; tests
    // fast-forward it, then place the READY structure.
    queue.push({ type: 'build-structure', structureId: 'power_node' });
    runTick(state, sys);
    { const j = state.structureBuild.get('player'); if (j) j.ticksLeft = 0; }
    queue.push({ type: 'place-structure', structureId: 'power_node', tile: { tx: 6, ty: 12 } });
    runTick(state, sys);
    const barracks = state.store.all().find(e => e.components.faction?.faction === 'barracks')!;
    // Queue infantry into the SITE: production must not start.
    barracks.components.production = { queue: ['infantry'], progress: 0 };
    for (let i = 0; i < 20; i++) runTick(state, sys);
    expect(state.store.all().some(e => e.components.faction?.faction === 'infantry')).toBe(false);
    // Sites neither supply nor demand power while building.
    const powerSite = state.store.all().find(e => e.components.faction?.faction === 'power_node')!;
    expect(isOperational(powerSite)).toBe(false);
    // Finish both (def-driven tick counts + margin).
    const maxSeconds = Math.max(
      structures.find(st => st.id === 'barracks')!.buildTimeSeconds,
      structures.find(st => st.id === 'power_node')!.buildTimeSeconds,
    );
    for (let i = 0; i < maxSeconds * 20 + 40; i++) runTick(state, sys);
    expect(isOperational(barracks)).toBe(true);
    expect(isOperational(powerSite)).toBe(true);
    expect(teamPowerShortage(state, 'player')).toBe(false); // completed node supplies
    for (let i = 0; i < 100; i++) runTick(state, sys);
    expect(state.store.all().some(e => e.components.faction?.faction === 'infantry')).toBe(true);
  });
});

describe('TP-3 — footprint + team placement', () => {
  it('rejects off-map, occupied, and enemy-radius placements; accepts own-radius', () => {
    const state = makeSimState({ seed: 4, mapWidth: 32, mapHeight: 32 });
    base(state);
    const barracksDef = structures.find(s => s.id === 'barracks')!; // 2×2 footprint
    // Off the map edge (2×2 anchored at 31,31 spills out).
    expect(validatePlacement(state, barracksDef, { tx: 31, ty: 31 }, 'player').valid).toBe(false);
    // Overlapping the refinery's tile via the footprint's second column.
    expect(validatePlacement(state, barracksDef, { tx: 9, ty: 8 }, 'player').valid).toBe(false);
    // In own radius, clear ground: valid.
    expect(validatePlacement(state, barracksDef, { tx: 12, ty: 12 }, 'player').valid).toBe(true);
    // The ENEMY cannot leech the player's conyard radius.
    expect(validatePlacement(state, barracksDef, { tx: 12, ty: 12 }, 'enemy').valid).toBe(false);
  });
});
