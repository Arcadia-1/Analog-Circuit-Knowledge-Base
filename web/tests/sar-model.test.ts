import { describe, expect, it } from 'vitest';
import {
  analyzeSpectrum,
  binaryWeights,
  calibrate,
  comparisons,
  capMismatch,
  capture,
  convert,
  FS,
  lostInputs,
  margin,
  N_FFT,
  reconstruct,
  RADIX,
  redundantWeights,
  TEST_BIN,
  TEST_PHASE,
  TRAIN_BIN,
} from '../src/illustrations/sar/model';
import { gaussians } from '../src/lib/rng';

/** The fixed "standard normals" of python/sar_binary_vs_redundant.py. */
const zFixed = (m: number) => Float64Array.from({ length: m }, (_, j) => 1.5 * Math.sin(2.3 * j + 0.9));
const weightsFor = (arch: 'binary' | 'redundant', n: number) => (arch === 'binary' ? binaryWeights(n) : redundantWeights(n));

describe('SAR ADC model, ported from ADCToolbox', () => {
  it('builds a redundant array out of the nominal resolution alone', () => {
    expect(redundantWeights(12)).toEqual([1743, 1001, 575, 330, 190, 109, 63, 36, 21, 12, 7, 4, 2, 1, 1]);
    expect(redundantWeights(16)).toEqual([28979, 16165, 9017, 5030, 2806, 1565, 873, 487, 272, 152, 85, 47, 26, 15, 8, 4, 2, 1, 1]);
    for (const n of [8, 10, 12, 14, 16]) {
      const w = redundantWeights(n), m = w.length;
      // m comparisons span exactly n bits, at a radix the target never exceeds
      expect(2 ** (n / m)).toBeLessThanOrEqual(RADIX);
      expect(2 ** (n / (m - 1))).toBeGreaterThan(RADIX);
      for (const v of [binaryWeights(n), w]) {
        expect(v.reduce((a, b) => a + b, 0) + v[v.length - 1]).toBe(2 ** n);
        expect(v[v.length - 1]).toBe(1);
        expect(Math.min(...v.map((_, j) => v[j] - (v[j + 1] ?? 0)))).toBeGreaterThanOrEqual(0);
      }
      // binary has no margin anywhere; redundant keeps at least one LSB at every comparison but the last
      expect(Math.max(...binaryWeights(n).map((_, j) => margin(binaryWeights(n), j)))).toBe(0);
      expect(Math.min(...w.slice(0, -1).map((_, j) => margin(w, j)))).toBe(1);
      expect(margin(w, 0)).toBeGreaterThan(2 ** (n - 5));
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

  // [jitter in ps, ENOB] from the Python reference, which samples the same tone at t + dt with the same standard normals
  it.each([
    [2, 11.4962],
    [5, 10.5965],
  ])('loses %i ps of clock jitter worth of ENOB', (jitterPs, enob) => {
    const w = binaryWeights(12);
    const clock = gaussians(2 * N_FFT, 7).map((v) => v * jitterPs * 1e-12 * FS);
    const spectrum = analyzeSpectrum(reconstruct(capture(12, w, null, TEST_BIN, TEST_PHASE, clock.subarray(0, N_FFT)), w), 12);
    expect(spectrum.enob).toBeCloseTo(enob, 3);
    // jitter alone holds the converter to SNR = -20 log10(2 pi f_in sigma_t); with quantisation the two powers add
    const alone = -20 * Math.log10(2 * Math.PI * (TEST_BIN / N_FFT) * FS * jitterPs * 1e-12);
    const quiet = 6.02 * analyzeSpectrum(reconstruct(capture(12, w, null, TEST_BIN, TEST_PHASE), w), 12).enob + 1.76;
    expect(6.02 * spectrum.enob + 1.76).toBeCloseTo(-10 * Math.log10(10 ** (-alone / 10) + 10 ** (-quiet / 10)), 0);
  });

  // [N, arch, chip, percentage of inputs no digital weights recover] at 10 % unit-cap mismatch, from a 0.02 LSB sweep.
  // What a redundant array still loses is only the top of the range, where its capacitors happen to add up short of
  // full scale; a binary array loses that too, plus a gap wherever a weight outgrew the ones after it.
  it.each([
    [12, 'binary', 29, 1.1157],
    [12, 'redundant', 29, 0],
    [12, 'redundant', 7, 0.0303],
    [16, 'binary', 7, 3.2424],
    [16, 'redundant', 7, 0.0113],
    [16, 'redundant', 29, 0],
  ] as const)('finds the inputs a %i-bit %s chip cannot resolve', (n, arch, chip, percent) => {
    const nominal = weightsFor(arch, n);
    const actual = capMismatch(nominal, 0.1, gaussians(nominal.length, 1000 * chip + (arch === 'binary' ? 0 : 1)));
    expect(lostInputs(n, actual, 0.02).fraction * 100).toBeCloseTo(percent, 3);
    // the step the page draws with lands on the same answer and covers it with the bands it returns
    const { bands, fraction } = lostInputs(n, actual);
    expect(fraction * 100).toBeCloseTo(percent, 1);
    expect(bands.reduce((a, [lo, hi]) => a + hi - lo, 0)).toBeCloseTo(fraction, 6);
    // every band really is lost: the conversion of its midpoint ends more than one LSB away from the input
    const bits = new Uint8Array(nominal.length);
    for (const [lo, hi] of bands.slice(0, 4)) {
      const x = ((lo + hi) / 2) * 2 ** n;
      convert(x, actual, null, bits);
      expect(Math.abs(reconstruct(bits, actual)[0] - x)).toBeGreaterThan(1);
    }
    // the redundant array only ever runs out of range at the top; the binary one has gaps inside it
    if (arch === 'redundant') expect(bands.filter(([, hi]) => hi < 1)).toHaveLength(0);
    else expect(bands.filter(([, hi]) => hi < 1).length).toBeGreaterThan(5);
  });

  // [N, sigma, arch, ENOB before, SFDR before, ENOB after, SFDR after, DC code with nominal weights] from the Python reference
  const cases: [number, number, 'binary' | 'redundant', number, number, number, number, number][] = [
    [12, 0, 'binary', 11.9117, 95.281, 11.8995, 94.926, 3044],
    [12, 0, 'redundant', 11.9117, 95.281, 11.908, 95.344, 3044],
    [12, 0.1, 'binary', 8.9193, 61.719, 11.4565, 94.217, 3040],
    [12, 0.1, 'redundant', 8.8672, 63.593, 11.9432, 98.121, 3041],
    [16, 0.1, 'binary', 10.927, 73.739, 14.8795, 115.711, 48701],
    [16, 0.1, 'redundant', 10.8418, 74.946, 16.2658, 123.733, 48709],
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
