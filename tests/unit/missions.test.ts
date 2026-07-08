// ── Mission validation gate (campaign) ──────────────────────────────────────────
// The `validate:missions` CI check (§10 review) as a unit test: every mission file
// loads + validates, ids are unique, placed entities use known kinds and sit in-bounds,
// and every `destroy` objective targets a kind that is actually seeded on that side.
import { describe, it, expect } from 'vitest';
import { loadMission, type Mission } from '../../src/loaders/missions.js';
import { loadUnits } from '../../src/loaders/units.js';
import { loadStructures } from '../../src/loaders/structures.js';
import unitsData from '../../data/units.json' with { type: 'json' };
import structuresData from '../../data/structures.json' with { type: 'json' };
import skirmish from '../../data/missions/skirmish.json' with { type: 'json' };
import m1 from '../../data/missions/m1_first_light.json' with { type: 'json' };

const rawMissions: Record<string, unknown> = { skirmish, m1_first_light: m1 };

const units = loadUnits(unitsData);
const structures = loadStructures(structuresData);
// Placeable kinds = unit ids ∪ structure ids ∪ 'refinery' (seed-only building — the
// Refinery is not yet a buildable structure def; main.ts seeds it directly).
const validKinds = new Set<string>([...units.map(u => u.id), ...structures.map(s => s.id), 'refinery']);

function sideEntities(m: Mission, team: 'player' | 'enemy') {
  return team === 'player'
    ? [...m.player.buildings, ...m.player.units]
    : m.enemies.flatMap(e => [...e.buildings, ...e.units]);
}

describe('missions — schema + integrity', () => {
  const missions = Object.values(rawMissions).map(raw => loadMission(raw));

  it('every mission file loads and validates', () => {
    expect(missions.length).toBe(Object.keys(rawMissions).length);
    for (const m of missions) expect(m.id).toBeTruthy();
  });

  it('mission ids are unique', () => {
    const ids = missions.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('placed entities use known kinds and sit in bounds', () => {
    for (const m of missions) {
      const { width, height } = m.map;
      const inBounds = (tx: number, ty: number) => tx >= 0 && tx < width && ty >= 0 && ty < height;
      const placed = [...sideEntities(m, 'player'), ...sideEntities(m, 'enemy')];
      for (const p of placed) {
        expect(validKinds.has(p.type), `${m.id}: unknown kind "${p.type}"`).toBe(true);
        expect(inBounds(p.tx, p.ty), `${m.id}: "${p.type}" at (${p.tx},${p.ty}) out of bounds`).toBe(true);
      }
      const fields = [...m.fields, ...m.enemies.flatMap(e => e.fields)];
      for (const f of fields) {
        expect(inBounds(f.tx, f.ty), `${m.id}: field origin out of bounds`).toBe(true);
        expect(inBounds(f.tx + f.w - 1, f.ty + f.h - 1), `${m.id}: field extent out of bounds`).toBe(true);
      }
    }
  });

  it('every destroy objective targets a kind that is actually seeded on its side', () => {
    for (const m of missions) {
      for (const o of m.objectives) {
        if (o.type === 'destroy' && o.kind) {
          const present = sideEntities(m, o.team).some(p => p.type === o.kind);
          expect(present, `${m.id}: destroy objective targets "${o.kind}" but none is seeded on team ${o.team}`).toBe(true);
        }
      }
    }
  });

  it('next pointers are null or well-formed ids', () => {
    for (const m of missions) {
      if (m.next !== null) expect(typeof m.next === 'string' && m.next.length > 0).toBe(true);
    }
  });

  it('Mission 1 "First Light" has the expected shape', () => {
    const m = loadMission(m1);
    expect(m.id).toBe('m1_first_light');
    expect(m.objectives.some(o => o.type === 'destroy' && o.id === 'destroy_watchpost')).toBe(true);
    expect(m.failure.some(f => f.type === 'defeated' && f.team === 'player')).toBe(true);
    expect(m.next).toBe('m2_lifeblood');
  });
});
