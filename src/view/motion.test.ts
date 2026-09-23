import { describe, expect, it } from 'vitest';
import { clipFrame, dampedTravel, unitMotion } from './motion.js';

describe('cosmetic animation timing', () => {
  it('loops movement but plays firing clips once, from frame zero', () => {
    expect(clipFrame(0, 6, 2, true)).toBe(0);
    expect(clipFrame(0.18, 6, 2, true)).toBe(1);
    expect(clipFrame(0.4, 6, 2, true)).toBe(1);
    expect(clipFrame(0.4, 6, 2)).toBe(0);
    expect(clipFrame(1, 0, 1)).toBe(0);
  });
  it('integrates the same particle path at 30, 60, and 120 Hz', () => {
    for (const hz of [30, 60, 120]) {
      let x = 0, v = 3;
      for (let i = 0; i < hz; i++) {
        x += dampedTravel(v, 60 / hz);
        v *= Math.pow(0.9, 60 / hz);
      }
      expect(x).toBeCloseTo(30 * (1 - Math.pow(0.9, 60)), 10);
    }
    expect(dampedTravel(3, 0)).toBe(0);
  });
  it('settles recoil and idle ground units, and respects reduced motion', () => {
    expect(unitMotion('assault_tank', 'firing', 0.05).recoil).toBeGreaterThan(1);
    expect(unitMotion('assault_tank', 'firing', 0.3).recoil).toBe(0);
    expect(unitMotion('infantry', 'idle', 1)).toEqual({ bob: 0, roll: 0, recoil: 0 });
    expect(Math.abs(unitMotion('gunship', 'idle', 1).bob)).toBeLessThanOrEqual(1.8);
    expect(unitMotion('gunship', 'moving', 0.5, true)).toEqual({ bob: 0, roll: 0, recoil: 0 });
  });
});
