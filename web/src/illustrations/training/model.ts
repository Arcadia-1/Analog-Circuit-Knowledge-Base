/**
 * How much training a calibration needs: a 16-bit SAR whose capacitors are off by a per-unit sigma, calibrated from a
 * short capture of its own and then measured on a capture it has never seen.
 * Ported from ADCToolbox 0.9.1 (github.com/Arcadia-1/ADCToolbox):
 *   models/sar.py   sar_apply_cap_mismatch, sar_convert, sar_reconstruct
 *   calibration/    calibrate_weight_sine, through src/lib/calibration.ts
 *   spectrum/       quick_sndr and analyze_spectrum, through src/lib/spectrum.ts
 * following its examples exp_d18, exp_d16 and exp_d01.
 * python/adc_training_length.py calls ADCToolbox on the same chips; tests/training-model.test.ts compares the two.
 */
import { calibrateWeightSine } from '../../lib/calibration';
import { gaussians } from '../../lib/rng';
import { analyzeSpectrum, type Spectrum } from '../../lib/spectrum';

/** exp_d18's radix-1.8 array: eighteen weights spanning sixteen bits, so five of them are redundant */
const RAW = [29127, 16182, 8990, 4995, 2775, 1542, 856, 476, 264, 147, 82, 45, 25, 14, 8, 4, 2, 1];
const RAW_SUM = RAW.reduce((a, v) => a + v, 0) + RAW[RAW.length - 1];
export const REDUNDANT = RAW.map((v) => v / RAW_SUM);
export const BINARY = Array.from({ length: 16 }, (_, i) => 2 ** -(i + 1));
export const ARRAYS: Record<string, number[]> = { redundant: REDUNDANT, binary: BINARY };
export type ArrayName = keyof typeof ARRAYS;

export const N_TEST = 4096;
export const TEST_BIN = 445;
const TRAIN_RATIO = 997 / 16384;
export const AMP = 0.499;
export const DC = 0.5;
export const SIGMA = 0.01;
export const TRIALS = 8;
const SEED = 20260525;
/**
 * The training lengths the lesson sweeps. It starts at 32 because below about thirty samples a strict binary array
 * leaves the fit singular: the answer stops being the converter's and becomes the solver's, and this Cholesky and
 * numpy's least squares part company there by a few hundredths of a bit.
 */
export const LENGTHS = [32, 48, 64, 96, 128, 256, 512, 1024, 2048, 4096];

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/** exp_d18's training bin: odd, coprime with the record, near the same fraction of fs at every length. */
export function trainBin(n: number): number {
  let b = Math.max(1, Math.min(Math.round(TRAIN_RATIO * n), Math.floor(n / 2) - 1));
  if (b % 2 === 0) b += b + 1 < Math.floor(n / 2) ? 1 : -1;
  while (gcd(n, b) !== 1 && b + 2 < Math.floor(n / 2)) b += 2;
  return b;
}

/** sar_apply_cap_mismatch: a capacitor of n units carries sigma / √n of relative mismatch, so the MSBs fare best. */
export function applyCapMismatch(weights: number[], sigma: number, normals: Float64Array): number[] {
  const unit = Math.min(...weights);
  return weights.map((w, j) => w * (1 + (sigma / Math.sqrt(w / unit)) * normals[j]));
}

/** One converter, the same chip at every training length. */
export const chipOf = (nominal: number[], trial: number, sigma = SIGMA): number[] =>
  applyCapMismatch(nominal, sigma, gaussians(nominal.length, SEED + trial));

/** A starting phase per capture, so no two captures sample the same points. */
export function phaseOf(trial: number, nTrain = 0): number {
  const z = gaussians(2, SEED + 7919 * trial + nTrain)[0];
  return 2 * Math.PI * (z % 1);
}

export const sine = (n: number, bin: number, phase: number): Float64Array =>
  Float64Array.from({ length: n }, (_, i) => DC + AMP * Math.sin((2 * Math.PI * bin * i) / n + phase));

/** sar_convert on 0 … 1 V: keep each weight if the input is above the level it would make. Bits are row-major. */
export function sarConvert(vin: Float64Array, weights: number[]): Uint8Array {
  const m = weights.length, bits = new Uint8Array(vin.length * m);
  for (let i = 0; i < vin.length; i++) {
    let dac = 0;
    for (let j = 0; j < m; j++) {
      const test = dac + weights[j];
      if (vin[i] > test) {
        bits[i * m + j] = 1;
        dac = test;
      }
    }
  }
  return bits;
}

/** sar_reconstruct: the weighted sum of each sample's bits. */
export function sarReconstruct(bits: Uint8Array, weights: ArrayLike<number>): Float64Array {
  const m = weights.length;
  return Float64Array.from({ length: bits.length / m }, (_, i) => {
    let v = 0;
    for (let j = 0; j < m; j++) v += bits[i * m + j] * weights[j];
    return v;
  });
}

/** quick_sndr with the rectangular window on a coherent capture: the same SNDR analyze_spectrum reports. */
export const spectrumOf = (trace: Float64Array): Spectrum => analyzeSpectrum(trace, 1);
export const enobOf = (trace: Float64Array): number => spectrumOf(trace).enob;

/** calibrate_weight_sine on one training capture, at the frequency it was taken at. */
export const calibrate = (bits: Uint8Array, m: number, bin: number, n: number): Float64Array =>
  calibrateWeightSine(bits, m, bin / n).weight;

export interface Chip {
  /** the array as built, and the bits a long capture of it produced */
  weights: number[];
  bits: Uint8Array;
  /** what that capture is worth with the nominal weights, before any calibration */
  uncalibrated: number;
}

/** One chip and its test capture, which every training length is then judged against. */
export function readChip(nominal: number[], trial: number, sigma = SIGMA): Chip {
  const weights = chipOf(nominal, trial, sigma);
  const bits = sarConvert(sine(N_TEST, TEST_BIN, phaseOf(trial)), weights);
  return { weights, bits, uncalibrated: enobOf(sarReconstruct(bits, nominal)) };
}

export interface Trained {
  n: number;
  bin: number;
  /** ENOB on the capture the weights were never shown, and on the one they were solved from */
  test: number;
  own: number;
  weights: Float64Array;
}

/** Calibrate one chip from `n` samples of its own and measure both ways. */
export function train(nominal: number[], chip: Chip, trial: number, n: number): Trained {
  const bin = trainBin(n);
  const bits = sarConvert(sine(n, bin, phaseOf(trial, n)), chip.weights);
  const weights = calibrate(bits, nominal.length, bin, n);
  return {
    n,
    bin,
    test: enobOf(sarReconstruct(chip.bits, weights)),
    own: enobOf(sarReconstruct(bits, weights)),
    weights,
  };
}

export interface Band {
  n: number;
  bin: number;
  /** across the chips: the worst, the middle and the best */
  test: [number, number, number];
  own: [number, number, number];
}

const band = (values: number[]): [number, number, number] => {
  const sorted = [...values].sort((a, b) => a - b), mid = sorted.length / 2;
  const median = sorted.length % 2 ? sorted[Math.floor(mid)] : (sorted[mid - 1] + sorted[mid]) / 2;
  return [sorted[0], median, sorted[sorted.length - 1]];
};

/**
 * exp_d18 one calibration at a time: a band comes out whenever a length has been through every chip, so a browser can
 * spend a few milliseconds at a time on what is otherwise half a second of solving.
 */
export function* sweepStream(
  name: ArrayName,
  sigma = SIGMA,
  trials = TRIALS,
  lengths = LENGTHS,
): Generator<Band | null> {
  const nominal = ARRAYS[name];
  const chips = Array.from({ length: trials }, (_, t) => readChip(nominal, t, sigma));
  for (const n of lengths) {
    const test: number[] = [], own: number[] = [];
    for (let t = 0; t < trials; t++) {
      const r = train(nominal, chips[t], t, n);
      test.push(r.test);
      own.push(r.own);
      yield t === trials - 1 ? { n, bin: trainBin(n), test: band(test), own: band(own) } : null;
    }
  }
}

/** exp_d18: every training length, every chip. */
export function sweep(name: ArrayName, sigma = SIGMA, trials = TRIALS, lengths = LENGTHS): Band[] {
  const rows: Band[] = [];
  for (const row of sweepStream(name, sigma, trials, lengths)) if (row) rows.push(row);
  return rows;
}

/** What the chips read before any calibration, for the line the sweep is measured against. */
export function uncalibrated(name: ArrayName, sigma = SIGMA, trials = TRIALS): [number, number, number] {
  return band(Array.from({ length: trials }, (_, t) => readChip(ARRAYS[name], t, sigma).uncalibrated));
}

export interface Reading {
  chip: Chip;
  trained: Trained;
  /** the test capture read with the nominal weights, and with the calibrated ones */
  before: Spectrum;
  after: Spectrum;
  /** each weight as a share of its nominal size: as built, and as the calibration recovered it */
  built: number[];
  recovered: number[];
}

/** One chip at one training length, the case the page draws in detail. */
export function read(name: ArrayName, trial: number, n: number, sigma = SIGMA): Reading {
  const nominal = ARRAYS[name];
  const chip = readChip(nominal, trial, sigma);
  const trained = train(nominal, chip, trial, n);
  const nominalSum = nominal.reduce((a, v) => a + v, 0);
  let calSum = 0;
  for (const w of trained.weights) calSum += w;
  return {
    chip,
    trained,
    before: spectrumOf(sarReconstruct(chip.bits, nominal)),
    after: spectrumOf(sarReconstruct(chip.bits, trained.weights)),
    built: chip.weights.map((w, j) => w / nominal[j]),
    recovered: nominal.map((w, j) => trained.weights[j] / calSum / (w / nominalSum)),
  };
}
