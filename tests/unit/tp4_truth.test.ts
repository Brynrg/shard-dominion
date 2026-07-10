// ── TP-4 (v0.42): persistence survives the loader; the hash sees EVERYTHING ─────
import { describe, it, expect, beforeEach } from 'vitest';
import { makeSimState, stateHash, type SimState } from '../../src/sim/state.js';
import { structureComponents, unitComponents } from '../../src/sim/factory.js';
import { loadStructures } from '../../src/loaders/structures.js';
import { loadUnits } from '../../src/loaders/units.js';
import { tileToWorldCenter } from '../../src/sim/coords.js';
import structuresData from '../../data/structures.json' with { type: 'json' };
import unitsData from '../../data/units.json' with { type: 'json' };

const structures = loadStructures(structuresData);
const units = loadUnits(unitsData);

// vitest runs in node — shim the storage the menu module touches.
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
};

describe('TP-4 — campaign persistence round-trips the loader', () => {
  beforeEach(() => store.clear());
  it('heroKills and reserve survive save → load (the dead-persistence bug)', async () => {
    const { loadProgress, recordCampaignCarry } = await import('../../src/view/menu.js');
    recordCampaignCarry(7, 2);
    const p = loadProgress();
    expect(p.heroKills).toBe(7);
    expect(p.reserve).toBe(2);
    // A second carry accumulates reserve (cap 5) and maxes heroKills.
    recordCampaignCarry(4, 4);
    const p2 = loadProgress();
    expect(p2.heroKills).toBe(7);
    expect(p2.reserve).toBe(5);
  });
});

describe('TP-4 — stateHash covers every authoritative field', () => {
  let state: SimState;
  let base: number;
  beforeEach(() => {
    state = makeSimState({ seed: 9, mapWidth: 32, mapHeight: 32 });
    state.store.create({
      position: tileToWorldCenter({ tx: 8, ty: 8 }),
      ...structureComponents('construction_yard', 'player', structures),
    });
    state.store.create({
      position: tileToWorldCenter({ tx: 10, ty: 8 }),
      ...structureComponents('refinery', 'player', structures, { credits: 500, refineryMaxStorage: 2000 }),
    });
    state.store.create({
      position: tileToWorldCenter({ tx: 12, ty: 8 }),
      ...unitComponents(units.find(u => u.id === 'gunship')!, 'player'),
    });
    base = stateHash(state);
  });
  const cases: [string, (s: SimState) => void][] = [
    ['credits', s => { s.store.all().find(e => e.components.economy)!.components.economy!.credits += 1; }],
    ['cells', s => { const b = s.store.all().find(e => e.components.economy)!.components.economy!; b.cells = (b.cells ?? 0) + 1; }],
    ['minedTotal', s => { const b = s.store.all().find(e => e.components.economy)!.components.economy!; b.minedTotal = (b.minedTotal ?? 0) + 5; }],
    ['movement target', s => { s.store.all().find(e => e.components.movement)!.components.movement!.target = { wx: 999, wy: 999 }; }],
    ['ammo', s => { s.store.all().find(e => e.components.combat?.ammo != null)!.components.combat!.ammo! -= 1; }],
    ['stance', s => { s.store.all().find(e => e.components.combat)!.components.combat!.stance = 'hold'; }],
    ['tech tier', s => { s.store.all().find(e => e.components.tech)!.components.tech!.tier = 3; }],
    ['buildProgress', s => { s.store.all().find(e => e.components.building)!.components.building!.buildProgress = 50; }],
    ['shield', s => { const u = s.store.all().find(e => e.components.shield); if (u) u.components.shield!.hp -= 5; else { s.store.all().find(e => e.components.combat)!.components.shield = { hp: 1, max: 20, regenDelay: 0 }; } }],
    ['production queue', s => { const p = s.store.all().find(e => e.components.production)!; p.components.production = { ...p.components.production!, queue: ['infantry'] }; }],
    ['experience', s => { s.store.all().find(e => e.components.combat)!.components.experience = { kills: 3, rank: 1 }; }],
  ];
  for (const [name, mutate] of cases) {
    it(`${name} changes the hash`, () => {
      mutate(state);
      expect(stateHash(state)).not.toBe(base);
    });
  }
});
