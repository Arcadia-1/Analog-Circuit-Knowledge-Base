/**
 * Oversampling and noise shaping: sample faster than the band needs and only the band's share of the quantisation
 * noise counts; shape that noise and even less of it stays there.
 * Ported from ADCToolbox 0.9.1 (github.com/Arcadia-1/ADCToolbox):
 *   siggen/nonidealities   apply_noise_shaping, over apply_quantization_noise
 *   spectrum/              analyze_spectrum with an OSR, through src/lib/spectrum.ts
 *   oversampling/ntfperf   ntf_analyzer on MATLAB's million-point grid
 *   oversampling/perfosr   sweep_performance_vs_osr, with fundamentals/fit_sine_4param
 *   oversampling/ifilter   spectrum/extract_freq_components
 * following its examples exp_o01, exp_o02 and exp_o03.
 * python/adc_oversampling.py calls ADCToolbox on the same samples; tests/oversampling-model.test.ts compares the two.
 *
 * Volts on a ±0.5 V range, as exp_o01 has them: 8192 samples at 100 MHz.
 */
import { fftAny } from '../../lib/fft';
import { coherentFrequency, foldFrequency } from '../../lib/frequency';
import { analyzeSpectrum, inbandBins, type Spectrum } from '../../lib/spectrum';

export const N = 8192;
export const FS = 100e6;
export const AMP = 0.4;
export const ORDERS = [0, 1, 2, 3];
export const OSRS = [1, 2, 4, 8, 16, 32, 64, 128, 256];
/** exp_o03's tone, fs/640, low enough to stay in the band at every OSR offered */
export const TONE = coherentFrequency(FS, FS / 640, N);

/** (1 − z⁻¹)^order, the noise transfer function apply_noise_shaping uses unless it is given one. */
export function ntfTaps(order: number): number[] {
  let taps = [1];
  for (let i = 0; i < order; i++) taps = [...taps, 0].map((c, k) => c - (k ? taps[k - 1] : 0));
  return taps;
}

/**
 * exp_o01's converter: a sine through a bits-bit quantiser that floors and clips, as apply_quantization_noise does.
 * For order > 0 this is apply_noise_shaping: the quantisation error, filtered by the NTF from rest, added back to the
 * sine. The filter sums from its oldest tap, as scipy's lfilter does.
 */
export function capture(order: number, bits: number): Float64Array {
  const lsb = 1 / 2 ** bits, top = 2 ** bits - 1;
  const sine = Float64Array.from({ length: N }, (_, i) => AMP * Math.sin(2 * Math.PI * TONE.fin * (i / FS)) + 0);
  const quantised = sine.map((s) => Math.min(top, Math.max(0, Math.floor((s - -0.5) / lsb))) * lsb + -0.5);
  if (!order) return quantised;
  const error = quantised.map((q, i) => q - sine[i]);
  const taps = ntfTaps(order);
  return sine.map((s, i) => {
    let shaped = 0;
    for (let k = taps.length - 1; k >= 0; k--) if (i >= k) shaped += error[i - k] * taps[k];
    return s + shaped;
  });
}

/** analyze_spectrum on the ±0.5 V range: codes of the same resolution scale it to the full scale the port expects. */
export const spectrumOf = (data: Float64Array, bits: number, osr: number): Spectrum =>
  analyzeSpectrum(data.map((v) => v * 2 ** bits), bits, 'rectangular', 0, osr);

const GRID = 1_000_000;
const ntfPower = new Map<string, number>();

/**
 * ntfperf: how far the in-band noise of (1 − z⁻¹)^order sits below a flat NTF over the whole band, dB, integrated on
 * MATLAB's grid of a million frequencies in (0, fs/2]. |NTF|² there is (2 sin πf)^(2·order).
 */
export function ntfperf(order: number, osr: number): number {
  const key = `${order}/${osr}`;
  let power = ntfPower.get(key);
  if (power === undefined) {
    power = 0;
    for (let k = 1; k <= GRID; k++) {
      const w = k / GRID / 2;
      if (!(w < 0.5 / osr)) break;
      const s = 2 * Math.sin(Math.PI * w);
      power += (s * s) ** order;
    }
    power /= GRID;
    ntfPower.set(key, power);
  }
  return -10 * Math.log10(power);
}

/** The SNR of white quantisation noise over the whole band, which ntfperf's gain is measured from. */
export const whiteSnr = (bits: number): number => 10 * Math.log10(AMP ** 2 / 2 / ((1 / 2 ** bits) ** 2 / 12));

/**
 * What analyze_spectrum reads in one bin, dBFS, for white quantisation noise of lsb²/12 through the NTF: on the ±0.5 V
 * range a variance σ² lands 16σ²/N in each bin, and |NTF|² is (2 sin(π·bin/N))^(2·order).
 */
export const floorModel = (bits: number, order: number) => (bin: number): number =>
  10 * Math.log10((16 * (1 / 2 ** bits) ** 2) / 12 / N) + 10 * order * Math.log10((2 * Math.sin((Math.PI * bin) / N)) ** 2);

/** Least squares by Householder QR, which keeps the design matrix's conditioning instead of squaring it. */
function leastSquares(columns: Float64Array[], y: Float64Array): number[] {
  const m = y.length, p = columns.length;
  const a = columns.map((c) => c.slice()), b = y.slice(), v = new Float64Array(m);
  for (let j = 0; j < p; j++) {
    let norm = 0;
    for (let i = j; i < m; i++) norm += a[j][i] ** 2;
    const alpha = a[j][j] > 0 ? -Math.sqrt(norm) : Math.sqrt(norm);
    let vv = 0;
    for (let i = j; i < m; i++) {
      v[i] = a[j][i] - (i === j ? alpha : 0);
      vv += v[i] ** 2;
    }
    if (!vv) continue;
    for (const col of [...a.slice(j), b]) {
      let dot = 0;
      for (let i = j; i < m; i++) dot += v[i] * col[i];
      const f = (2 * dot) / vv;
      for (let i = j; i < m; i++) col[i] -= f * v[i];
    }
  }
  const x = new Array<number>(p).fill(0);
  for (let j = p - 1; j >= 0; j--) {
    let s = b[j];
    for (let c = j + 1; c < p; c++) s -= a[c][j] * x[c];
    x[j] = s / a[j][j];
  }
  return x;
}

/** _estimate_frequency_fft: the largest bin below Nyquist, moved toward its larger neighbour by their magnitudes. */
function estimateFrequency(y: Float64Array): number {
  const n = y.length, half = Math.floor(n / 2), re = y.slice(), im = new Float64Array(n);
  fftAny(re, im);
  const mag = (k: number) => (k ? Math.hypot(re[k], im[k]) : 0);
  let k = 0;
  for (let i = 1; i < half; i++) if (mag(i) > mag(k)) k = i;
  let at = k;
  if (k > 0 && k < half - 1) {
    const r = mag(k + 1) > mag(k - 1) ? 1 : -1;
    at += (r * mag(k + r)) / (mag(k) + mag(k + r));
  }
  return at / n;
}

export interface SineFit {
  fitted: Float64Array;
  /** cycles per sample */
  frequency: number;
  amplitude: number;
}

/** fit_sine_4param with no frequency given and one iteration: a three-parameter fit, then one four-parameter step. */
export function fitSine(y: Float64Array): SineFit {
  const n = y.length, t = Float64Array.from({ length: n }, (_, i) => i);
  let freq = estimateFrequency(y), a = 0, b = 0, c = 0;
  for (let i = 0; i <= 1; i++) {
    const omega = 2 * Math.PI * freq;
    const cos = t.map((k) => Math.cos(omega * k)), sin = t.map((k) => Math.sin(omega * k));
    const columns = [cos, sin, new Float64Array(n).fill(1)];
    if (i) columns.push(t.map((k, j) => k * (-a * sin[j] + b * cos[j])));
    const x = leastSquares(columns, y);
    [a, b, c] = x;
    if (i) {
      const delta = x[3] / (2 * Math.PI);
      freq = Math.min(0.5 - 1e-10, Math.max(1e-10, freq + delta));
      if (Math.abs(delta) < 1e-9) break;
    }
  }
  const omega = 2 * Math.PI * freq;
  return {
    fitted: t.map((k) => a * Math.cos(omega * k) + b * Math.sin(omega * k) + c),
    frequency: freq,
    amplitude: Math.sqrt(a ** 2 + b ** 2),
  };
}

/**
 * perfosr (sweep_performance_vs_osr): fit the sine, take the one-sided spectrum of the Hann-windowed residual, and at
 * each OSR divide the fitted sine's power by the residual's power up to fs / (2·OSR). SNDR in dB, one per OSR given.
 */
export function perfosr(data: Float64Array, osrs: number[]): number[] {
  const n = data.length, half = Math.floor(n / 2), fit = fitSine(data);
  const hann = Float64Array.from({ length: n }, (_, i) => 0.5 * (1 - Math.cos((2 * Math.PI * i) / n)));
  let ww = 0;
  for (const h of hann) ww += h ** 2;
  const scale = Math.sqrt(ww / n);
  const re = data.map((v, i) => ((v - fit.fitted[i]) * hann[i]) / scale), im = new Float64Array(n);
  fftAny(re, im);
  const spec = Float64Array.from({ length: half + 1 }, (_, k) => ((re[k] ** 2 + im[k] ** 2) / n ** 2) * (k > 0 && k < half ? 2 : 1));
  const signal = fit.amplitude ** 2 / 2;
  const sndr = new Array<number>(osrs.length);
  let counted = 0, noise = 0;
  // narrowest band first, so each wider one only adds the bins it has beyond the last
  for (const i of osrs.map((_, i) => i).sort((p, q) => osrs[q] - osrs[p])) {
    const bins = inbandBins(n, osrs[i]);
    if (bins > counted) {
      let slice = 0;
      for (let k = counted; k < bins; k++) slice += spec[k];
      noise += slice;
    }
    counted = bins;
    sndr[i] = 10 * Math.log10(signal / noise);
  }
  return sndr;
}

/** ifilter (extract_freq_components) for one band, lo … hi of fs: keep those bins and their mirrors, drop the rest. */
export function ifilter(x: Float64Array, lo: number, hi: number): Float64Array {
  const n = x.length, re = x.slice(), im = new Float64Array(n), keep = new Uint8Array(n);
  fftAny(re, im);
  for (let k = Math.round(lo * n); k <= Math.round(hi * n); k++) {
    const id = Math.round(foldFrequency(k, n));
    keep[id] = 1;
    if (id > 0 && id < Math.floor(n / 2)) keep[n - id] = 1;
  }
  for (let k = 0; k < n; k++) if (!keep[k]) re[k] = im[k] = 0;
  // the forward transform read backwards is the inverse one, less its 1/n
  fftAny(re, im);
  return Float64Array.from({ length: n }, (_, k) => re[(n - k) % n] / n);
}

export const rms = (x: Float64Array): number => {
  let mean = 0, power = 0;
  for (const v of x) mean += v / x.length;
  for (const v of x) power += (v - mean) ** 2 / x.length;
  return Math.sqrt(power);
};

export interface Reading {
  data: Float64Array;
  /** analyze_spectrum over the band, and over everything to fs/2 */
  band: Spectrum;
  full: Spectrum;
  /** perfosr's SNDR at each of OSRS, and what ntfperf predicts there */
  sweep: number[];
  theory: number[];
  /** ifilter's band, 0 … fs / (2·OSR) */
  inband: Float64Array;
}

export function read(order: number, bits: number, osr: number): Reading {
  const data = capture(order, bits);
  return {
    data,
    band: spectrumOf(data, bits, osr),
    full: spectrumOf(data, bits, 1),
    sweep: perfosr(data, OSRS),
    theory: OSRS.map((o) => whiteSnr(bits) + ntfperf(order, o)),
    inband: ifilter(data, 0, 0.5 / osr),
  };
}
