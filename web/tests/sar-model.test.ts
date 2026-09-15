import { describe, expect, it } from 'vitest';
import {
  analyzeSpectrum,
  binaryWeights,
  calibrate,
  capMismatch,
  capture,
  convert,
  margin,
  reconstruct,
  redundantWeights,
  TEST_BIN,
  TEST_PHASE,
  TRAIN_BIN,
} from '../src/illustrations/sar/model';

/** The fixed "standard normals" of python/sar_binary_vs_redundant.py. */
const zFixed = (m: number) => Float64Array.from({ length: m }, (_, j) => 1.5 * Math.sin(2.3 * j + 0.9));
const weightsFor = (arch: 'binary' | 'redundant', n: number) => (arch === 'binary' ? binaryWeights(n) : redundantWeights(n));

describe('SAR ADC model, ported from ADCToolbox', () => {
  it('builds radix-1.8 weights that match ADCToolbox and keep every decision recoverable', () => {
    expect(redundantWeights(16)).toEqual([29127, 16182, 8990, 4995, 2775, 1542, 856, 476, 264, 147, 82, 45, 25, 14, 8, 4, 2, 1]);
    expect(redundantWeights(12)).toEqual([1820, 1011, 562, 312, 173, 96, 54, 30, 17, 9, 5, 3, 2, 1]);
    for (const n of [8, 10, 12, 14, 16]) {
      for (const w of [binaryWeights(n), redundantWeights(n)]) {
        expect(w.reduce((a, b) => a + b, 0) + w[w.length - 1]).toBe(2 ** n);
        expect(Math.min(...w.map((_, j) => margin(w, j)))).toBe(0);
      }
      expect(margin(redundantWeights(n), 0)).toBeGreaterThan(0);
    }
  });

  it('scales capacitor mismatch with the square root of the unit count', () => {
    const w = capMismatch([4, 2, 1], 0.1, [1, 1, 1]);
    expect(Array.from(w)).toEqual([4 * (1 + 0.1 / 2), 2 * (1 + 0.1 / Math.SQRT2), 1.1]);
  });

  it('converts every input to floor(x) with ideal capacitors', () => {
    for (const n of [8, 10]) {
      for (const w of [binaryWeights(n), redundantWeights(n)]) {
        const bits = new Uint8Array(w.length);
        for (let x = 0; x < 2 ** n; x += 0.125) {
          convert(x, w, null, bits);
          expect(reconstruct(bits, w)[0]).toBe(Math.floor(x));
        }
      }
    }
  });

  // [N, sigma, arch, ENOB before, SFDR before, ENOB after, SFDR after, DC code with nominal weights] from the Python reference
  const cases: [number, number, 'binary' | 'redundant', number, number, number, number, number][] = [
    [12, 0, 'binary', 11.9117, 95.281, 11.8995, 94.926, 3044],
    [12, 0, 'redundant', 11.9117, 95.281, 11.9105, 95.275, 3044],
    [12, 0.1, 'binary', 8.9193, 61.719, 11.4565, 94.217, 3040],
    [12, 0.1, 'redundant', 8.8363, 62.689, 12.0153, 97.492, 3042],
    [16, 0.1, 'binary', 10.927, 73.739, 14.8795, 115.711, 48701],
    [16, 0.1, 'redundant', 10.8421, 74.77, 15.7497, 121.075, 48707],
  ];
  it.each(cases)('matches ADCToolbox for N=%i, sigma=%f, %s', (n, sigma, arch, enobB, sfdrB, enobA, sfdrA, code) => {
    const nominal = weightsFor(arch, n);
    const actual = capMismatch(nominal, sigma, zFixed(nominal.length));
    const test = capture(n, actual, null, TEST_BIN, TEST_PHASE);
    const calibrated = calibrate(capture(n, actual, null, TRAIN_BIN, 0), nominal, TRAIN_BIN);
    const before = analyzeSpectrum(reconstruct(test, nominal), n);
    const after = analyzeSpectrum(reconstruct(test, calibrated), n);
    expect(before.enob).toBeCloseTo(enobB, 3);
    expect(before.sfdr).toBeCloseTo(sfdrB, 2);
    expect(after.enob).toBeCloseTo(enobA, 3);
    expect(after.sfdr).toBeCloseTo(sfdrA, 2);
    const bits = new Uint8Array(nominal.length);
    convert(0.7434 * 2 ** n, actual, null, bits);
    expect(reconstruct(bits, nominal)[0]).toBe(code);
  });
});
