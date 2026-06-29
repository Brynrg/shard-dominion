import { makeRng } from './rng.js';
import { hashInts } from './hash.js';

describe('rng contract', () => {
  it('same seed → identical stream (determinism)', () => {
    const a = makeRng(12345);
    const b = makeRng(12345);
    const sa = Array.from({ length: 64 }, () => a.next());
    const sb = Array.from({ length: 64 }, () => b.next());
    expect(sa).toEqual(sb);
  });

  it('different seeds → different streams', () => {
    const a = makeRng(1);
    const b = makeRng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('next() stays in [0,1) and nextInt() in [0,max)', () => {
    const r = makeRng(99);
    for (let i = 0; i < 1000; i++) {
      const f = r.next();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = r.nextInt(7);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(7);
    }
  });

  it('hashInts is order-sensitive (catches iteration-order nondeterminism)', () => {
    expect(hashInts([1, 2, 3])).toBe(hashInts([1, 2, 3]));
    expect(hashInts([1, 2, 3])).not.toBe(hashInts([3, 2, 1]));
  });
});
