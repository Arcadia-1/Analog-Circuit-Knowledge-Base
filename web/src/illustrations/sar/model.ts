/**
 * Binary vs redundant SAR ADC, ported from ADCToolbox 0.9.1 (github.com/Arcadia-1/ADCToolbox, python/src/adctoolbox).
 * Mirrors python/sar_binary_vs_redundant.py, which calls ADCToolbox directly; tests/sar-model.test.ts compares the two.
 *
 * Units are LSBs: ADCToolbox's normalised weights and input (full scale 1) times 2^N. Weights are MSB first.
 *   models/sar.py              sar_convert, sar_reconstruct, sar_apply_cap_mismatch
 *   calibration/               calibrate_weight_sine at a known frequency + scale_calibration_output(target_weights)
 *   spectrum/compute_spectrum  rectangular window, side_bin = 0, harmonics 2..5
 */
import { calibrateWeightSine } from '../../lib/calibration';
import { N_FFT } from '../../lib/spectrum';

/** Sampling rate of the modelled converter: 100 MS/s, so input frequency and clock jitter carry familiar units. */
export const FS = 100e6;
/** Tone bins of the 4096-point record; odd bins are coherent and keep every harmonic off the fundamental. */
export const TRAIN_BIN = 499;
export const TEST_BIN = 613;
export const TEST_PHASE = 0.37;
/**
 * A calibration has to learn the array from a finite observation, then work on a different capture. Fitting all 4096
 * test-length samples observes every bit column hundreds of times and hides the finite-data part of the lesson.
 */
export const TRAIN_SAMPLES = 128;
const AMP_DBFS = -0.5;
/**
 * The array is terminated by one more unit capacitor, which brings the total to 2^N units so that one unit is exactly
 * one LSB. Half of that terminating capacitor is switched to the reference, which puts every decision level half an LSB
 * below a code level: the converter rounds instead of truncating and its error is ±½ LSB rather than 0 … 1 LSB.
 */
const HALF = 0.5;

function sum(a: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  return s;
}

export const binaryWeights = (n: number): number[] => Array.from({ length: n }, (_, j) => 2 ** (n - 1 - j));

/** Largest radix a redundant array is allowed to use; the comparison count follows from it and the resolution. */
export const RADIX = 1.8;

/** Comparisons a redundant array of n nominal bits needs: the fewest whose radix 2^(n/m) does not exceed RADIX. */
export const comparisons = (n: number): number => Math.ceil((n * Math.LN2) / Math.log(RADIX));

/**
 * Weights of a redundant array, from its nominal resolution alone: a geometric series of radix 2^(n/m) — so m
 * comparisons span exactly n bits and the weights add up to 2^n − 1 — with every weight capped by the sum of the ones
 * after it, which is what leaves each comparison a margin of at least one LSB. The cap binds at the bottom, so the tail
 * comes out 4 2 1 1 rather than the plain 4 2 1 that would have no margin left at all.
 */
export function redundantWeights(n: number, m = comparisons(n)): number[] {
  const p = 2 ** (n / m), w = new Array<number>(m);
  let rest = 0;
  for (let j = m - 1; j > 0; j--) {
    w[j] = j === m - 1 ? 1 : Math.min(Math.round((p - 1) * p ** (m - 1 - j)), rest);
    rest += w[j];
  }
  w[0] = 2 ** n - 1 - rest;
  return w;
}

/** How far (LSB) the input may lie above w_j when comparison j wrongly drops it: later weights plus one LSB, minus w_j. */
export const margin = (w: number[], j: number): number => sum(w.slice(j + 1)) + w[w.length - 1] - w[j];

/**
 * Inputs whose code comes out more than a whole LSB away from them, which no set of digital weights can put right: a
 * comparison dropped its weight and left the later weights short of the input. Sub-LSB spacing errors are ordinary DNL
 * and are not counted. Sweeps the range in steps of `step` LSB and returns the lost ranges as fractions of full scale.
 */
export function lostInputs(n: number, w: ArrayLike<number>, step = 0.25): { bands: [number, number][]; fraction: number } {
  const m = w.length, full = 2 ** n;
  const bands: [number, number][] = [];
  let lost = 0, run = -1;
  for (let x = step / 2; x < full; x += step) {
    const u = x + HALF;
    let dac = 0;
    for (let j = 0; j < m; j++) if (u >= dac + w[j]) dac += w[j];
    if (Math.abs(x - dac) > 1) {
      lost++;
      if (run < 0) run = x - step / 2;
    } else if (run >= 0) {
      bands.push([run / full, (x - step / 2) / full]);
      run = -1;
    }
  }
  if (run >= 0) bands.push([run / full, 1]);
  return { bands, fraction: (lost * step) / full };
}

/** sar_apply_cap_mismatch: weight j is w_j / w_min unit capacitors, each with relative sigma σ, so σ_j = σ / √units. */
export function capMismatch(w: number[], sigma: number, z: ArrayLike<number>): Float64Array {
  const unit = Math.min(...w);
  return Float64Array.from(w, (v, j) => v * (1 + (sigma / Math.sqrt(v / unit)) * z[j]));
}

export interface Trial {
  /** DAC level tested in this comparison (LSB, actual capacitors) */
  test: number;
  bit: 0 | 1;
  /** decision of a noiseless comparator */
  ideal: 0 | 1;
  /** the conversion can still end within one LSB of the input if lo < x < hi */
  lo: number;
  hi: number;
}

/**
 * sar_convert for one sample: add weight j to the kept DAC level and keep it if the input (plus comparator noise) is not
 * lower. The half unit of the terminating capacitor offsets the input, so an ideal array returns the nearest code.
 */
export function convert(x: number, w: ArrayLike<number>, noise: ArrayLike<number> | null, bits: Uint8Array, trace?: Trial[]): void {
  const u = x + HALF;
  let dac = 0;
  let rest = sum(w);
  for (let j = 0; j < w.length; j++) {
    const test = dac + w[j];
    const bit = u + (noise ? noise[j] : 0) >= test ? 1 : 0;
    trace?.push({ test, bit, ideal: u >= test ? 1 : 0, lo: dac - HALF, hi: dac + rest + 1 });
    bits[j] = bit;
    rest -= w[j];
    if (bit) dac = test;
  }
}

/** sar_reconstruct: weighted sum of the bits of every sample (rows of `bits`). */
export function reconstruct(bits: Uint8Array, w: ArrayLike<number>): Float64Array {
  const m = w.length;
  return Float64Array.from({ length: bits.length / m }, (_, i) => {
    let v = 0;
    for (let j = 0; j < m; j++) v += bits[i * m + j] * w[j];
    return v;
  });
}

/**
 * Bits of `points` conversions of a coherent −0.5 dBFS sine at `bin`. `noise` holds the comparator noise (LSB) row by
 * row and `timing` the sampling-instant error of each sample in sample periods, the way ADCToolbox's siggen applies
 * clock jitter.
 */
export function capture(
  n: number,
  w: ArrayLike<number>,
  noise: Float64Array | null,
  bin: number,
  phase: number,
  timing: Float64Array | null = null,
  points = N_FFT,
): Uint8Array {
  const m = w.length, half = 2 ** (n - 1), amp = half * 10 ** (AMP_DBFS / 20);
  const bits = new Uint8Array(points * m);
  for (let i = 0; i < points; i++) {
    const x = half + amp * Math.sin((2 * Math.PI * bin * (i + (timing ? timing[i] : 0))) / points + phase);
    convert(x, w, noise?.subarray(i * m, (i + 1) * m) ?? null, bits.subarray(i * m, (i + 1) * m));
  }
  return bits;
}

/**
 * calibrate_weight_sine on the first `samples` rows at a known frequency (fundamental only, src/lib/calibration.ts), then
 * scale_calibration_output(target_weights = nominal), which rescales the weights to the nominal sum. The redundant LSB of
 * an ideal array never changes, so it comes back with a weight of zero.
 */
export function calibrate(bits: Uint8Array, nominal: number[], bin: number, samples = TRAIN_SAMPLES, recordPoints = N_FFT): Float64Array {
  const used = bits.length > samples * nominal.length ? bits.slice(0, samples * nominal.length) : bits;
  const w = calibrateWeightSine(used, nominal.length, bin / recordPoints).weight;
  const scale = sum(nominal) / sum(w);
  return w.map((v) => v * scale);
}
