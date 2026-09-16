/**
 * Reading an ADC's error: fit an ideal sine to the output, subtract it, and look at what is left four different ways.
 * Ported from ADCToolbox 0.9.1 (github.com/Arcadia-1/ADCToolbox):
 *   fundamentals/fit_sine_4param   least squares for A cos + B sin + C at a known frequency
 *   aout/rearrange_error_by_value  residual binned by signal value, mean and rms per bin
 *   aout/rearrange_error_by_phase  residual binned by phase, with the AM / PM / noise split
 *   aout/analyze_error_pdf         distribution of the residual
 *   aout/analyze_error_spectrum    spectrum of the residual
 *   siggen/nonidealities           apply_thermal_noise, apply_static_nonlinearity, apply_jitter,
 *                                  apply_memory_effect, apply_am_tone, apply_quantization_noise
 * python/adc_error_views.py calls ADCToolbox on the same waveform; tests/errors-model.test.ts compares the two.
 *
 * Units are LSB: full scale is 2^N and the sine sits at mid-scale.
 */
import { gaussians } from '../../lib/rng';
import { analyzeSpectrum, N_FFT, type Spectrum } from '../../lib/spectrum';

/** Sampling rate of the modelled converter, so jitter carries familiar units. */
export const FS = 100e6;
export const TEST_BIN = 613;
const AMP_DBFS = -1;

export interface Impairments {
  /** rms thermal noise, LSB */
  noise: number;
  /** second-order term of the static curve, as a fraction of full swing */
  k2: number;
  /** third-order term */
  k3: number;
  /** rms sampling-clock jitter, seconds */
  jitter: number;
  /** fraction of the previous coarse sample that leaks into this one */
  memory: number;
  /** depth of an amplitude-modulating tone, and its bin */
  amDepth: number;
  amBin: number;
}

export const QUIET: Impairments = { noise: 0, k2: 0, k3: 0, jitter: 0, memory: 0, amDepth: 0, amBin: 41 };

/**
 * One capture of a coherent sine through the impairments, in the order ADCToolbox's signal generator applies them:
 * the static curve bends the input, the sampler carries jitter and memory of the last sample, an interfering tone
 * modulates it, thermal noise adds, and the quantiser rounds to the nearest code.
 */
export function capture(n: number, bin: number, imp: Impairments, seed: number): Float64Array {
  const codes = 2 ** n, mid = codes / 2, amp = mid * 10 ** (AMP_DBFS / 20);
  const zJitter = gaussians(N_FFT, seed), zNoise = gaussians(N_FFT, seed + 1);
  const out = new Float64Array(N_FFT);
  let prevMsb = 0;
  for (let i = 0; i < N_FFT; i++) {
    const t = i + (imp.jitter ? zJitter[i] * imp.jitter * FS : 0);
    const u = Math.sin((2 * Math.PI * bin * t) / N_FFT);
    // apply_static_nonlinearity, with the swing normalised so k2 and k3 read as fractions of full scale
    let ac = amp * (u + imp.k2 * u * u + imp.k3 * u * u * u);
    // apply_am_tone
    if (imp.amDepth) ac *= 1 + imp.amDepth * Math.sin((2 * Math.PI * imp.amBin * i) / N_FFT);
    let x = mid + ac;
    // apply_memory_effect: the previous coarse decision leaks back into this sample
    if (imp.memory) {
      const msb = Math.floor((x / codes) * 16) / 16;
      x = codes * (msb + Math.floor((x / codes - msb) * 4096) / 4096 + imp.memory * prevMsb);
      prevMsb = msb;
    }
    // apply_thermal_noise, then the converter itself
    out[i] = Math.round(x + (imp.noise ? zNoise[i] * imp.noise : 0));
  }
  return out;
}

export interface Fit {
  fitted: Float64Array;
  error: Float64Array;
  amplitude: number;
  dc: number;
  /** phase of the fitted A cos(wt) + B sin(wt), as ADCToolbox reports it */
  phase: number;
  rmse: number;
}

/** fit_sine_4param at a known frequency: least squares for A cos(wt) + B sin(wt) + C, which is a 3 × 3 normal system. */
export function fitSine(y: Float64Array, bin: number): Fit {
  const w = (2 * Math.PI * bin) / N_FFT;
  let cc = 0, ss = 0, cs = 0, c1 = 0, s1 = 0, yc = 0, ys = 0, y1 = 0;
  for (let i = 0; i < y.length; i++) {
    const c = Math.cos(w * i), s = Math.sin(w * i);
    cc += c * c;
    ss += s * s;
    cs += c * s;
    c1 += c;
    s1 += s;
    yc += y[i] * c;
    ys += y[i] * s;
    y1 += y[i];
  }
  const m = [
    [cc, cs, c1],
    [cs, ss, s1],
    [c1, s1, y.length],
  ];
  const [a, b, dc] = solve3(m, [yc, ys, y1]);
  const fitted = new Float64Array(y.length), error = new Float64Array(y.length);
  let sq = 0;
  for (let i = 0; i < y.length; i++) {
    fitted[i] = a * Math.cos(w * i) + b * Math.sin(w * i) + dc;
    error[i] = y[i] - fitted[i];
    sq += error[i] * error[i];
  }
  return { fitted, error, amplitude: Math.hypot(a, b), dc, phase: Math.atan2(-b, a), rmse: Math.sqrt(sq / y.length) };
}

/** Gaussian elimination on a 3 × 3 system. */
function solve3(m: number[][], r: number[]): [number, number, number] {
  const a = m.map((row, i) => [...row, r[i]]);
  for (let i = 0; i < 3; i++) {
    let p = i;
    for (let k = i + 1; k < 3; k++) if (Math.abs(a[k][i]) > Math.abs(a[p][i])) p = k;
    [a[i], a[p]] = [a[p], a[i]];
    for (let k = i + 1; k < 3; k++) {
      const f = a[k][i] / a[i][i];
      for (let j = i; j < 4; j++) a[k][j] -= f * a[i][j];
    }
  }
  const x = [0, 0, 0];
  for (let i = 2; i >= 0; i--) {
    let s = a[i][3];
    for (let j = i + 1; j < 3; j++) s -= a[i][j] * x[j];
    x[i] = s / a[i][i];
  }
  return x as [number, number, number];
}

export interface Bins {
  centers: Float64Array;
  mean: Float64Array;
  rms: Float64Array;
  counts: Float64Array;
}

function bin(index: (i: number) => number, error: Float64Array, centers: Float64Array): Bins {
  const k = centers.length;
  const counts = new Float64Array(k), sum = new Float64Array(k), sq = new Float64Array(k);
  for (let i = 0; i < error.length; i++) {
    const b = index(i);
    if (b < 0 || b >= k) continue;
    counts[b]++;
    sum[b] += error[i];
    sq[b] += error[i] * error[i];
  }
  return {
    centers,
    counts,
    mean: sum.map((v, b) => (counts[b] ? v / counts[b] : NaN)),
    rms: sq.map((v, b) => (counts[b] ? Math.sqrt(v / counts[b]) : NaN)),
  };
}

/** rearrange_error_by_value: the residual binned by the value the converter was looking at. */
export function byValue(y: Float64Array, error: Float64Array, k = 96): Bins {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < y.length; i++) {
    lo = Math.min(lo, y[i]);
    hi = Math.max(hi, y[i]);
  }
  const scale = (k - 1) / (hi - lo);
  return bin((i) => Math.round((y[i] - lo) * scale), error, Float64Array.from({ length: k }, (_, b) => lo + b / scale));
}

export interface Phase extends Bins {
  /** rms of the part of the error that rides on the signal, on its slope, and on neither */
  am: number;
  pm: number;
  base: number;
}

/**
 * rearrange_error_by_phase, with ADCToolbox's AM / PM split. An error proportional to the signal has power ∝ cos²φ and
 * one proportional to its slope ∝ sin²φ, so fitting e² to a constant plus cos 2φ separates them from plain noise.
 */
export function byPhase(error: Float64Array, bin_: number, phase: number, k = 96): Phase {
  const w = (2 * Math.PI * bin_) / N_FFT;
  const phi = (i: number) => {
    const p = (w * i + phase) % (2 * Math.PI);
    return p < 0 ? p + 2 * Math.PI : p;
  };
  const centers = Float64Array.from({ length: k }, (_, b) => ((b + 0.5) * 2 * Math.PI) / k);
  const out = bin((i) => Math.floor((phi(i) / (2 * Math.PI)) * k), error, centers);
  let cc = 0, c1 = 0, ec = 0, e1 = 0;
  for (let i = 0; i < error.length; i++) {
    const c = Math.cos(2 * phi(i)), e = error[i] * error[i];
    cc += c * c;
    c1 += c;
    ec += e * c;
    e1 += e;
  }
  const nn = error.length;
  const A = (nn * ec - c1 * e1) / (nn * cc - c1 * c1), B = (e1 - A * c1) / nn;
  const amVar = Math.max(0, 2 * A), pmVar = Math.max(0, -2 * A);
  return { ...out, am: Math.sqrt(amVar), pm: Math.sqrt(pmVar), base: Math.sqrt(Math.max(0, B - (amVar + pmVar) / 2)) };
}

/** analyze_error_pdf: how often the residual takes each value, over a symmetric range of `span` LSB. */
export function pdf(error: Float64Array, span: number, k = 81): Bins {
  const centers = Float64Array.from({ length: k }, (_, b) => -span + (2 * span * (b + 0.5)) / k);
  const counts = new Float64Array(k);
  for (let i = 0; i < error.length; i++) {
    const b = Math.floor(((error[i] + span) / (2 * span)) * k);
    if (b >= 0 && b < k) counts[b]++;
  }
  return { centers, counts, mean: counts, rms: counts };
}

/** analyze_error_spectrum: the same spectrum tool, run on the residual instead of the output. */
export const errorSpectrum = (error: Float64Array, n: number): Spectrum => analyzeSpectrum(error, n);
export const outputSpectrum = (y: Float64Array, n: number): Spectrum => analyzeSpectrum(y, n);
