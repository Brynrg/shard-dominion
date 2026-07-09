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
import badlands from '../../data/missions/skirmish_badlands.json' with { type: 'json' };
import m1 from '../../data/missions/m1_first_light.json' with { type: 'json' };
import m2 from '../../data/missions/m2_lifeblood.json' with { type: 'json' };
import m3 from '../../data/missions/m3_hold_the_line.json' with { type: 'json' };
import m4 from '../../data/missions/m4_the_vein.json' with { type: 'json' };
import m5 from '../../data/missions/m5_iron_ash.json' with { type: 'json' };
import m6 from '../../data/missions/m6_ashen_warlord.json' with { type: 'json' };
import m8 from '../../data/missions/m8_ashfall.json' with { type: 'json' };
import m9 from '../../data/missions/m9_the_exchange.json' with { type: 'json' };
import m10 from '../../data/missions/m10_stormline.json' with { type: 'json' };

const rawMissions: Record<string, unknown> = {
  skirmish, skirmish_badlands: badlands, m1_first_light: m1, m2_lifeblood: m2, m3_hold_the_line: m3,
  m4_the_vein: m4, m5_iron_ash: m5, m6_ashen_warlord: m6,
  m8_ashfall: m8, m9_the_exchange: m9, m10_stormline: m10,
};

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

  it('next pointers resolve to registered missions (unbroken campaign chain)', () => {
    const ids = new Set(missions.map(m => m.id));
    for (const m of missions) {
      if (m.next !== null) expect(ids.has(m.next), `${m.id}: next "${m.next}" not registered`).toBe(true);
    }
  });

  it('trigger ids are unique per mission; spawn kinds + tiles are legal', () => {
    for (const m of missions) {
      const tids = m.triggers.map(t => t.id);
      expect(new Set(tids).size).toBe(tids.length);
      for (const t of m.triggers) for (const a of t.actions) {
        if (a.type === 'spawn') {
          for (const su of a.units) {
            expect(validKinds.has(su.type), `${m.id}/${t.id}: unknown spawn kind "${su.type}"`).toBe(true);
            expect(su.tx >= 0 && su.tx < m.map.width && su.ty >= 0 && su.ty < m.map.height, `${m.id}/${t.id}: spawn out of bounds`).toBe(true);
          }
        }
      }
      for (const rw of m.rewards) {
        expect(m.objectives.some(o => o.id === rw.ifObjectiveComplete), `${m.id}: reward references unknown objective "${rw.ifObjectiveComplete}"`).toBe(true);
      }
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
