// ── Real-asset facing math: engine heading → sprite-sheet facing row ────────────
import { describe, it, expect } from 'vitest';
import { facingToRow } from '../../src/view/spritebank.js';

// Engine heading convention: atan2(dy,dx) with screen-Y down → 0 = East, +CW.
const E = 0, S = Math.PI / 2, W = Math.PI, N = -Math.PI / 2;

describe('facingToRow', () => {
  it('16 facings, 0=North clockwise (the spec default)', () => {
    expect(facingToRow(N, 16, 'north', 'cw')).toBe(0);
    expect(facingToRow(E, 16, 'north', 'cw')).toBe(4);   // 90° CW from N
    expect(facingToRow(S, 16, 'north', 'cw')).toBe(8);   // 180°
    expect(facingToRow(W, 16, 'north', 'cw')).toBe(12);  // 270°
  });

  it('8 facings, 0=North clockwise', () => {
    expect(facingToRow(N, 8, 'north', 'cw')).toBe(0);
    expect(facingToRow(E, 8, 'north', 'cw')).toBe(2);
    expect(facingToRow(S, 8, 'north', 'cw')).toBe(4);
    expect(facingToRow(W, 8, 'north', 'cw')).toBe(6);
  });

  it('honours facing0=east', () => {
    expect(facingToRow(E, 16, 'east', 'cw')).toBe(0);
    expect(facingToRow(S, 16, 'east', 'cw')).toBe(4);
  });

  it('honours counter-clockwise order', () => {
    // CW row for East (0=N) is 4; CCW mirrors it to 16-4 = 12.
    expect(facingToRow(E, 16, 'north', 'ccw')).toBe(12);
    expect(facingToRow(N, 16, 'north', 'ccw')).toBe(0);
  });

  it('wraps negative + large angles and collapses when facings<=1', () => {
    expect(facingToRow(N - Math.PI * 2, 16, 'north', 'cw')).toBe(0); // wrap
    expect(facingToRow(1.234, 1, 'north', 'cw')).toBe(0);            // single-facing (buildings)
  });
});
