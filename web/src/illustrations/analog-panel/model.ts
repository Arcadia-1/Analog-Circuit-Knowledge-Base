/**
 * Browser port of ADCToolbox's generate_aout_dashboard_3x4 and the 15 cases in
 * examples/06_use_toolsets/exp_t02_aout_dashboard_batch.py.
 *
 * The dashboard works in ADC-code units after the selected voltage-domain
 * non-ideality is applied. One code unit is therefore one LSB everywhere.
 */
import { byPhase, byValue, errorSpectrum, fitSine, outputSpectrum, pdf, type Bins, type Fit, type Phase } from '../errors/model';
import { fft } from '../../lib/fft';
import { gaussians, uniforms } from '../../lib/rng';
import { N_FFT, type Spectrum } from '../../lib/spectrum';

export const FS = 800e6;
export const FIN_BIN = 497;
export const FIN = (FIN_BIN / N_FFT) * FS;
const A = 0.49;
const DC = 0.5;

export type CaseId =
  | 'thermal' | 'quantization' | 'jitter' | 'am-noise' | 'hd2' | 'hd3'
  | 'memory' | 'settling' | 'ra-gain' | 'ra-dynamic' | 'am-tone'
  | 'clipping' | 'drift' | 'reference' | 'glitch';

export interface PanelCase { id: CaseId; label: string; fingerprint: string }

export const CASES: PanelCase[] = [
  { id: 'thermal', label: 'Thermal noise', fingerprint: 'a Gaussian floor with no preferred phase' },
  { id: 'quantization', label: 'Quantization noise', fingerprint: 'a bounded error distribution and code structure' },
  { id: 'jitter', label: 'Jitter noise', fingerprint: 'phase-dependent error that grows on the input slope' },
  { id: 'am-noise', label: 'AM noise', fingerprint: 'amplitude-dependent random error' },
  { id: 'hd2', label: 'Static HD2', fingerprint: 'a curved transfer and a second-harmonic line' },
  { id: 'hd3', label: 'Static HD3', fingerprint: 'a symmetric transfer error and a third-harmonic line' },
  { id: 'memory', label: 'Memory effect', fingerprint: 'history-dependent bands and spectral spurs' },
  { id: 'settling', label: 'Incomplete settling', fingerprint: 'dynamic error tied to the preceding sample' },
  { id: 'ra-gain', label: 'Residue gain error', fingerprint: 'stage-boundary discontinuities and harmonics' },
  { id: 'ra-dynamic', label: 'Dynamic residue gain', fingerprint: 'signal-dependent gain with memory' },
  { id: 'am-tone', label: 'AM tone', fingerprint: 'paired sidebands and an envelope tone' },
  { id: 'clipping', label: 'Clipping', fingerprint: 'flat peaks, heavy PDF tails, and many harmonics' },
  { id: 'drift', label: 'Drift', fingerprint: 'low-frequency residual energy and long correlation' },
  { id: 'reference', label: 'Reference error', fingerprint: 'amplitude-dependent droop with memory' },
  { id: 'glitch', label: 'Glitch', fingerprint: 'rare outliers, broad spectral energy, and phase-plane escapes' },
];

const percentile = (values: Float64Array, p: number) => {
  const sorted = Array.from(values).sort((a, b) => a - b);
  const at = Math.max(0, Math.min(sorted.length - 1, (p / 100) * (sorted.length - 1)));
  const lo = Math.floor(at), hi = Math.ceil(at), f = at - lo;
  return sorted[lo] * (1 - f) + sorted[hi] * f;
};

/** The same standard cases as nonideality_cases.py, with severity=1 at the example's nominal value. */
export function capture(kind: CaseId, severity: number, bits: number, seed = 20260920): Float64Array {
  const s = Math.max(0, severity), n = N_FFT;
  const z0 = gaussians(n, seed), z1 = gaussians(n, seed + 1), u0 = uniforms(n, seed + 2);
  const clean = Float64Array.from({ length: n }, (_, i) => A * Math.sin((2 * Math.PI * FIN_BIN * i) / n) + DC);
  const y = new Float64Array(clean);
  const baseline = kind === 'thermal' ? 0 : 10e-6 * s;

  if (kind === 'thermal') {
    for (let i = 0; i < n; i++) y[i] += z0[i] * 180e-6 * s;
  } else if (kind === 'quantization') {
    const qbits = Math.max(4, Math.min(16, Math.round(16 - 6 * s)));
    const levels = 2 ** qbits;
    for (let i = 0; i < n; i++) y[i] = Math.min(levels - 1, Math.max(0, Math.floor(y[i] * levels))) / levels;
  } else if (kind === 'jitter') {
    for (let i = 0; i < n; i++) {
      const t = i + z0[i] * 2e-12 * s * FS;
      y[i] = A * Math.sin((2 * Math.PI * FIN_BIN * t) / n) + DC;
    }
  } else if (kind === 'am-noise') {
    for (let i = 0; i < n; i++) y[i] = (clean[i] - DC) * (1 + 0.0005 * s * z0[i]) + DC;
  } else if (kind === 'hd2' || kind === 'hd3') {
    const k2 = kind === 'hd2' ? ((2 * 10 ** (-80 / 20)) / A) * s : 0;
    const k3 = kind === 'hd3' ? ((4 * 10 ** (-70 / 20)) / A ** 2) * s : 0;
    for (let i = 0; i < n; i++) {
      const x = clean[i] - DC;
      y[i] = DC + x + k2 * x ** 2 + k3 * x ** 3;
    }
  } else if (kind === 'memory') {
    let previous = Math.floor(clean[n - 1] * 16) / 16;
    for (let i = 0; i < n; i++) {
      const msb = Math.floor(clean[i] * 16) / 16;
      const lsb = Math.floor((clean[i] - msb) * 4096) / 4096;
      y[i] = msb + lsb + 0.009 * s * previous;
      previous = msb;
    }
  } else if (kind === 'settling') {
    let previous = 0;
    const track = 0.2 / FS;
    for (let i = 0; i < n; i++) {
      const target = clean[i] - DC;
      const tau = 40e-12 * (1 + 0.09 * s * target ** 2);
      const out = target + (previous - target) * Math.exp(-track / tau);
      y[i] = DC + out;
      previous = out;
    }
  } else if (kind === 'ra-gain') {
    for (let i = 0; i < n; i++) {
      const x = clean[i] - DC, msb = Math.floor(x * 16) / 16, lsb = Math.floor((x - msb) * 256) / 256;
      y[i] = DC + msb * (1 - 0.01 * s) + lsb;
    }
  } else if (kind === 'ra-dynamic') {
    let previous = 0;
    for (let i = 0; i < n; i++) {
      const x = clean[i] - DC, msb = Math.floor(x * 16) / 16, lsb = Math.floor((x - msb) * 256) / 256;
      const out = msb * (1 + 0.15 * s * previous ** 2) + lsb;
      y[i] = DC + out;
      previous = out;
    }
  } else if (kind === 'am-tone') {
    const fm = 500e3 / FS;
    for (let i = 0; i < n; i++) y[i] = (clean[i] - DC) * (1 + 0.05 * s * Math.sin(2 * Math.PI * fm * i)) + DC;
  } else if (kind === 'clipping') {
    const p = Math.min(20, s);
    const lo = percentile(clean, p), hi = percentile(clean, 100 - p);
    for (let i = 0; i < n; i++) y[i] = Math.min(hi, Math.max(lo, clean[i]));
  } else if (kind === 'drift') {
    let walk = 0, smooth = 0;
    for (let i = 0; i < n; i++) {
      walk += z0[i] * 5e-5 * s;
      smooth += 0.006 * (walk - smooth);
      y[i] += smooth;
    }
  } else if (kind === 'reference') {
    let droop = 0;
    const decay = Math.exp(-10);
    for (let i = 0; i < n; i++) {
      const ac = clean[i] - DC;
      droop = 0.002 * s * Math.abs(ac) + decay * droop;
      y[i] = DC + ac * (1 - droop);
    }
  } else if (kind === 'glitch') {
    for (let i = 0; i < n; i++) if (u0[i] < 0.002 * s) y[i] += 0.1;
  }

  if (baseline) for (let i = 0; i < n; i++) y[i] += z1[i] * baseline;
  const codes = 2 ** bits;
  return y.map((v) => v * codes);
}

export interface Decomposition {
  fundamental: Float64Array;
  harmonic: Float64Array;
  residual: Float64Array;
  magnitudesDb: Float64Array;
  phases: Float64Array;
  residualRms: number;
}

/** Coherent five-harmonic least-squares decomposition used by both decomposition panels. */
export function decompose(y: Float64Array, harmonics = 5): Decomposition {
  const n = y.length, dc = y.reduce((a, v) => a + v, 0) / n;
  const components = Array.from({ length: harmonics }, () => new Float64Array(n));
  const magnitudes = new Float64Array(harmonics), phases = new Float64Array(harmonics);
  for (let h = 1; h <= harmonics; h++) {
    let a = 0, b = 0;
    for (let i = 0; i < n; i++) {
      const w = (2 * Math.PI * h * FIN_BIN * i) / n;
      a += (y[i] - dc) * Math.cos(w);
      b += (y[i] - dc) * Math.sin(w);
    }
    a *= 2 / n; b *= 2 / n;
    magnitudes[h - 1] = Math.hypot(a, b);
    phases[h - 1] = Math.atan2(b, a);
    for (let i = 0; i < n; i++) components[h - 1][i] = a * Math.cos((2 * Math.PI * h * FIN_BIN * i) / n) + b * Math.sin((2 * Math.PI * h * FIN_BIN * i) / n);
  }
  const fundamental = components[0].map((v) => v + dc);
  const harmonic = new Float64Array(n), residual = new Float64Array(n);
  let sq = 0;
  for (let i = 0; i < n; i++) {
    for (let h = 1; h < harmonics; h++) harmonic[i] += components[h][i];
    residual[i] = y[i] - fundamental[i] - harmonic[i];
    sq += residual[i] ** 2;
  }
  const relative = magnitudes[0] || 1;
  const phase0 = phases[0];
  for (let h = 0; h < harmonics; h++) {
    const relativePhase = phases[h] - (h + 1) * phase0;
    phases[h] = ((relativePhase + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    magnitudes[h] = 20 * Math.log10(magnitudes[h] / relative + 1e-20);
  }
  return { fundamental, harmonic, residual, magnitudesDb: magnitudes, phases, residualRms: Math.sqrt(sq / n) };
}

export interface PolarData {
  points: { angle: number; db: number }[];
  rays: { angle: number; db: number; text: string; series: 1 | 2 }[];
  floor: number;
}

export function spectrumPolar(y: Float64Array, out: Spectrum): PolarData {
  const n = y.length, mean = y.reduce((a, v) => a + v, 0) / n, peak = (Math.max(...y) - Math.min(...y)) / 2 || 1;
  const re = y.map((v) => (v - mean) / peak), im = new Float64Array(n);
  fft(re, im);
  const points: PolarData['points'] = [];
  const stride = Math.max(1, Math.floor((n / 2) / 420));
  for (let k = 1; k <= n / 2; k += stride) points.push({ angle: Math.atan2(im[k], re[k]), db: out.dbfs[k] });
  const bins = [out.signal, ...out.harmonics.slice(0, 4)], phase0 = Math.atan2(im[out.signal], re[out.signal]);
  const wrap = (angle: number) => ((angle + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  const rays = bins.map((bin, i) => ({ angle: wrap(Math.atan2(im[bin], re[bin]) - (i + 1) * phase0), db: out.dbfs[bin], text: i ? `H${i + 1}` : 'input', series: (i ? 2 : 1) as 1 | 2 }));
  return { points, rays, floor: Math.max(-120, Math.min(-40, Math.round(Math.min(...Array.from(out.dbfs).filter(Number.isFinite)) / 10) * 10)) };
}

export function decompositionPolar(d: Decomposition): PolarData {
  return {
    points: [],
    rays: Array.from(d.magnitudesDb, (db, i) => ({ angle: d.phases[i], db, text: `H${i + 1}`, series: (i ? 2 : 1) as 1 | 2 })),
    floor: -120,
  };
}

export interface XY { x: Float64Array; y: Float64Array }

export function autocorrelation(error: Float64Array, maxLag = 48): XY {
  const mean = error.reduce((a, v) => a + v, 0) / error.length;
  let denom = 0;
  for (const v of error) denom += (v - mean) ** 2;
  const x = Float64Array.from({ length: 2 * maxLag + 1 }, (_, i) => i - maxLag);
  const y = x.map((lag) => {
    let sum = 0;
    const a = Math.max(0, -lag), b = Math.min(error.length, error.length - lag);
    for (let i = a; i < b; i++) sum += (error[i] - mean) * (error[i + lag] - mean);
    return sum / (denom || 1);
  });
  return { x, y };
}

export function envelope(error: Float64Array): Float64Array {
  const n = error.length, re = new Float64Array(error), im = new Float64Array(n);
  fft(re, im);
  for (let k = 1; k < n / 2; k++) { re[k] *= 2; im[k] *= 2; }
  for (let k = n / 2 + 1; k < n; k++) { re[k] = 0; im[k] = 0; }
  for (let k = 0; k < n; k++) im[k] = -im[k];
  fft(re, im);
  return Float64Array.from({ length: n }, (_, k) => Math.hypot(re[k] / n, -im[k] / n));
}

export function phasePlane(values: Float64Array, lag: number | 'auto' = 'auto', maxPoints = 600): XY & { lag: number } {
  let k = lag === 'auto' ? 1 : lag;
  if (lag === 'auto') {
    const f = FIN_BIN / values.length, limit = Math.min(values.length / 2, Math.floor((1 / f) * 0.6) + 20);
    let score = -Infinity;
    for (let candidate = 1; candidate < limit; candidate++) {
      const at = Math.abs(Math.sin(2 * Math.PI * f * candidate)) - candidate * 0.0001;
      if (at > score) { score = at; k = candidate; }
    }
  }
  const count = Math.min(maxPoints, values.length - k), step = (values.length - k) / count;
  const x = new Float64Array(count), y = new Float64Array(count);
  for (let j = 0; j < count; j++) {
    const i = Math.floor(j * step);
    x[j] = values[i]; y[j] = values[i + k];
  }
  return { x, y, lag: k };
}

export function errorPhasePlane(fit: Fit, bits: number, maxPoints = 700): XY {
  const count = Math.min(maxPoints, fit.error.length), step = fit.error.length / count, scale = 2 ** bits;
  const x = new Float64Array(count), y = new Float64Array(count);
  for (let j = 0; j < count; j++) {
    const i = Math.floor(j * step);
    x[j] = fit.fitted[i] / scale;
    y[j] = fit.error[i];
  }
  return { x, y };
}

export interface Dashboard {
  y: Float64Array;
  fit: Fit;
  value: Bins;
  phase: Phase;
  distribution: Bins;
  output: Spectrum;
  error: Spectrum;
  envelopeSpectrum: Spectrum;
  decomposition: Decomposition;
  outputPolar: PolarData;
  decompositionPolar: PolarData;
  autocorr: XY;
  phasePlane: XY & { lag: number };
  errorPhasePlane: XY;
}

export function analyze(kind: CaseId, severity: number, bits: number): Dashboard {
  const y = capture(kind, severity, bits), fit = fitSine(y, FIN_BIN);
  const output = outputSpectrum(y, bits), decomposition = decompose(y);
  return {
    y,
    fit,
    value: byValue(y, fit.error),
    phase: byPhase(fit.error, FIN_BIN, fit.phase),
    distribution: pdf(fit.error, Math.max(0.75, 3.5 * fit.rmse)),
    output,
    error: errorSpectrum(fit.error, bits),
    envelopeSpectrum: outputSpectrum(envelope(fit.error), bits),
    decomposition,
    outputPolar: spectrumPolar(y, output),
    decompositionPolar: decompositionPolar(decomposition),
    autocorr: autocorrelation(fit.error),
    phasePlane: phasePlane(y),
    errorPhasePlane: errorPhasePlane(fit, bits),
  };
}
