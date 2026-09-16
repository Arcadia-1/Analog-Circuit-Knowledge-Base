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
/** How far outside the reachable range an input may still land inside its own code, in LSB. */
const REACH = 0.5;

function sum(a: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  return s;
}

export const binaryWeights = (n: number): number[] => Array.from({ length: n }, (_, j) => 2 ** (n - 1 - j));

/** Radix-1.8 integer weights summing to 2^N − 1 (largest-remainder rounding); N = 16 gives ADCToolbox's exp_d16 list. */
export function redundantWeights(n: number, radix = 1.8): number[] {
  const target = 2 ** n - 1;
  const m = Math.floor((n * Math.LN2) / Math.log(radix));
  const c = (target * (radix - 1)) / (radix ** m - 1);
  const exact = Array.from({ length: m }, (_, j) => c * radix ** (m - 1 - j));
  const w = exact.map(Math.floor);
  const order = w.map((_, j) => j).sort((a, b) => exact[b] - w[b] - (exact[a] - w[a]));
  for (const j of order.slice(0, target - sum(w))) w[j]++;
  return w;
}

/** How far (LSB) the input may lie above w_j when comparison j wrongly drops it: later weights plus one LSB, minus w_j. */
export const margin = (w: number[], j: number): number => sum(w.slice(j + 1)) + w[w.length - 1] - w[j];

/**
 * Inputs the converter can no longer resolve: a comparison that drops its weight leaves the later weights short of the
 * input, and no digital weights recover the sample. Sweeps the input range in steps of `step` LSB and returns the lost
 * ranges as fractions of full scale, with the fraction of full scale they cover.
 */
export function lostInputs(n: number, w: ArrayLike<number>, step = 0.25): { bands: [number, number][]; fraction: number } {
  const m = w.length, full = 2 ** n, reach = w[m - 1] + REACH;
  const bands: [number, number][] = [];
  let lost = 0, run = -1;
  for (let x = step / 2; x < full; x += step) {
    let dac = 0;
    for (let j = 0; j < m; j++) if (x >= dac + w[j]) dac += w[j];
    if (x - dac > reach) {
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
  /** the conversion can still end within half an LSB of the input's code if lo < x < hi */
  lo: number;
  hi: number;
}

/** sar_convert for one sample: add weight j to the kept DAC level and keep it if the input (plus comparator noise) is not lower. */
export function convert(x: number, w: ArrayLike<number>, noise: ArrayLike<number> | null, bits: Uint8Array, trace?: Trial[]): void {
  let dac = 0;
  let rest = sum(w);
  for (let j = 0; j < w.length; j++) {
    const test = dac + w[j];
    const bit = x + (noise ? noise[j] : 0) >= test ? 1 : 0;
    trace?.push({ test, bit, ideal: x >= test ? 1 : 0, lo: dac - REACH, hi: dac + rest + w[w.length - 1] + REACH });
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
 */
export function calibrate(bits: Uint8Array, nominal: number[], bin: number): Float64Array {
  const m = nominal.length, k = m + 2;
  const fits = [true, false].map((unitCos) => {
    const G = new Float64Array(k * k), h = new Float64Array(k), row = new Float64Array(k);
    let bb = 0;
    for (let i = 0; i < N_FFT; i++) {
      const ph = (2 * Math.PI * bin * i) / N_FFT, c = Math.cos(ph), s = Math.sin(ph);
      for (let j = 0; j < m; j++) row[j] = bits[i * m + j];
      row[m] = 1;
      row[m + 1] = unitCos ? s : c;
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
  const w = (fits[0].residual < fits[1].residual ? fits[0] : fits[1]).x.slice(0, m);
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
