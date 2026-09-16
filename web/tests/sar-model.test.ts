import { describe, expect, it } from 'vitest';
import {
  analyzeSpectrum,
  binaryWeights,
  calibrate,
  capMismatch,
  capture,
  convert,
  FS,
  lostInputs,
  margin,
  N_FFT,
  reconstruct,
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
  // The bottom of a radix-1.8 array is plain binary (... 8 4 2 1), so at 16 bits it loses inputs too, just far fewer.
  it.each([
    [12, 'binary', 29, 1.1157],
    [12, 'redundant', 29, 0],
    [12, 'redundant', 7, 0.0317],
    [16, 'binary', 7, 3.2424],
    [16, 'redundant', 7, 1.8215],
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
