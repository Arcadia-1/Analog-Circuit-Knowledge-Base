import { describe, expect, it } from 'vitest';
import { binaryMoves, convert, redundancy, redundantMoves, sineTest, type Step } from '../src/illustrations/sar/model';

const movesFor = (arch: 'binary' | 'redundant', n: number) => (arch === 'binary' ? binaryMoves(n) : redundantMoves(n).moves);

const ideal = { settling: 0, noiseLsb: 0, mismatch: 0 };

describe('SAR ADC model', () => {
  it('builds redundant moves that cover the full scale and keep every decision recoverable', () => {
    for (const n of [6, 8, 10, 12]) {
      const { moves, radix } = redundantMoves(n);
      expect(moves.reduce((a, b) => a + b, 0)).toBe(2 ** (n - 1) - 1);
      expect(moves.length).toBe(n - 1 + Math.ceil(n / 6));
      expect(Math.min(...redundancy(moves))).toBeGreaterThanOrEqual(0);
      expect(radix).toBeGreaterThan(1.6);
      expect(radix).toBeLessThan(1.8);
      expect(Math.min(...redundancy(binaryMoves(n)))).toBe(0);
    }
  });

  it('converts every input exactly when ideal (both architectures)', () => {
    for (const n of [6, 8, 10]) {
      for (const arch of ['binary', 'redundant'] as const) {
        const mv = movesFor(arch, n);
        for (let x = 0; x < 2 ** n; x += 0.125) expect(convert(x, n, mv, ideal, null, null)).toBe(Math.floor(x));
      }
    }
  });

  // Deterministic cases (no random draws) must match python/sar_binary_vs_redundant.py to 0.05 dB.
  const cases: [number, number, 'binary' | 'redundant', number, number][] = [
    [8, 0, 'binary', 49.5, 0], [8, 0.04, 'binary', 45.9, 3], [8, 0.04, 'redundant', 49.2, 1],
    [10, 0.1, 'binary', 39.6, 26], [10, 0.1, 'redundant', 60.0, 1],
  ];
  it.each(cases)('N=%i settling=%f %s: SNDR %f dB, max error %i LSB', (n, eps, arch, sndr, maxErr) => {
    const r = sineTest(n, movesFor(arch, n), { settling: eps, noiseLsb: 0, mismatch: 0 }, null);
    expect(r.sndr).toBeCloseTo(sndr, 0);
    expect(Math.abs(r.sndr - sndr)).toBeLessThan(0.06);
    expect(r.maxErr).toBe(maxErr);
  });

  it('shows the binary MSB error the page opens with, and the redundant SAR correcting it', () => {
    const n = 8, x = 0.7434 * 256, imp = { settling: 0.05, noiseLsb: 0, mismatch: 0 };
    const bs: Step[] = [], rs: Step[] = [];
    const b = convert(x, n, movesFor('binary', n), imp, null, null, bs);
    const r = convert(x, n, movesFor('redundant', n), imp, null, null, rs);
    expect(bs[1].b).not.toBe(bs[1].ideal);
    expect(b).not.toBe(Math.floor(x));
    expect(r).toBe(Math.floor(x));
  });
});
