import { makeEntityStore } from './store.js';
import { world } from './coords.js';

describe('EntityStore contract', () => {
  it('create() assigns the id and pins the one entity shape', () => {
    const store = makeEntityStore();
    const id = store.create({ position: world(40 * 256, 0), health: { hp: 100, maxHp: 100 } });
    const e = store.get(id);
    expect(e?.id).toBe(id);
    // one nesting level: entity.components.<key>
    expect(e?.components.position?.wx).toBe(40 * 256);
    expect(e?.components.health?.hp).toBe(100);
    // no double-nesting smuggled in
    expect((e?.components as Record<string, unknown>).components).toBeUndefined();
  });

  it('ids are monotonic and unique; removed ids are never reissued', () => {
    const store = makeEntityStore();
    const a = store.create({});
    const b = store.create({});
    expect(b).toBeGreaterThan(a);
    store.remove(a);
    const c = store.create({});
    expect(c).toBeGreaterThan(b);
    expect(store.has(a)).toBe(false);
  });

  it('all() iterates in ascending-id (creation) order — deterministic', () => {
    const store = makeEntityStore();
    const ids = [store.create({}), store.create({}), store.create({}), store.create({})];
    store.remove(ids[1]!);
    expect(store.all().map((e) => e.id)).toEqual([ids[0], ids[2], ids[3]]);
  });
});
