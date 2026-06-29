import { SIM_TICK_RATE } from '../src/sim/index.js';

describe('toolchain smoke', () => {
  it('runs vitest and imports from src/sim', () => {
    expect(SIM_TICK_RATE).toBe(20);
  });
});
