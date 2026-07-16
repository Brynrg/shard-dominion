// ── v0.52 Sell (Westwood convention): demolish selected buildings, 50% refund ──
import { describe, it, expect, beforeEach } from 'vitest';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { makeCommandSystem } from '../../src/sim/systems/command.js';
import { orderSystems, runTick, type SimSystem } from '../../src/sim/loop.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import { makeCommandQueue, type CommandIntent } from '../../src/view/input.js';
import { loadStructures } from '../../src/loaders/structures.js';
import { teamCredits } from '../../src/sim/ledger.js';
import structuresData from '../../data/structures.json' with { type: 'json' };
import type { EntityId } from '../../src/sim/ids.js';

const structures = loadStructures(structuresData);
const barracksDef = structures.find(s => s.id === 'barracks')!;

describe('sell', () => {
  let state: SimState;
  let systems: readonly SimSystem[];
  let queue: { drain(): CommandIntent[]; push(intent: CommandIntent): void };

  beforeEach(() => {
    state = makeSimState({ seed: 42, mapWidth: 32, mapHeight: 32 });
    queue = makeCommandQueue();
    systems = orderSystems([makeCommandSystem(queue, structures)]);
  });

  const mkBank = (team: 'player' | 'enemy'): EntityId => state.store.create({
    position: tileToWorldCenter({ tx: 2, ty: 2 }),
    building: { buildProgress: 100, onSlab: true, powered: true },
    economy: { credits: 0, cells: 0, minedTotal: 0, maxStorage: 3500, refineryStorage: 0 },
    faction: { team, faction: 'refinery' },
  });

  const mkBarracks = (team: 'player' | 'enemy', progress = 100, selected = true): EntityId => state.store.create({
    position: tileToWorldCenter({ tx: 5, ty: 5 }),
    building: { buildProgress: progress, onSlab: true, powered: true },
    health: { hp: 300, maxHp: 300 },
    faction: { team, faction: 'barracks' },
    ...(selected ? { selection: { selected: true } } : {}),
  });

  it('selling a selected completed building removes it and refunds 50% of its cost', () => {
    mkBank('player');
    const b = mkBarracks('player');
    queue.push({ type: 'sell' });
    runTick(state, systems);
    expect(state.store.get(b)).toBeUndefined();
    expect(teamCredits(state, 'player')).toBe(Math.floor(barracksDef.cost * 0.5));
  });

  it('under-construction sites and other seats\' buildings never sell', () => {
    mkBank('player');
    const site = mkBarracks('player', 40);          // still going up
    const foes = mkBarracks('enemy', 100);          // selected but not ours
    queue.push({ type: 'sell' });
    runTick(state, systems);
    expect(state.store.get(site)).toBeDefined();
    expect(state.store.get(foes)).toBeDefined();
    expect(teamCredits(state, 'player')).toBe(0);
  });
});
