/**
 * Coherent sampling, windows and record length: the measurement, rather than the converter.
 * Uses the ADCToolbox 0.9.1 spectrum port in src/lib/spectrum.ts — spectrum/compute_spectrum with the window, its
 * power correction and the side bins of spectrum/_window — on a perfect converter, so every number on the page is a
 * property of the FFT and not of the ADC.
 * python/adc_coherent_sampling.py runs ADCToolbox on the same samples; tests/coherence-model.test.ts compares the two.
 */
import { gaussians } from '../../lib/rng';
import { analyzeSpectrum, SIDE_BINS, type Spectrum, type Window } from '../../lib/spectrum';

export const LENGTHS = [256, 1024, 4096, 16384];
/** Roughly a seventh of the band, so the harmonics land clear of the fundamental and of each other. */
const TONE = 613 / 4096;
const AMP_DBFS = -1;

/** Cycles in the record nearest the fixed tone, forced odd so no harmonic folds onto the fundamental. */
export function baseCycles(len: number): number {
  const k = Math.round(len * TONE);
  return k % 2 ? k : k + 1;
}

/**
 * One record of a sine of `cycles` cycles, quantised by a perfect n-bit converter. A whole number of cycles is a
 * coherent capture: the record joins onto itself and the tone falls in one bin. A fraction of a cycle left over is a
 * step at the seam, which is what leaks.
 */
export function capture(n: number, len: number, cycles: number, noise: number, seed: number): Float64Array {
  const codes = 2 ** n, mid = codes / 2, amp = mid * 10 ** (AMP_DBFS / 20);
  const z = noise ? gaussians(len, seed) : null;
  return Float64Array.from({ length: len }, (_, i) =>
    Math.round(mid + amp * Math.sin((2 * Math.PI * cycles * i) / len) + (z ? z[i] * noise : 0)),
  );
}

export interface Reading {
  spectrum: Spectrum;
  /** the bin the tone would sit in, which is where it sits only when the capture is coherent */
  bin: number;
}

export function read(n: number, len: number, cycles: number, kind: Window, sideBin: number, noise: number, seed: number): Reading {
  return { spectrum: analyzeSpectrum(capture(n, len, cycles, noise, seed), n, kind, sideBin), bin: Math.round(cycles) };
}

/** ENOB against how far the tone sits from a bin, for one window: the cost of getting the frequency slightly wrong. */
export function sweep(n: number, len: number, kind: Window, sideBin: number, noise: number, seed: number, points = 41): Float64Array {
  const base = baseCycles(len);
  return Float64Array.from({ length: points }, (_, i) => {
    const offset = -0.5 + i / (points - 1);
    return analyzeSpectrum(capture(n, len, base + offset, noise, seed), n, kind, sideBin).enob;
  });
}

export const defaultSideBin = (kind: Window): number => SIDE_BINS[kind];
