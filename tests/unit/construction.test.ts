// ── S3 unit tests: placement validation + base power ────────────────────────────
import { describe, it, expect, beforeEach } from 'vitest';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { validatePlacement } from '../../src/sim/systems/command.js';
import { makePowerSystem } from '../../src/sim/systems/power.js';
import { loadStructures } from '../../src/loaders/structures.js';
import structuresData from '../../data/structures.json' with { type: 'json' };
import { tileToWorldCenter } from '../../src/sim/coords.js';

const structures = loadStructures(structuresData);
const powerNode = structures.find((s) => s.id === 'power_node')!;

describe('S3 placement + power', () => {
  let state: SimState;

  beforeEach(() => {
    state = makeSimState({ seed: 42, mapWidth: 32, mapHeight: 32 });
  });

  function addConYard(tx: number, ty: number) {
    return state.store.create({
      position: tileToWorldCenter({ tx, ty }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'construction_yard' },
    });
  }

  it('validates a placement inside a ConYard build radius', () => {
    addConYard(10, 10);
    const r = validatePlacement(state, powerNode, { tx: 10, ty: 12 });
    expect(r.valid).toBe(true);
  });

  it('rejects placement with no ConYard in range (OUTSIDE BUILD RADIUS)', () => {
    const r = validatePlacement(state, powerNode, { tx: 10, ty: 12 });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('OUTSIDE BUILD RADIUS');
  });

  it('rejects a tile already occupied (BLOCKED)', () => {
    addConYard(10, 10);
    state.store.create({
      position: tileToWorldCenter({ tx: 10, ty: 12 }),
      faction: { team: 'player', faction: 'refinery' },
    });
    const r = validatePlacement(state, powerNode, { tx: 10, ty: 12 });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('BLOCKED');
  });

  it('power system marks buildings powered when supply >= demand', () => {
    const power = makePowerSystem();
    const id = state.store.create({
      position: tileToWorldCenter({ tx: 5, ty: 5 }),
      building: { onSlab: true, buildProgress: 100, powered: false },
      faction: { team: 'player', faction: 'refinery' },
      power: { powerSupply: 100, powerDemand: 50, powered: false },
    });
    power.run(state);
    expect(state.store.get(id)?.components.building?.powered).toBe(true);
  });

  it('power system marks buildings unpowered when demand exceeds supply', () => {
    const power = makePowerSystem();
    const id = state.store.create({
      position: tileToWorldCenter({ tx: 5, ty: 5 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'refinery' },
      power: { powerSupply: 0, powerDemand: 100, powered: true },
    });
    power.run(state);
    expect(state.store.get(id)?.components.building?.powered).toBe(false);
  });
});
