// ── FG-1 command vocabulary tests: attack-move, stop, rally, select-type ────────
import { describe, it, expect, beforeEach } from 'vitest';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { makeCommandSystem } from '../../src/sim/systems/command.js';
import { makeCommandQueue, type CommandQueue } from '../../src/view/input.js';
import { makeMovementSystem } from '../../src/sim/systems/movement.js';
import { makeCombatTargetingSystem } from '../../src/sim/systems/combatTargeting.js';
import { makeDamageSystem } from '../../src/sim/systems/damage.js';
import { makeProductionSystem } from '../../src/sim/systems/production.js';
import { orderSystems, runTick, type SimSystem } from '../../src/sim/loop.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import { loadUnits } from '../../src/loaders/units.js';
import { loadStructures } from '../../src/loaders/structures.js';
import { loadWeapons } from '../../src/loaders/loader.js';
import unitsData from '../../data/units.json' with { type: 'json' };
import structuresData from '../../data/structures.json' with { type: 'json' };
import weaponsData from '../../data/weapons.json' with { type: 'json' };

const units = loadUnits(unitsData);
// Wait long enough for the SLOWEST basic unit these tests train, derived from
// data — a hardcoded 65 broke the moment infantry's buildTimeSeconds was retuned.
const BUILD_TICKS = Math.max(...['infantry', 'rocket_trooper', 'harvester']
  .map(id => Math.round((units.find(u => u.id === id)?.buildTimeSeconds ?? 5) * 20))) + 10;
const structures = loadStructures(structuresData);
const weapons = loadWeapons(weaponsData);

describe('FG-1 commands', () => {
  let state: SimState;
  let queue: CommandQueue;
  let systems: SimSystem[];

  beforeEach(() => {
    state = makeSimState({ seed: 1, mapWidth: 32, mapHeight: 32 });
    queue = makeCommandQueue();
    systems = orderSystems([
      makeCommandSystem(queue, structures, ['warden', 'vane'], [], units),
      makeMovementSystem(),
      makeCombatTargetingSystem(weapons),
      makeDamageSystem(weapons),
      makeProductionSystem(units),
    ]);
  });

  function addSoldier(tx: number, ty: number, team: 'player' | 'enemy' = 'player', hp = 20, selected = false) {
    return state.store.create({
      position: tileToWorldCenter({ tx, ty }),
      health: { hp, maxHp: hp },
      armor: { armorClass: 'LIGHT' },
      movement: { target: null, path: [], speed: 12 },
      combat: { weaponId: 'rifle', cooldownRemaining: 0, targetId: null },
      faction: { team, faction: 'infantry' },
      ...(selected ? { selection: { selected: true } } : {}),
    });
  }

  it('attack-move: holds to kill an enemy en route, then resumes and arrives', () => {
    const u = addSoldier(4, 10, 'player', 20, true);
    const enemy = addSoldier(10, 10, 'enemy', 60);
    state.store.get(enemy)!.components.movement = undefined as never; // stationary target
    const dest = tileToWorldCenter({ tx: 24, ty: 10 });

    queue.push({ type: 'attack-move', target: dest, tile: { tx: 24, ty: 10 } });
    let killedAt = -1, arrivedAt = -1;
    for (let t = 0; t < 900; t++) {
      runTick(state, systems);
      const eh = state.store.get(enemy)?.components.health?.hp ?? 0;
      if (killedAt < 0 && eh <= 0) killedAt = t;
      const m = state.store.get(u)!.components.movement!;
      if (arrivedAt < 0 && m.target === null) { arrivedAt = t; break; }
    }
    expect(killedAt, 'enemy should die to the attack-mover').toBeGreaterThan(0);
    expect(arrivedAt, 'unit should then resume and arrive').toBeGreaterThan(killedAt);
    const p = state.store.get(u)!.components.position!;
    expect(Math.hypot(p.wx - dest.wx, p.wy - dest.wy)).toBeLessThan(50);
  });

  it('plain move does NOT hold: the unit reaches its destination while the enemy still lives', () => {
    const u = addSoldier(4, 10, 'player', 20, true);
    const enemy = addSoldier(10, 10, 'enemy', 800); // too tough to die in passing
    state.store.get(enemy)!.components.movement = undefined as never;
    const dest = tileToWorldCenter({ tx: 24, ty: 10 });

    queue.push({ type: 'order', target: dest, tile: { tx: 24, ty: 10 } });
    let arrived = false;
    for (let t = 0; t < 900 && !arrived; t++) {
      runTick(state, systems);
      arrived = state.store.get(u)!.components.movement!.target === null;
    }
    expect(arrived).toBe(true);
    expect(state.store.get(enemy)!.components.health!.hp).toBeGreaterThan(0);
  });

  it('stop: halts movement, clears path/attack-move/combat target', () => {
    const u = addSoldier(4, 10, 'player', 20, true);
    queue.push({ type: 'attack-move', target: tileToWorldCenter({ tx: 24, ty: 10 }), tile: { tx: 24, ty: 10 } });
    for (let t = 0; t < 10; t++) runTick(state, systems);
    expect(state.store.get(u)!.components.movement!.target).not.toBeNull();

    queue.push({ type: 'stop' });
    runTick(state, systems);
    const m = state.store.get(u)!.components.movement!;
    expect(m.target).toBeNull();
    expect(m.path.length).toBe(0);
    expect(m.attackMove).toBe(false);
    expect(state.store.get(u)!.components.combat!.targetId).toBeNull();
    // And it stays put afterward.
    const p1 = { ...state.store.get(u)!.components.position! };
    for (let t = 0; t < 20; t++) runTick(state, systems);
    const p2 = state.store.get(u)!.components.position!;
    expect(p2.wx).toBe(p1.wx);
    expect(p2.wy).toBe(p1.wy);
  });

  it('rally: ground-order on a selected producer sets rally; fresh units move there', () => {
    const barracks = state.store.create({
      position: tileToWorldCenter({ tx: 8, ty: 8 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'barracks' },
      production: { queue: [], progress: 0 },
      health: { hp: 800, maxHp: 800 },
      selection: { selected: true },
    });
    state.store.create({ // bank
      position: tileToWorldCenter({ tx: 6, ty: 8 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'refinery' },
      economy: { credits: 500, refineryStorage: 500, maxStorage: 2000 },
      health: { hp: 1500, maxHp: 1500 },
    });
    const rallyAt = tileToWorldCenter({ tx: 14, ty: 14 });
    queue.push({ type: 'order', target: rallyAt, tile: { tx: 14, ty: 14 } });
    runTick(state, systems);
    expect(state.store.get(barracks)!.components.production!.rally).toEqual(rallyAt);
    // The building itself must NOT have moved or gained movement.
    expect(state.store.get(barracks)!.components.movement).toBeUndefined();

    queue.push({ type: 'train', unitId: 'infantry' });
    for (let t = 0; t < BUILD_TICKS + 40; t++) runTick(state, systems); // build + travel
    const fresh = state.store.all().find(e =>
      e.components.faction?.faction === 'infantry' && e.components.faction?.team === 'player');
    expect(fresh).toBeDefined();
    // It should be moving toward (or have arrived at) the rally point.
    const p = fresh!.components.position!;
    const m = fresh!.components.movement!;
    const headedToRally = m.target !== null
      ? (m.target.wx === rallyAt.wx && m.target.wy === rallyAt.wy)
      : Math.hypot(p.wx - rallyAt.wx, p.wy - rallyAt.wy) < 50;
    expect(headedToRally).toBe(true);
  });

  it('select-type: double-click selects all player units of that kind only', () => {
    const i1 = addSoldier(10, 10, 'player', 20, true);
    const i2 = addSoldier(20, 20);
    addSoldier(12, 10, 'enemy'); // enemy infantry must NOT be selected
    const harv = state.store.create({
      position: tileToWorldCenter({ tx: 11, ty: 10 }),
      movement: { target: null, path: [], speed: 10 },
      faction: { team: 'player', faction: 'harvester' },
      harvest: { state: 'IDLE', targetTile: null, targetRefinery: null, cargo: 0 },
    });
    queue.push({ type: 'select-type', target: tileToWorldCenter({ tx: 10, ty: 10 }) });
    runTick(state, systems);
    expect(state.store.get(i1)!.components.selection?.selected).toBe(true);
    expect(state.store.get(i2)!.components.selection?.selected).toBe(true);
    expect(state.store.get(harv)!.components.selection?.selected ?? false).toBe(false);
    let enemySelected = false;
    for (const e of state.store.all()) {
      if (e.components.faction?.team === 'enemy' && e.components.selection?.selected) enemySelected = true;
    }
    expect(enemySelected).toBe(false);
  });
});
