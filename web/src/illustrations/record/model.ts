/**
 * How long a record has to be: the same converter measured over lengths from sixteen samples to sixteen thousand,
 * and the same tone just below Nyquist at lengths too short to mean anything.
 * Ported from ADCToolbox 0.9.1 (github.com/Arcadia-1/ADCToolbox):
 *   spectrum/     analyze_spectrum at its defaults — the Hann window and the side bins it detects itself
 *   models/sar.py sar_ideal_weights with sar_convert and sar_reconstruct, which come to a plain floor quantiser
 *   fundamentals/ snr_to_enob and enob_to_snr, to set the noise that hits a target ENOB
 * following its examples exp_s13, exp_s09 and the single captures of exp_s01 … exp_s05.
 * python/adc_record_length.py calls ADCToolbox on the same samples; tests/record-model.test.ts compares the two.
 */
import { gaussians } from '../../lib/rng';
import { analyzeSpectrum, type Spectrum } from '../../lib/spectrum';
import { enobToSnr } from '../../lib/units';

export const FS = 800e6;
export const AMP = 0.49;
export const DC = 0.5;
export const BITS = 10;
export const TARGET_ENOB = 9;
export const HD3_DBC = -80;
export const FIN_RATIO = 0.123;
/** captures per length, enough for the spread to mean something without keeping a browser waiting */
export const RUNS = 16;
const SEED = 20260604;

/** exp_s13 sweeps 2^4 … 2^16; the lesson stops at 2^14, which is all it takes to show the shape */
export const LENGTHS = Array.from({ length: 11 }, (_, i) => 2 ** (i + 4));
/** exp_s09's short records, even and odd */
export const SHORT = [4, 5, 8, 9, 16, 17, 32, 33, 64, 65, 128, 129, 256, 257];
export const SAR_BITS = 4;

/** exp_s13's bin: the nearest to a fixed fraction of fs, nudged odd so the harmonics keep clear of it. */
export function coherentOddBin(n: number, ratio = FIN_RATIO): number {
  let k = Math.min(Math.max(Math.round(ratio * n), 1), Math.floor(n / 2) - 1);
  if (k % 2 === 0) k += k + 1 < Math.floor(n / 2) ? 1 : -1;
  return Math.max(k, 1);
}

/** exp_s09's bin: the last one below Nyquist, N/2 − 1 for an even record and ⌊N/2⌋ for an odd one. */
export const nearNyquistBin = (n: number): number => (n % 2 === 0 ? Math.max(1, n / 2 - 1) : Math.floor(n / 2));

/** The input noise that, on top of an ideal quantiser's own, brings a capture to this many effective bits. */
export function noiseFor(enob = TARGET_ENOB, bits = BITS, amp = AMP): number {
  const total = amp ** 2 / 2 / 10 ** (enobToSnr(enob) / 10);
  return Math.sqrt(Math.max(total - (1 / 2 ** bits) ** 2 / 12, 0));
}

/** An ideal converter on 0 … 1 V: what sar_convert and sar_reconstruct do with ideal weights. */
export const quantise = (v: number, bits: number): number =>
  Math.floor(Math.min(Math.max(v, 0), 1 - Number.EPSILON / 2) * 2 ** bits) / 2 ** bits;

/** exp_s13's capture: a coherent tone with a third harmonic at a fixed level, noise, and the converter. */
export function capture(n: number, run: number, noiseRms: number, hd3Dbc = HD3_DBC, bits = BITS): Float64Array {
  const bin = coherentOddBin(n), hd3 = AMP * 10 ** (hd3Dbc / 20);
  const z = gaussians(n, SEED + 1009 * run + n);
  return Float64Array.from({ length: n }, (_, i) => {
    const clean = DC + AMP * Math.sin((2 * Math.PI * bin * i) / n) + hd3 * Math.sin((2 * Math.PI * 3 * bin * i) / n);
    return quantise(clean + z[i] * noiseRms, bits);
  });
}

/** analyze_spectrum as exp_s13 calls it: over the 0 … 1 V range, the Hann window, side bins detected. */
export const spectrumOf = (x: Float64Array): Spectrum => analyzeSpectrum(x.map((v) => v * 2), 1, 'hann', 'auto');

export interface Spread {
  mean: number;
  /** the sample standard deviation, the spread a single capture would have cost you */
  sigma: number;
  min: number;
  max: number;
}

export function spread(values: number[]): Spread {
  const m = values.reduce((a, v) => a + v, 0) / values.length;
  const variance = values.reduce((a, v) => a + (v - m) ** 2, 0) / (values.length - 1);
  return { mean: m, sigma: Math.sqrt(variance), min: Math.min(...values), max: Math.max(...values) };
}

export interface LengthRow {
  n: number;
  bin: number;
  sfdr: Spread;
  sndr: Spread;
  /** Individual captures are retained so the lesson can show the population behind the summary band. */
  sfdrRuns: number[];
  sndrRuns: number[];
}

/**
 * exp_s13 one capture at a time: a row comes out whenever a length has had all its runs, and a null every capture
 * before that, so a browser can spend a few milliseconds on it at a time instead of a third of a second at once.
 */
export function* sweepStream(
  noiseRms = noiseFor(),
  hd3Dbc = HD3_DBC,
  bits = BITS,
  runs = RUNS,
  lengths = LENGTHS,
): Generator<LengthRow | null> {
  for (const n of lengths) {
    const sfdr: number[] = [], sndr: number[] = [];
    for (let run = 0; run < runs; run++) {
      const s = spectrumOf(capture(n, run, noiseRms, hd3Dbc, bits));
      sfdr.push(s.sfdr);
      sndr.push(s.sndr);
      yield run === runs - 1
        ? {
            n,
            bin: coherentOddBin(n),
            sfdr: spread(sfdr),
            sndr: spread(sndr),
            sfdrRuns: [...sfdr],
            sndrRuns: [...sndr],
          }
        : null;
    }
  }
}

/** exp_s13: every length, `runs` captures each, and what the two numbers did across them. */
export function sweep(noiseRms = noiseFor(), hd3Dbc = HD3_DBC, bits = BITS, runs = RUNS, lengths = LENGTHS): LengthRow[] {
  const rows: LengthRow[] = [];
  for (const row of sweepStream(noiseRms, hd3Dbc, bits, runs, lengths)) if (row) rows.push(row);
  return rows;
}

export interface ShortRow {
  n: number;
  bin: number;
  sndr: number;
  sfdr: number;
  enob: number;
}

export interface ShortCapture {
  n: number;
  bin: number;
  data: Float64Array;
  phases: Float64Array;
  codes: Uint16Array;
  counts: Uint16Array;
  spectrum: Spectrum;
}

/** One of exp_s09's records, retaining the evidence hidden behind its three summary numbers. */
export function shortCapture(n: number, bits = SAR_BITS): ShortCapture {
  const bin = nearNyquistBin(n), levels = 2 ** bits;
  const data = Float64Array.from({ length: n }, (_, i) => quantise(DC + AMP * Math.sin((2 * Math.PI * bin * i) / n), bits));
  const phases = Float64Array.from({ length: n }, (_, i) => ((bin * i) % n) / n);
  const codes = Uint16Array.from(data, (v) => Math.min(levels - 1, Math.max(0, Math.round(v * levels))));
  const counts = new Uint16Array(levels);
  for (const code of codes) counts[code] += 1;
  return { n, bin, data, phases, codes, counts, spectrum: analyzeSpectrum(data.map((v) => v * 2), 1, 'rectangular', 'auto') };
}

/** exp_s09: a small SAR with the tone as close to Nyquist as the record allows, at lengths too short to trust. */
export function nearNyquist(bits = SAR_BITS, lengths = SHORT): ShortRow[] {
  return lengths.map((n) => {
    const capture = shortCapture(n, bits), s = capture.spectrum;
    return { n, bin: capture.bin, sndr: s.sndr, sfdr: s.sfdr, enob: s.enob };
  });
}

export interface Reading {
  n: number;
  data: Float64Array;
  spectrum: Spectrum;
  bin: number;
  /** what the tone and its third harmonic are worth in volts, for the page to name them */
  noiseRms: number;
  hd3: number;
}

/** One capture at one length, the one the page draws a spectrum of. */
export function read(n: number, run = 0, noiseRms = noiseFor(), hd3Dbc = HD3_DBC, bits = BITS): Reading {
  const data = capture(n, run, noiseRms, hd3Dbc, bits);
  return { n, data, spectrum: spectrumOf(data), bin: coherentOddBin(n), noiseRms, hd3: AMP * 10 ** (hd3Dbc / 20) };
}
