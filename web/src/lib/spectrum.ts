/**
 * ADCToolbox 0.9.1 analyze_spectrum (spectrum/compute_spectrum): rectangular window, side_bin = 0, harmonics 2 … 5.
 * Shared by the converter pages; python/sar_binary_vs_redundant.py checks the port against ADCToolbox itself.
 */
import { fft } from './fft';

function sum(a: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  return s;
}

export const N_FFT = 4096;

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
