/**
 * Binary vs redundant SAR ADC behavioural model (mirrors python/sar_binary_vs_redundant.py).
 *
 * Units are LSBs; the input x lies in [0, 2^N). Comparison k = 0..M-1 tests threshold t_k:
 *   t_0 = 2^(N-1),  t_{k+1} = t_k + (2 b_k − 1) s_k,  code = clip(t_{M-1} + b_{M-1} − 1, 0, 2^N − 1).
 * Binary: M = N, s_k = 2^(N−2−k). Redundant: M = N + ceil(N/6), geometric integer moves (radix ≈ 1.7) that still
 * sum to 2^(N−1) − 1; a decision error of up to R_k = 1 + Σ_{j>k} s_j − s_k LSB at comparison k is corrected later.
 * Impairments seen by the comparator: capacitor mismatch (each move realised as s_k (1 + d_k)), incomplete DAC
 * settling (the comparator sees a_k − ε (a_k − a_{k−1})) and Gaussian comparator noise.
 */
import { fft } from '../../lib/fft';
import { gaussians } from '../../lib/rng';
import { clamp } from '../../lib/scale';

export interface Impairments { settling: number; noiseLsb: number; mismatch: number }

export function binaryMoves(n: number): number[] {
  return Array.from({ length: n - 1 }, (_, k) => 2 ** (n - 2 - k));
}

/** Geometric integer moves (MSB first) for M = N + ceil(N/6) comparisons, summing to 2^(N−1) − 1. */
export function redundantMoves(n: number): { moves: number[]; radix: number } {
  const k = n - 1 + Math.ceil(n / 6);
  const target = 2 ** (n - 1) - 1;
  let lo = 1 + 1e-9, hi = 2;
  for (let i = 0; i < 200; i++) {
    const r = (lo + hi) / 2;
    if ((r ** k - 1) / (r - 1) < target) lo = r;
    else hi = r;
  }
  const r = (lo + hi) / 2;
  const moves = Array.from({ length: k }, (_, j) => Math.round(r ** j));
  let diff = target - moves.reduce((a, b) => a + b, 0);
  let j = k - 1;
  while (diff) {
    const step = diff > 0 ? 1 : -1;
    moves[j] += step;
    diff -= step;
    j = j > k >> 1 ? j - 1 : k - 1;
  }
  return { moves: moves.reverse(), radix: r };
}

/** Recoverable decision error (LSB) at each comparison: R_k = 1 + Σ_{j>k} s_j − s_k (last comparison: 0). */
export function redundancy(moves: number[]): number[] {
  const out: number[] = [];
  for (let k = 0; k < moves.length; k++) out.push(1 + moves.slice(k + 1).reduce((a, b) => a + b, 0) - moves[k]);
  return [...out, 0];
}

/** Per-move relative capacitor error for a unit-capacitor sigma, fixed per "chip" (seeded). */
export function mismatchFor(moves: number[], sigmaUnit: number, seed: number): Float64Array {
  const z = gaussians(moves.length, seed);
  return Float64Array.from(moves, (s, i) => (z[i] * sigmaUnit) / Math.sqrt(2 * s));
}

export interface Step {
  /** digital (nominal) threshold, LSB */
  t: number;
  /** threshold actually seen by the comparator, LSB */
  seen: number;
  /** comparator decision */
  b: 0 | 1;
  /** decision of an ideal comparator against the nominal threshold */
  ideal: 0 | 1;
  /** codes still reachable from this comparison on, [lo, hi] */
  lo: number;
  hi: number;
}

/** One conversion of input x (LSB); returns the code. `noise[k]` are standard normals; pass `trace` to record each comparison. */
export function convert(x: number, n: number, moves: number[], imp: Impairments, dev: Float64Array | null, noise: Float64Array | null, trace?: Step[]): number {
  const m = moves.length + 1;
  const full = 2 ** n - 1;
  let t = 2 ** (n - 1), a = t, aPrev = a, b: 0 | 1 = 0;
  let remaining = moves.reduce((p, q) => p + q, 0);
  for (let k = 0; k < m; k++) {
    const seen = a - imp.settling * (a - aPrev);
    const nz = noise && imp.noiseLsb ? noise[k] * imp.noiseLsb : 0;
    b = x + nz >= seen ? 1 : 0;
    trace?.push({ t, seen, b, ideal: x >= t ? 1 : 0, lo: Math.max(0, t - remaining - 1), hi: Math.min(full, t + remaining) });
    if (k === m - 1) break;
    const s = moves[k];
    remaining -= s;
    aPrev = a;
    a += (2 * b - 1) * s * (1 + (dev ? dev[k] : 0));
    t += (2 * b - 1) * s;
  }
  return clamp(t + b - 1, 0, full);
}

export const N_FFT = 4096;
export const CYCLES = 409;
export const AMP_DBFS = -0.5;

export interface SineTest { sndr: number; enob: number; sfdr: number; maxErr: number; dbfs: Float64Array }

/** Coherent sine test: N_FFT conversions, rectangular-window FFT, SNDR / ENOB / SFDR and the dBFS spectrum. */
export function sineTest(n: number, moves: number[], imp: Impairments, dev: Float64Array | null, noiseSeed = 5): SineTest {
  const m = moves.length + 1;
  const half = 2 ** (n - 1), amp = half * 10 ** (AMP_DBFS / 20);
  const re = new Float64Array(N_FFT), im = new Float64Array(N_FFT);
  const g = imp.noiseLsb ? gaussians(N_FFT * m, noiseSeed) : null;
  let maxErr = 0;
  for (let i = 0; i < N_FFT; i++) {
    const x = half + amp * Math.sin((2 * Math.PI * CYCLES * i) / N_FFT);
    const code = convert(x, n, moves, imp, dev, g ? g.subarray(i * m, (i + 1) * m) : null);
    maxErr = Math.max(maxErr, Math.abs(code - clamp(Math.floor(x), 0, 2 ** n - 1)));
    re[i] = code + 0.5 - half;
  }
  fft(re, im);
  const bins = N_FFT / 2 + 1, P = new Float64Array(bins), dbfs = new Float64Array(bins);
  let total = 0, spur = 0;
  for (let k = 0; k < bins; k++) {
    const v = (re[k] ** 2 + im[k] ** 2) / (N_FFT / 2) ** 2;
    P[k] = k === 0 ? 0 : v;
    total += P[k];
    dbfs[k] = 10 * Math.log10(P[k] / half ** 2 + 1e-30);
  }
  const sig = P[CYCLES];
  for (let k = 1; k < bins; k++) if (k !== CYCLES) spur = Math.max(spur, P[k]);
  const sndr = 10 * Math.log10(sig / (total - sig));
  return { sndr, enob: (sndr - 1.76) / 6.02, sfdr: 10 * Math.log10(sig / spur), maxErr, dbfs };
}
