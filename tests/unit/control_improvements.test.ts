import { describe, expect, it } from 'vitest';
import { makeSimState } from '../../src/sim/state.js';
import { makeCommandSystem } from '../../src/sim/systems/command.js';
import { makeCommandQueue } from '../../src/view/input.js';
import { loadUnits } from '../../src/loaders/units.js';
import unitsData from '../../data/units.json' with { type: 'json' };
import { makeProductionSystem } from '../../src/sim/systems/production.js';
import { orderSystems, runTick, SIM_TICK_RATE } from '../../src/sim/loop.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';

describe('selection and parallel production', () => {
  it('Shift-click toggles one unit, Shift-box adds, and the other seat is untouched', () => {
    const state = makeSimState({ seed: 1, mapWidth: 32, mapHeight: 32 });
    const queue = makeCommandQueue();
    const command = makeCommandSystem(queue, []);
    const add = (tx: number, team: 'player' | 'enemy') => state.store.create({
      position: tileToWorldCenter({ tx, ty: 8 }), faction: { team, faction: 'infantry' },
      selection: { selected: true },
    });
    const a = add(4, 'player'), b = add(8, 'player'), enemy = add(12, 'enemy');
    queue.push({ type: 'select', target: tileToWorldCenter({ tx: 4, ty: 8 }), additive: true });
    command.run(state);
    expect(state.store.get(a)!.components.selection?.selected).toBe(false);
    expect(state.store.get(b)!.components.selection?.selected).toBe(true);
    const point = tileToWorldCenter({ tx: 4, ty: 8 });
    queue.push({ type: 'select', additive: true, worldRect: { minWx: point.wx - 10, maxWx: point.wx + 10, minWy: point.wy - 10, maxWy: point.wy + 10 } });
    command.run(state);
    expect([a, b, enemy].map(id => state.store.get(id)!.components.selection?.selected)).toEqual([true, true, true]);
    queue.push({ type: 'select', target: tileToWorldCenter({ tx: 20, ty: 20 }), additive: true });
    command.run(state);
    expect([a, b].map(id => state.store.get(id)!.components.selection?.selected)).toEqual([true, true]);
  });

  it('balances queued training across completed living producers, deterministically', () => {
    const state = makeSimState({ seed: 1, mapWidth: 32, mapHeight: 32 });
    const queue = makeCommandQueue();
    const command = makeCommandSystem(queue, [], [], [], [{ id: 'infantry', cost: 100, producedBy: 'barracks' }]);
    const add = (progress: number, hp = 100) => state.store.create({
      faction: { team: 'player', faction: 'barracks' }, health: { hp, maxHp: 100 },
      building: { onSlab: true, buildProgress: progress, powered: true },
      production: { queue: [], progress: 0 },
    });
    const site = add(50), dead = add(100, 0), first = add(100), second = add(100);
    for (let i = 0; i < 5; i++) queue.push({ type: 'train', unitId: 'infantry' });
    command.run(state);
    expect([site, dead, first, second].map(id => state.store.get(id)!.components.production!.queue.length)).toEqual([0, 0, 3, 2]);
  });

  it('cancels an unpaid queued copy before interrupting another building’s paid job', () => {
    const state = makeSimState({ seed: 1, mapWidth: 32, mapHeight: 32 });
    const queue = makeCommandQueue();
    const command = makeCommandSystem(queue, []);
    const active = state.store.create({ faction: { team: 'player', faction: 'barracks' },
      production: { queue: [], current: 'infantry', progress: 80 } });
    const waiting = state.store.create({ faction: { team: 'player', faction: 'barracks' },
      production: { queue: ['infantry'], progress: 0 } });
    queue.push({ type: 'cancel-train', unitId: 'infantry' });
    command.run(state);
    expect(state.store.get(active)!.components.production!.current).toBe('infantry');
    expect(state.store.get(active)!.components.production!.progress).toBe(80);
    expect(state.store.get(waiting)!.components.production!.queue).toEqual([]);
  });
  it('two barracks actually complete two units within one production cycle', () => {
    const state = makeSimState({ seed: 1, mapWidth: 32, mapHeight: 32 });
    const queue = makeCommandQueue(), units = loadUnits(unitsData);
    const infantry = units.find(u => u.id === 'infantry')!;
    const systems = orderSystems([makeCommandSystem(queue, [], [], [], units), makeProductionSystem(units)]);
    for (const tx of [5, 10]) state.store.create({
      position: tileToWorldCenter({ tx, ty: 5 }), faction: { team: 'player', faction: 'barracks' },
      building: { onSlab: true, buildProgress: 100, powered: true },
      production: { queue: [], progress: 0 },
    });
    state.store.create({ faction: { team: 'player', faction: 'refinery' },
      economy: { credits: infantry.cost * 2, refineryStorage: 0, maxStorage: 2000 } });
    queue.push({ type: 'train', unitId: 'infantry' });
    queue.push({ type: 'train', unitId: 'infantry' });
    for (let tick = 0; tick < Math.ceil(infantry.buildTimeSeconds * SIM_TICK_RATE) + 1; tick++) runTick(state, systems);
    expect(state.store.all().filter(e => e.components.faction?.faction === 'infantry')).toHaveLength(2);
    expect(state.store.all().find(e => e.components.economy)!.components.economy!.credits).toBe(0);
  });

  it('preserves a train order while the only factory unfolds', () => {
    const state = makeSimState({ seed: 1, mapWidth: 32, mapHeight: 32 });
    const queue = makeCommandQueue(), units = loadUnits(unitsData);
    const command = makeCommandSystem(queue, [], [], [], units);
    const production = makeProductionSystem(units);
    const site = state.store.create({
      position: tileToWorldCenter({ tx: 5, ty: 5 }), faction: { team: 'player', faction: 'barracks' },
      building: { onSlab: true, buildProgress: 50, powered: true },
      production: { queue: [], progress: 0 },
    });
    queue.push({ type: 'train', unitId: 'infantry' });
    command.run(state);
    production.run(state);
    expect(state.store.get(site)!.components.production!.queue).toEqual(['infantry']);
    expect(state.store.get(site)!.components.production!.current).toBeUndefined();
  });

});
