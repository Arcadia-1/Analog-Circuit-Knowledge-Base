/**
 * Averaging and the polar spectrum: the same tone captured again and again, at a new phase each time, averaged as
 * powers or as phase-aligned complex spectra; and the phase of every harmonic, which tells a static curve from a
 * converter that remembers its last sample.
 * Ported from ADCToolbox 0.9.1 (github.com/Arcadia-1/ADCToolbox):
 *   spectrum/   compute_spectrum over runs, power-averaged (analyze_spectrum) and coherently averaged
 *               (analyze_spectrum_polar), through src/lib/averaged-spectrum.ts
 *   fundamentals/  find_coherent_frequency, through src/lib/frequency.ts
 * following its examples exp_s07, exp_s10, exp_s11 and exp_s12.
 * python/adc_polar_averaging.py calls ADCToolbox on the same samples; tests/polar-model.test.ts compares the two.
 *
 * 1024 samples at 100 MHz, a 0.499 V sine, as exp_s12 has it.
 */
import { averagedSpectrum, type AveragedSpectrum } from '../../lib/averaged-spectrum';
import { coherentFrequency } from '../../lib/frequency';
import { gaussians, uniforms } from '../../lib/rng';

export const N = 1024;
export const FS = 100e6;
export const AMP = 0.499;
const DC = 0.5;
export const MAX_RUNS = 100;
export const RUNS = [1, 10, 100];
/** the run counts the SNR curve is read at */
export const CHECKPOINTS = [1, 2, 3, 5, 7, 10, 15, 20, 30, 50, 70, 100];
/** analyze_spectrum_polar's radial range, as the examples fix it */
export const RADIAL = 120;

const PHASES = uniforms(MAX_RUNS, 21).map((u) => u * 2 * Math.PI);
const NOISE = gaussians(MAX_RUNS * (N + 1), 22);

export type Source = 'static' | 'memory';

export interface Setting {
  source: Source;
  target: number;
  /** dBc of HD2 and HD3, or null for none, and the sign of the cubic term */
  hd2: number | null;
  hd3: number | null;
  sign: 1 | -1;
  /** how much of the previous sample's coarse code leaks into the next */
  memory: number;
  /** volts rms */
  noise: number;
}

/**
 * exp_s07 and exp_s12: a sine at a new phase each run, through x + k2·x² + k3·x³ with the coefficients that put HD2 and
 * HD3 where asked, plus noise.
 */
export function staticRuns(fin: number, runs: number, hd2: number | null, hd3: number | null, sign: number, noise: number): Float64Array[] {
  const k2 = hd2 !== null ? 10 ** (hd2 / 20) / (AMP / 2) : 0;
  const k3 = hd3 !== null ? (sign * 10 ** (hd3 / 20)) / (AMP ** 2 / 4) : 0;
  return Array.from({ length: runs }, (_, r) =>
    Float64Array.from({ length: N }, (_, i) => {
      const x = AMP * Math.sin(2 * Math.PI * fin * (i / FS) + PHASES[r]);
      return x + k2 * (x * x) + k3 * x ** 3 + NOISE[r * (N + 1) + i] * noise;
    }),
  );
}

/**
 * exp_s11's memory effect: the input split into a 4-bit coarse code and an 18-bit fine one, with a share of the
 * previous sample's coarse code added to each output.
 */
export function memoryRuns(fin: number, runs: number, strength: number, noise: number): Float64Array[] {
  return Array.from({ length: runs }, (_, r) => {
    const msb = new Float64Array(N + 1), lsb = new Float64Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const x = AMP * Math.sin(2 * Math.PI * fin * (i / FS) + PHASES[r]) + DC + NOISE[r * (N + 1) + i] * noise;
      msb[i] = Math.floor(x * 2 ** 4) / 2 ** 4;
      lsb[i] = Math.floor((x - msb[i]) * 2 ** 18) / 2 ** 18;
    }
    return Float64Array.from({ length: N }, (_, i) => msb[i + 1] + lsb[i + 1] + strength * msb[i]);
  });
}

export function capture(s: Setting, runs: number): { fin: number; bin: number; data: Float64Array[] } {
  const { fin, bin } = coherentFrequency(FS, s.target, N);
  const data = s.source === 'static' ? staticRuns(fin, runs, s.hd2, s.hd3, s.sign, s.noise) : memoryRuns(fin, runs, s.memory, s.noise);
  return { fin, bin, data };
}

/** analyze_spectrum's power average and analyze_spectrum_polar's coherent one, with the rectangular window the polar plot uses. */
export const spectrumOf = (data: Float64Array[], coherent: boolean): AveragedSpectrum => averagedSpectrum(data, 'rectangular', coherent);

export interface Polar {
  /** per bin: the phase in radians, clockwise from north as the polar plot draws it, and the radius in dB above −RADIAL */
  phase: Float64Array;
  radius: Float64Array;
}

/** plot_spectrum_polar with fixed_radial_range: dB of |V| clamped at −RADIAL and measured from there. */
export function polarOf(s: AveragedSpectrum): Polar {
  const re = s.re!, im = s.im!;
  return {
    phase: Float64Array.from(re, (r, k) => Math.atan2(im[k], r)),
    radius: Float64Array.from(re, (r, k) => Math.max(20 * Math.log10(Math.hypot(r, im[k]) + 1e-20), -RADIAL) + RADIAL),
  };
}

/** The phase of a bin of the coherent spectrum, in degrees, as the polar plot's legend gives it. */
export const phaseDeg = (s: AveragedSpectrum, bin: number): number => (Math.atan2(s.im![bin], s.re![bin]) * 180) / Math.PI;

export interface Reading {
  fin: number;
  bin: number;
  power: AveragedSpectrum;
  coherent: AveragedSpectrum;
}

export function read(s: Setting, runs: number): Reading {
  const { fin, bin, data } = capture(s, runs);
  return { fin, bin, power: spectrumOf(data, false), coherent: spectrumOf(data, true) };
}

export interface Curve {
  runs: number[];
  /** SNDR and SNR, power-averaged and coherently averaged, at each run count */
  powerSndr: number[];
  powerSnr: number[];
  coherentSndr: number[];
  coherentSnr: number[];
}

/** exp_s07's comparison: the same runs averaged both ways, the first 1, 2, 3 … 100 of them. */
export function curve(s: Setting): Curve {
  const { data } = capture(s, MAX_RUNS);
  const out: Curve = { runs: CHECKPOINTS, powerSndr: [], powerSnr: [], coherentSndr: [], coherentSnr: [] };
  for (const k of CHECKPOINTS) {
    const p = spectrumOf(data.slice(0, k), false), c = spectrumOf(data.slice(0, k), true);
    out.powerSndr.push(p.sndr);
    out.powerSnr.push(p.snr);
    out.coherentSndr.push(c.sndr);
    out.coherentSnr.push(c.snr);
  }
  return out;
}
