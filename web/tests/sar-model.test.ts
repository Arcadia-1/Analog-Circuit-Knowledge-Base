import { describe, expect, it } from 'vitest';
import { analyzeSpectrum, N_FFT } from '../src/lib/spectrum';
import { coherentFrequency } from '../src/lib/frequency';
import {
  binaryWeights,
  calibrate,
  capMismatch,
  capture,
  convert,
  DEFAULT_FFT_POINTS,
  FS,
  lostInputs,
  margin,
  reconstruct,
  RADIX,
  redundantWeights,
  TEST_BIN,
  TEST_PHASE,
  TRAIN_BIN,
  TRAIN_SAMPLES,
  weightsAfterCalibration,
} from '../src/illustrations/sar/model';
import { gaussians } from '../src/lib/rng';

/** The fixed "standard normals" of python/sar_binary_vs_redundant.py. */
const zFixed = (m: number) => Float64Array.from({ length: m }, (_, j) => 1.5 * Math.sin(2.3 * j + 0.9));
const weightsFor = (arch: 'binary' | 'redundant', n: number) => (arch === 'binary' ? binaryWeights(n) : redundantWeights(n));
const defaultTestBin = coherentFrequency(FS, (TEST_BIN / N_FFT) * FS, DEFAULT_FFT_POINTS).bin;

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

  it('returns the nearest code with ideal capacitors, thanks to the half unit that terminates the array', () => {
    for (const n of [8, 10]) {
      for (const w of [binaryWeights(n), redundantWeights(n)]) {
        const bits = new Uint8Array(w.length);
        for (let x = 0; x < 2 ** n - 1; x += 0.125) {
          convert(x, w, null, bits);
          expect(reconstruct(bits, w)[0]).toBe(Math.round(x));
        }
      }
    }
  });

  it('does not invent a weight correction when capacitor mismatch is zero', () => {
    for (const nominal of [binaryWeights(12), redundantWeights(12)]) {
      const train = capture(12, nominal, null, TRAIN_BIN, 0);
      const calibrated = weightsAfterCalibration(train, nominal, TRAIN_BIN, 0);
      expect(Array.from(calibrated)).toEqual(nominal);

      const test = capture(12, nominal, null, defaultTestBin, TEST_PHASE, null, DEFAULT_FFT_POINTS);
      expect(analyzeSpectrum(reconstruct(test, calibrated), 12)).toEqual(analyzeSpectrum(reconstruct(test, nominal), 12));
    }
  });

  // [jitter in ps, ENOB] from the Python reference, which samples the same tone at t + dt with the same standard normals
  it.each([
    [2, 11.5324],
    [5, 10.6285],
  ])('loses %i ps of clock jitter worth of ENOB', (jitterPs, enob) => {
    const w = binaryWeights(12);
    const clock = gaussians(DEFAULT_FFT_POINTS, 7).map((v) => v * jitterPs * 1e-12 * FS);
    const spectrum = analyzeSpectrum(reconstruct(capture(12, w, null, defaultTestBin, TEST_PHASE, clock, DEFAULT_FFT_POINTS), w), 12);
    expect(spectrum.enob).toBeCloseTo(enob, 3);
    // jitter alone holds the converter to SNR = -20 log10(2 pi f_in sigma_t); with quantisation the two powers add
    const alone = -20 * Math.log10(2 * Math.PI * (defaultTestBin / DEFAULT_FFT_POINTS) * FS * jitterPs * 1e-12);
    const quiet = 6.02 * analyzeSpectrum(reconstruct(capture(12, w, null, defaultTestBin, TEST_PHASE, null, DEFAULT_FFT_POINTS), w), 12).enob + 1.76;
    expect(6.02 * spectrum.enob + 1.76).toBeCloseTo(-10 * Math.log10(10 ** (-alone / 10) + 10 ** (-quiet / 10)), 0);
  });

  // [N, arch, chip, percentage of inputs with analog DAC error > 1 LSB] at 10 % unit-cap mismatch, from a 0.02 LSB sweep.
  // What a redundant array still loses is only the top of the range, where its capacitors happen to add up short of
  // full scale; a binary array loses that too, plus a gap wherever a weight outgrew the ones after it.
  it.each([
    [12, 'binary', 29, 1.1113],
    [12, 'redundant', 29, 0],
    [12, 'redundant', 7, 0.0449],
    [16, 'binary', 7, 2.7914],
    [16, 'redundant', 7, 0.012],
    [16, 'redundant', 29, 0],
  ] as const)('finds analog DAC errors above one LSB for a %i-bit %s chip', (n, arch, chip, percent) => {
    const nominal = weightsFor(arch, n);
    const actual = capMismatch(nominal, 0.1, gaussians(nominal.length, 1000 * chip + (arch === 'binary' ? 0 : 1)));
    expect(lostInputs(n, actual, 0.02).fraction * 100).toBeCloseTo(percent, 3);
    // the step the page draws with lands on the same answer and covers it with the bands it returns
    const { bands, fraction } = lostInputs(n, actual);
    expect(fraction * 100).toBeCloseTo(percent, 1);
    expect(bands.reduce((a, [lo, hi]) => a + hi - lo, 0)).toBeCloseTo(fraction, 6);
    // every flagged band meets the analog-error criterion: the conversion of its midpoint ends more than one LSB away from the input
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
    [12, 0, 'binary', 11.9979, 97.48, 11.9979, 97.48, 3045],
    [12, 0, 'redundant', 11.9979, 97.48, 11.9979, 97.48, 3045],
    [12, 0.1, 'binary', 9.0484, 62.266, 11.5652, 96.526, 3040],
    [12, 0.1, 'redundant', 8.9963, 65.614, 12.0372, 99.96, 3042],
    [16, 0.1, 'binary', 11.0607, 74.31, 14.9508, 117.437, 48701],
    [16, 0.1, 'redundant', 10.9789, 76.733, 16.3461, 127.255, 48709],
  ];
  it.each(cases)('matches ADCToolbox for N=%i, sigma=%f, %s', (n, sigma, arch, enobB, sfdrB, enobA, sfdrA, code) => {
    const nominal = weightsFor(arch, n);
    const actual = capMismatch(nominal, sigma, zFixed(nominal.length));
    const test = capture(n, actual, null, defaultTestBin, TEST_PHASE, null, DEFAULT_FFT_POINTS);
    const calibrated = weightsAfterCalibration(capture(n, actual, null, TRAIN_BIN, 0), nominal, TRAIN_BIN, sigma);
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

  it('tests a finite calibration record on an independent full record', () => {
    expect(TRAIN_SAMPLES).toBe(N_FFT);
    const after = (['binary', 'redundant'] as const).map((arch, i) => {
      const nominal = weightsFor(arch, 12);
      const actual = capMismatch(nominal, 0.1, gaussians(nominal.length, 43000 + i));
      const train = capture(12, actual, null, TRAIN_BIN, 0);
      const test = capture(12, actual, null, defaultTestBin, TEST_PHASE, null, DEFAULT_FFT_POINTS);
      return analyzeSpectrum(reconstruct(test, calibrate(train, nominal, TRAIN_BIN)), 12);
    });
    expect(after[0].enob).toBeCloseTo(10.3171, 3);
    expect(after[0].sfdr).toBeCloseTo(79.316, 2);
    expect(after[1].enob).toBeCloseTo(12.0305, 3);
    expect(after[1].sfdr).toBeCloseTo(99.7, 2);
    expect(after[1].enob - after[0].enob).toBeGreaterThan(1.7);
  });

  it('keeps the 4096-point calibration record independent of every selectable FFT length', () => {
    expect(TRAIN_SAMPLES).toBe(4096);
    const n = 12, nominal = binaryWeights(n);
    const train = capture(n, nominal, null, TRAIN_BIN, 0, null, TRAIN_SAMPLES);
    expect(train).toHaveLength(TRAIN_SAMPLES * nominal.length);

    for (const testPoints of [1024, 2048, 4096, 8192, 16384]) {
      const testBin = coherentFrequency(FS, (TEST_BIN / N_FFT) * FS, testPoints).bin;
      const test = capture(n, nominal, null, testBin, TEST_PHASE, null, testPoints);
      const spectrum = analyzeSpectrum(reconstruct(test, nominal), n);
      expect(test).toHaveLength(testPoints * nominal.length);
      expect(spectrum.signal).toBe(testBin);
      expect(spectrum.enob).toBeGreaterThan(11.98);
    }
  });

  it('keeps the finite weight fit well-defined at every selectable resolution', () => {
    for (const n of [8, 10, 12, 14, 16]) {
      for (const nominal of [binaryWeights(n), redundantWeights(n)]) {
        const actual = capMismatch(nominal, 0.1, gaussians(nominal.length, 9000 + n + nominal.length));
        const weights = calibrate(capture(n, actual, null, TRAIN_BIN, 0), nominal, TRAIN_BIN);
        expect(weights).toHaveLength(nominal.length);
        expect(Array.from(weights).every(Number.isFinite)).toBe(true);
      }
    }
  });
});
