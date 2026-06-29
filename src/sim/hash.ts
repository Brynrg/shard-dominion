// ── CONTRACT: FNV-1a state hash ──────────────────────────────────────────────
// A cheap, order-sensitive 32-bit hash of the sim state. Used by the blocking
// determinism smoke test: `sameSeed + sameCommandLog → identical hash`. Because
// it is order-sensitive, any iteration-order nondeterminism (unordered Set/Map)
// changes the hash — which is exactly the determinism killer ESLint can't see.
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** Fold a single 32-bit integer (4 bytes, little-endian) into a running hash. */
export function fnv1aInt(h: number, value: number): number {
  let acc = h >>> 0;
  let v = value | 0;
  for (let i = 0; i < 4; i++) {
    acc ^= v & 0xff;
    acc = Math.imul(acc, FNV_PRIME) >>> 0;
    v >>>= 8;
  }
  return acc >>> 0;
}

/** Hash an ordered sequence of integers. Order matters (that's the point). */
export function hashInts(values: Iterable<number>): number {
  let h = FNV_OFFSET;
  for (const v of values) h = fnv1aInt(h, v);
  return h >>> 0;
}
