/**
 * Binary vs redundant SAR ADC, ported from ADCToolbox 0.9.1 (github.com/Arcadia-1/ADCToolbox, python/src/adctoolbox).
 * Mirrors python/sar_binary_vs_redundant.py, which calls ADCToolbox directly; tests/sar-model.test.ts compares the two.
 *
 * Units are LSBs: ADCToolbox's normalised weights and input (full scale 1) times 2^N. Weights are MSB first.
 *   models/sar.py              sar_convert, sar_reconstruct, sar_apply_cap_mismatch
 *   calibration/               calibrate_weight_sine at a known frequency + scale_calibration_output(target_weights)
 *   spectrum/compute_spectrum  rectangular window, side_bin = 0, harmonics 2..5
 */
import { fft } from '../../lib/fft';

export const N_FFT = 4096;
/** Sampling rate of the modelled converter: 100 MS/s, so input frequency and clock jitter carry familiar units. */
export const FS = 100e6;
/** Tone bins of the 4096-point record; odd bins are coherent and keep every harmonic off the fundamental. */
export const TRAIN_BIN = 499;
export const TEST_BIN = 613;
export const TEST_PHASE = 0.37;
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
 * Bits of N_FFT conversions of a coherent −0.5 dBFS sine at `bin`. `noise` holds the comparator noise (LSB) row by row and
 * `timing` the sampling-instant error of each sample in sample periods, the way ADCToolbox's siggen applies clock jitter.
 */
export function capture(n: number, w: ArrayLike<number>, noise: Float64Array | null, bin: number, phase: number, timing: Float64Array | null = null): Uint8Array {
  const m = w.length, half = 2 ** (n - 1), amp = half * 10 ** (AMP_DBFS / 20);
  const bits = new Uint8Array(N_FFT * m);
  for (let i = 0; i < N_FFT; i++) {
    const x = half + amp * Math.sin((2 * Math.PI * bin * (i + (timing ? timing[i] : 0))) / N_FFT + phase);
    convert(x, w, noise?.subarray(i * m, (i + 1) * m) ?? null, bits.subarray(i * m, (i + 1) * m));
  }
  return bits;
}

/** Solve the symmetric positive-definite system G x = h (Cholesky, G stored row-major k × k). */
function solveSpd(G: Float64Array, h: Float64Array, k: number): Float64Array {
  const L = new Float64Array(k * k);
  for (let i = 0; i < k; i++) {
    for (let j = 0; j <= i; j++) {
      let s = G[i * k + j];
      for (let p = 0; p < j; p++) s -= L[i * k + p] * L[j * k + p];
      L[i * k + j] = i === j ? Math.sqrt(s) : s / L[j * k + j];
    }
  }
  const y = new Float64Array(k), x = new Float64Array(k);
  for (let i = 0; i < k; i++) {
    let s = h[i];
    for (let p = 0; p < i; p++) s -= L[i * k + p] * y[p];
    y[i] = s / L[i * k + i];
  }
  for (let i = k - 1; i >= 0; i--) {
    let s = y[i];
    for (let p = i + 1; p < k; p++) s -= L[p * k + i] * x[p];
    x[i] = s / L[i * k + i];
  }
  return x;
}

/**
 * calibrate_weight_sine at a known frequency (fundamental only), then scale_calibration_output(target_weights = nominal).
 * Least squares fits  Σ_j w_j b_j + offset + a·quadrature = −(unit tone), once with cosine and once with sine as the unit
 * tone, keeps the smaller residual, divides by the fitted tone magnitude √(1 + a²) and rescales to the nominal weight sum.
 * A bit that never changes over the capture carries no information — the redundant LSB of an ideal array is one — so it is
 * left out of the fit and comes back as a weight of zero, which is ADCToolbox's patch for the same rank deficiency.
 */
export function calibrate(bits: Uint8Array, nominal: number[], bin: number): Float64Array {
  const m = nominal.length;
  const live: number[] = [];
  for (let j = 0; j < m; j++) {
    for (let i = 1; i < N_FFT; i++) {
      if (bits[i * m + j] !== bits[j]) {
        live.push(j);
        break;
      }
    }
  }
  const k = live.length + 2;
  const fits = [true, false].map((unitCos) => {
    const G = new Float64Array(k * k), h = new Float64Array(k), row = new Float64Array(k);
    let bb = 0;
    for (let i = 0; i < N_FFT; i++) {
      const ph = (2 * Math.PI * bin * i) / N_FFT, c = Math.cos(ph), s = Math.sin(ph);
      for (let p = 0; p < live.length; p++) row[p] = bits[i * m + live[p]];
      row[live.length] = 1;
      row[live.length + 1] = unitCos ? s : c;
      const b = unitCos ? -c : -s;
      bb += b * b;
      for (let p = 0; p < k; p++) {
        h[p] += row[p] * b;
        for (let q = 0; q <= p; q++) G[p * k + q] += row[p] * row[q];
      }
    }
    for (let p = 0; p < k; p++) for (let q = p + 1; q < k; q++) G[p * k + q] = G[q * k + p];
    const x = solveSpd(G, h, k);
    let xh = 0;
    for (let p = 0; p < k; p++) xh += x[p] * h[p];
    return { x, residual: bb - xh };
  });
  const fit = (fits[0].residual < fits[1].residual ? fits[0] : fits[1]).x;
  const w = new Float64Array(m);
  live.forEach((j, p) => (w[j] = fit[p]));
  const scale = sum(nominal) / sum(w);
  return w.map((v) => v * scale);
}

export interface Spectrum {
  /** dBFS per bin, 0 … N_FFT/2 */
  dbfs: Float64Array;
  signal: number;
  spur: number;
  /** bins of harmonics 2 … 5 after folding */
  harmonics: number[];
  enob: number;
  sfdr: number;
}

/** analyze_spectrum: remove DC, normalise to full scale 2^N, one-sided power with a rectangular window, side_bin = 0. */
export function analyzeSpectrum(trace: Float64Array, n: number): Spectrum {
  const len = trace.length, half = len / 2, mean = sum(trace) / len, peak = 2 ** (n - 1);
  const re = trace.map((v) => (v - mean) / peak), im = new Float64Array(len);
  fft(re, im);
  const P = Float64Array.from({ length: half + 1 }, (_, k) => (4 * (re[k] ** 2 + im[k] ** 2)) / len ** 2);
  P[0] /= 2;
  P[half] /= 2;
  let signal = 1;
  for (let k = 2; k <= half; k++) if (P[k] > P[signal]) signal = k;
  let spur = 0, total = 0;
  for (let k = 0; k <= half; k++) {
    total += P[k];
    if (k !== signal && P[k] > P[spur]) spur = k;
  }
  const fold = (b: number) => (b % len > half ? len - (b % len) : b % len);
  const sndr = 10 * Math.log10(P[signal] / (total - P[signal] + 1e-20));
  return {
    dbfs: P.map((p) => 10 * Math.log10(p + 1e-20)),
    signal,
    spur,
    harmonics: [2, 3, 4, 5].map((h) => fold(h * signal)),
    enob: (sndr - 1.76) / 6.02,
    sfdr: 10 * Math.log10(P[signal] / P[spur]),
  };
}
