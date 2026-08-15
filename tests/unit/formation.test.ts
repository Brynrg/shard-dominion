// ── Deterministic formation destinations ───────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { asEntityId } from '../../src/sim/ids.js';
import { TILE_SUBUNITS, tileToWorldCenter, world } from '../../src/sim/coords.js';
import { formationTargets, slotOffsets, type FormationMember } from '../../src/sim/formation.js';

function member(id: number, tx: number, ty: number, flying = false): FormationMember {
  return { id: asEntityId(id), pos: tileToWorldCenter({ tx, ty }), flying };
}

describe('formation — slot grid', () => {
  it('eight units receive eight distinct destinations around the click', () => {
    const dest = tileToWorldCenter({ tx: 20, ty: 20 });
    const members = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => member(i + 1, 8 + (i % 4), 8 + Math.floor(i / 4)));
    const slots = formationTargets(members, dest);
    expect(slots.size).toBe(8);
    const keys = new Set<string>();
    for (const m of members) {
      const p = slots.get(m.id);
      expect(p, `unit ${m.id} missing a slot`).toBeDefined();
      keys.add(`${p!.wx},${p!.wy}`);
      // Compact: every slot sits within ~2 tiles of the requested centre.
      expect(Math.hypot(p!.wx - dest.wx, p!.wy - dest.wy)).toBeLessThanOrEqual(TILE_SUBUNITS * 2.5);
    }
    expect(keys.size).toBe(8);
  });

  it('repeating the same members + destination yields identical assignments', () => {
    const dest = tileToWorldCenter({ tx: 16, ty: 12 });
    const members = [10, 3, 7, 4].map((id, i) => member(id, 4 + i, 4));
    const a = formationTargets(members, dest);
    const b = formationTargets([...members].reverse(), dest);
    for (const m of members) {
      expect(b.get(m.id)).toEqual(a.get(m.id));
    }
  });

  it('a single selected unit keeps the exact clicked destination', () => {
    const dest = world(1234, 5678);
    const slots = formationTargets([member(9, 2, 2)], dest);
    expect(slots.get(asEntityId(9))).toEqual(dest);
  });

  it('queued-leg identity: the same unit keeps the same slot offset when travel direction matches', () => {
    // All members share X so both destinations sit due north of the centroid.
    const members = [1, 2, 3, 4].map((id, i) => member(id, 12, 18 + i));
    const a = tileToWorldCenter({ tx: 12, ty: 10 });
    const b = tileToWorldCenter({ tx: 12, ty: 4 });
    const first = formationTargets(members, a);
    const second = formationTargets(members, b);
    for (const m of members) {
      const p1 = first.get(m.id)!;
      const p2 = second.get(m.id)!;
      expect(p2.wx - b.wx).toBe(p1.wx - a.wx);
      expect(p2.wy - b.wy).toBe(p1.wy - a.wy);
    }
  });

  it('flying and ground cohorts are assigned independently', () => {
    const dest = tileToWorldCenter({ tx: 12, ty: 12 });
    const ground = [member(1, 4, 4), member(2, 5, 4)];
    const air = [member(3, 4, 5, true)];
    const slots = formationTargets([...ground, ...air], dest);
    // Lone flyer keeps the exact click; the two ground units spread.
    expect(slots.get(asEntityId(3))).toEqual(dest);
    expect(slots.get(asEntityId(1))).not.toEqual(slots.get(asEntityId(2)));
    expect(slots.get(asEntityId(1))).not.toEqual(dest);
  });

  it('slotOffsets(8) is a compact 3-wide grid', () => {
    const s = slotOffsets(8);
    expect(s.length).toBe(8);
    const cols = new Set(s.map((c) => c.col));
    expect(cols.size).toBeGreaterThanOrEqual(3);
  });
});
