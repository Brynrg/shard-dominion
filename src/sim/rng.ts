// ── CONTRACT: the ONLY source of randomness in the sim ───────────────────────
// Deterministic mulberry32. `Math.random` is banned in src/sim by the ESLint
// sim-purity guardrail; all stochastic sim behaviour draws from here so a seed
// reproduces a match. The internal state is serialisable for save/replay.
export interface Rng {
  /** Next float in [0, 1). */
  next(): number;
  /** Next integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
  /** Current internal state (for hashing / serialisation). */
  state(): number;
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    nextInt: (maxExclusive: number): number => {
      if (maxExclusive <= 0) return 0;
      return Math.floor(next() * maxExclusive);
    },
    state: (): number => a >>> 0,
  };
}
