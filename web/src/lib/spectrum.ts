/**
 * ADCToolbox 0.9.1 analyze_spectrum (spectrum/compute_spectrum and spectrum/_window): the window, its power correction,
 * the side bins that count as signal, and the metrics built from them. Harmonics 2 … 5.
 * Shared by the converter pages; python/sar_binary_vs_redundant.py checks the port against ADCToolbox itself.
 */
import { fftAny } from './fft';

function sum(a: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  return s;
}

export const N_FFT = 4096;

/** The windows of ADCToolbox's _create_window that are worth choosing between, periodic (scipy's sym=False). */
export type Window = 'rectangular' | 'hann' | 'blackmanharris' | 'flattop';

const COSINES: Record<Window, number[]> = {
  rectangular: [1],
  hann: [0.5, 0.5],
  blackmanharris: [0.35875, 0.48829, 0.14128, 0.01168],
  flattop: [0.21557895, 0.41663158, 0.277263158, 0.083578947, 0.006947368],
};

/** Side bins ADCToolbox counts as signal for a coherent tone, from _SIDE_BIN_DEFAULTS. */
export const SIDE_BINS: Record<Window, number> = { rectangular: 0, hann: 1, blackmanharris: 3, flattop: 4 };

export function windowOf(kind: Window, n: number): Float64Array {
  const a = COSINES[kind];
  return Float64Array.from({ length: n }, (_, i) => {
    let v = a[0];
    for (let k = 1; k < a.length; k++) v += (k % 2 ? -a[k] : a[k]) * Math.cos((2 * Math.PI * k * i) / n);
    return v;
  });
}

export interface Spectrum {
  /** dBFS per bin, 0 … N_FFT/2 */
  dbfs: Float64Array;
  signal: number;
  spur: number;
  /** bins of harmonics 2 … 5 after folding */
  harmonics: number[];
  /** bins 0 … inband − 1 make up the analysis band, fs / (2·OSR) wide */
  inband: number;
  sndr: number;
  enob: number;
  sfdr: number;
}

/** rfft_inband_bin_count: the bins from DC up to fs / (2·osr), the edge bin included when it falls on a whole bin. */
export function inbandBins(len: number, osr = 1): number {
  const edge = len / (2 * osr), whole = Math.round(edge);
  const at = Math.abs(edge - whole) <= 1e-12 + 1e-12 * Math.abs(whole) ? whole : edge;
  return Math.max(1, Math.min(Math.floor(at) + 1, Math.floor(len / 2) + 1));
}

/**
 * analyze_spectrum: remove DC, normalise to full scale 2^N, window, one-sided power corrected by 4 / mean(window²).
 * The signal is the fundamental bin and `sideBin` bins either side of it; everything else in band is noise, and the
 * largest bin outside that band is the spur. The band runs to fs / (2·osr), all of the spectrum when osr is 1.
 */
export function analyzeSpectrum(trace: Float64Array, n: number, kind: Window = 'rectangular', sideBin = 0, osr = 1): Spectrum {
  const len = trace.length, half = len / 2, mean = sum(trace) / len, peak = 2 ** (n - 1);
  const inband = inbandBins(len, osr), top = inband - 1;
  const w = windowOf(kind, len);
  let ww = 0;
  for (let i = 0; i < len; i++) ww += w[i] * w[i];
  const correction = 4 / (ww / len);
  const re = trace.map((v, i) => ((v - mean) / peak) * w[i]), im = new Float64Array(len);
  fftAny(re, im);
  const P = Float64Array.from({ length: half + 1 }, (_, k) => (correction * (re[k] ** 2 + im[k] ** 2)) / len ** 2);
  P[0] /= 2;
  P[half] /= 2;
  let peakBin = 1;
  for (let k = 2; k <= top; k++) if (P[k] > P[peakBin]) peakBin = k;
  const lo = Math.max(peakBin - sideBin, 0), hi = Math.min(peakBin + sideBin, top);
  let signalPower = 0;
  for (let k = lo; k <= hi; k++) signalPower += P[k];
  // everything the signal band and the DC leakage beside it do not claim; the rest is noise, and its peak is the spur
  const rest = Float64Array.from(P, (v, k) => ((k >= lo && k <= hi) || k < sideBin ? 0 : v));
  let spur = 0, noise = 0;
  for (let k = 0; k <= top; k++) {
    noise += rest[k];
    if (rest[k] > rest[spur]) spur = k;
  }
  // a windowed spur is spread over the same side bins as the signal, so it is measured over the same span
  let spurPower = 0;
  for (let k = Math.max(spur - sideBin, 0); k <= Math.min(spur + sideBin, top); k++) spurPower += rest[k];
  const fold = (b: number) => (b % len > half ? len - (b % len) : b % len);
  const sndr = 10 * Math.log10(signalPower / (noise + 1e-20));
  return {
    dbfs: P.map((p) => 10 * Math.log10(p + 1e-20)),
    signal: peakBin,
    spur,
    harmonics: [2, 3, 4, 5].map((h) => fold(h * peakBin)),
    inband,
    sndr,
    enob: (sndr - 1.76) / 6.02,
    sfdr: 10 * Math.log10(signalPower / spurPower),
  };
}
