/**
 * Browser adaptation of ADCToolbox's generate_aout_dashboard_3x4 and the 15 cases in
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

/** A value at or below this threshold disables a harmonic rather than creating a tiny hidden tone. */
export const HD_OFF = -120;

/**
 * Independent controls for the fifteen non-idealities in nonideality_cases.py.
 * Every field is expressed in the unit shown in the UI; there is no shared severity scale.
 */
export interface Impairments {
  thermalNoiseUv: number;
  quantizerBits: number;
  jitterPs: number;
  amNoisePpm: number;
  hd2Dbc: number;
  hd3Dbc: number;
  memoryPct: number;
  settlingTauPs: number;
  residueGainPct: number;
  dynamicResiduePctPerV2: number;
  amToneDepthPct: number;
  clipLevelMv: number;
  driftStepUv: number;
  referenceDroopPctPerV: number;
  glitchRatePpm: number;
  glitchAmplitudeMv: number;
}

export const CLEAN_IMPAIRMENTS: Impairments = {
  thermalNoiseUv: 0,
  quantizerBits: 0,
  jitterPs: 0,
  amNoisePpm: 0,
  hd2Dbc: HD_OFF,
  hd3Dbc: HD_OFF,
  memoryPct: 0,
  settlingTauPs: 0,
  residueGainPct: 0,
  dynamicResiduePctPerV2: 0,
  amToneDepthPct: 0,
  clipLevelMv: 500,
  driftStepUv: 0,
  referenceDroopPctPerV: 0,
  glitchRatePpm: 0,
  glitchAmplitudeMv: 0,
};

/** A deliberately mixed starting point: each value remains independently editable or removable. */
export const DEFAULT_IMPAIRMENTS: Impairments = {
  ...CLEAN_IMPAIRMENTS,
  thermalNoiseUv: 50,
  quantizerBits: 12,
  jitterPs: 0.5,
  amNoisePpm: 100,
  hd2Dbc: -85,
  hd3Dbc: -75,
  memoryPct: 0.1,
  settlingTauPs: 40,
  residueGainPct: -0.15,
  dynamicResiduePctPerV2: 2,
  amToneDepthPct: 0.5,
  driftStepUv: 2,
  referenceDroopPctPerV: 0.02,
  glitchRatePpm: 250,
  glitchAmplitudeMv: 20,
};

/**
 * Compose all enabled non-idealities into one record. The order follows a signal path: sample-time error, continuous
 * transfer errors, memory/stage errors, clipping/reference events, additive noise, and finally quantization.
 */
export function capture(settings: Impairments, bits: number, seed = 20260920): Float64Array {
  const n = N_FFT;
  const jitterNoise = gaussians(n, seed);
  const amNoise = gaussians(n, seed + 1);
  const thermalNoise = gaussians(n, seed + 2);
  const driftNoise = gaussians(n, seed + 3);
  const glitchDraw = uniforms(n, seed + 4);
  let y = Float64Array.from({ length: n }, (_, i) => {
    const t = i / FS + jitterNoise[i] * Math.max(0, settings.jitterPs) * 1e-12;
    return A * Math.sin(2 * Math.PI * FIN * t) + DC;
  });

  const amStrength = Math.max(0, settings.amNoisePpm) * 1e-6;
  if (amStrength) {
    for (let i = 0; i < n; i++) y[i] = DC + (y[i] - DC) * (1 + amStrength * amNoise[i]);
  }

  const k2 = settings.hd2Dbc <= HD_OFF ? 0 : (2 * 10 ** (settings.hd2Dbc / 20)) / A;
  const k3 = settings.hd3Dbc <= HD_OFF ? 0 : (4 * 10 ** (settings.hd3Dbc / 20)) / A ** 2;
  if (k2 || k3) {
    for (let i = 0; i < n; i++) {
      const x = y[i] - DC;
      y[i] = DC + x + k2 * x ** 2 + k3 * x ** 3;
    }
  }

  const memory = settings.memoryPct / 100;
  if (memory) {
    const source = new Float64Array(y);
    let previousMsb = Math.floor(source[n - 1] * 16) / 16;
    for (let i = 0; i < n; i++) {
      const msb = Math.floor(source[i] * 16) / 16;
      y[i] = source[i] + memory * previousMsb;
      previousMsb = msb;
    }
  }

  const tauNom = Math.max(0, settings.settlingTauPs) * 1e-12;
  if (tauNom) {
    const source = new Float64Array(y);
    const track = 0.2 / FS;
    let previous = source[n - 1] - DC;
    // Warm a periodic state before the measured record so startup is not presented as converter distortion.
    for (let i = -32; i < n; i++) {
      const target = source[(i + n) % n] - DC;
      const tau = tauNom * (1 + 0.15 * target ** 2);
      const out = target + (previous - target) * Math.exp(-track / tau);
      if (i >= 0) y[i] = DC + out;
      previous = out;
    }
  }

  if (settings.residueGainPct) {
    const source = new Float64Array(y), gain = 1 + settings.residueGainPct / 100;
    for (let i = 0; i < n; i++) {
      const x = source[i] - DC, msb = Math.floor(x * 16) / 16, lsb = Math.floor((x - msb) * 256) / 256;
      y[i] = DC + msb * gain + lsb;
    }
  }

  const dynamic = settings.dynamicResiduePctPerV2 / 100;
  if (dynamic) {
    const source = new Float64Array(y);
    let previous = 0;
    for (let i = 0; i < n; i++) {
      const x = source[i] - DC, msb = Math.floor(x * 16) / 16, lsb = Math.floor((x - msb) * 256) / 256;
      const out = msb * (1 + dynamic * previous ** 2) + lsb;
      y[i] = DC + out;
      previous = out;
    }
  }

  const amToneDepth = settings.amToneDepthPct / 100;
  if (amToneDepth) {
    for (let i = 0; i < n; i++) {
      y[i] = DC + (y[i] - DC) * (1 + amToneDepth * Math.sin((2 * Math.PI * 500e3 * i) / FS));
    }
  }

  const clipLevel = Math.max(0, settings.clipLevelMv) * 1e-3;
  if (clipLevel <= 0.5) {
    const lo = DC - clipLevel, hi = DC + clipLevel;
    for (let i = 0; i < n; i++) y[i] = Math.min(hi, Math.max(lo, y[i]));
  }

  const driftStep = Math.max(0, settings.driftStepUv) * 1e-6;
  if (driftStep) {
    let walk = 0, smooth = 0;
    for (let i = 0; i < n; i++) {
      walk += driftNoise[i] * driftStep;
      smooth += 0.006 * (walk - smooth);
      y[i] += smooth;
    }
  }

  const droopStrength = Math.max(0, settings.referenceDroopPctPerV) / 100;
  if (droopStrength) {
    let droop = 0;
    const decay = Math.exp(-10); // The reference example uses a 0.1-sample recovery constant.
    for (let i = 0; i < n; i++) {
      const ac = y[i] - DC;
      droop = droopStrength * Math.abs(ac) + decay * droop;
      y[i] = DC + ac * (1 - droop);
    }
  }

  const glitchProbability = Math.max(0, settings.glitchRatePpm) * 1e-6;
  const glitchAmplitude = settings.glitchAmplitudeMv * 1e-3;
  if (glitchProbability && glitchAmplitude) {
    for (let i = 0; i < n; i++) if (glitchDraw[i] < glitchProbability) y[i] += glitchAmplitude;
  }

  const noiseRms = Math.max(0, settings.thermalNoiseUv) * 1e-6;
  if (noiseRms) for (let i = 0; i < n; i++) y[i] += thermalNoise[i] * noiseRms;

  const qbits = Math.round(settings.quantizerBits);
  if (qbits > 0) {
    const levels = 2 ** qbits;
    for (let i = 0; i < n; i++) y[i] = Math.min(levels - 1, Math.max(0, Math.floor(y[i] * levels))) / levels;
  }

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
    // a cos(wt) + b sin(wt) = A cos(wt + phi), so phi = atan2(-b, a).
    phases[h - 1] = Math.atan2(-b, a);
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
  const bins = [out.signal, ...out.harmonics.slice(0, 4)], phase0 = Math.atan2(im[out.signal], re[out.signal]);
  const wrap = (angle: number) => ((angle + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  const rays = bins.map((bin, i) => {
    const order = i + 1, mirrored = (order * out.signal) % n > n / 2;
    const phase = (mirrored ? -1 : 1) * Math.atan2(im[bin], re[bin]);
    return { angle: wrap(phase - order * phase0), db: out.dbfs[bin], text: i ? `H${order}` : 'input', series: (i ? 2 : 1) as 1 | 2 };
  });
  // Only harmonics have the order needed for phi_h - h*phi_1. Do not mix raw noise-bin phases into this coordinate system.
  return { points: [], rays, floor: Math.max(-120, Math.min(-40, Math.round(Math.min(...Array.from(out.dbfs).filter(Number.isFinite)) / 10) * 10)) };
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

export function phasePlane(values: Float64Array, lag: number | 'auto' = 'auto', maxPoints = 4096): XY & { lag: number } {
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

export function errorPhasePlane(fit: Fit, bits: number, maxPoints = 4096): XY {
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

export function analyze(settings: Impairments, bits: number): Dashboard {
  const y = capture(settings, bits), fit = fitSine(y, FIN_BIN);
  const output = outputSpectrum(y, bits), decomposition = decompose(y);
  return {
    y,
    fit,
    value: byValue(y, fit.error),
    phase: byPhase(fit.error, FIN_BIN, fit.phase),
    distribution: pdf(fit.error, Math.max(0.75, 1.02 * Math.max(...fit.error.map(Math.abs)))),
    output,
    // A residual/envelope peak is not a new fundamental from which to label H2–H5.
    error: { ...errorSpectrum(fit.error, bits), harmonics: [] },
    envelopeSpectrum: { ...outputSpectrum(envelope(fit.error), bits), harmonics: [] },
    decomposition,
    outputPolar: spectrumPolar(y, output),
    decompositionPolar: decompositionPolar(decomposition),
    autocorr: autocorrelation(fit.error),
    phasePlane: phasePlane(y),
    errorPhasePlane: errorPhasePlane(fit, bits),
  };
}
