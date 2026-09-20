import { describe, expect, it } from 'vitest';
import {
  analyze,
  capture,
  CLEAN_IMPAIRMENTS,
  DEFAULT_IMPAIRMENTS,
  MAX_IMPAIRMENTS,
  MIN_IMPAIRMENTS,
  type Impairments,
} from '../src/illustrations/analog-panel/model';

const allFinite = (values: ArrayLike<number>) => Array.from(values).every(Number.isFinite);
const withError = (patch: Partial<Impairments>): Impairments => ({ ...CLEAN_IMPAIRMENTS, ...patch });
const differs = (a: ArrayLike<number>, b: ArrayLike<number>) => Array.from(a).some((value, i) => Math.abs(value - b[i]) > 1e-9);

const individualErrors: { label: string; settings: Partial<Impairments> }[] = [
  { label: 'thermal noise', settings: { thermalNoiseUv: 180 } },
  { label: 'quantization', settings: { quantizerBits: 10 } },
  { label: 'jitter', settings: { jitterPs: 2 } },
  { label: 'AM noise', settings: { amNoisePpm: 500 } },
  { label: 'HD2', settings: { hd2Dbc: -80 } },
  { label: 'HD3', settings: { hd3Dbc: -70 } },
  { label: 'memory', settings: { memoryPct: 0.9 } },
  { label: 'settling', settings: { settlingTauPs: 40 } },
  { label: 'residue gain', settings: { residueGainPct: -1 } },
  { label: 'dynamic residue gain', settings: { dynamicResiduePctPerV2: 15 } },
  { label: 'AM tone', settings: { amToneDepthPct: 5 } },
  { label: 'clipping', settings: { clipLevelMv: 400 } },
  { label: 'drift', settings: { driftStepUv: 50 } },
  { label: 'reference droop', settings: { referenceDroopPctPerV: 0.2 } },
  { label: 'glitches', settings: { glitchCount: 8, glitchAmplitudeMv: 100 } },
];

describe('ADCToolbox analog output panel', () => {
  it.each([
    { label: 'clean converter', settings: CLEAN_IMPAIRMENTS },
    { label: 'composite converter', settings: DEFAULT_IMPAIRMENTS },
    ...individualErrors.map(({ label, settings }) => ({ label, settings: withError(settings) })),
  ])('computes all twelve views for $label', ({ settings }) => {
    const d = analyze(settings, 12);
    expect(d.y).toHaveLength(4096);
    expect(allFinite(d.y)).toBe(true);
    expect(allFinite(d.fit.error)).toBe(true);
    expect(allFinite(d.output.dbfs)).toBe(true);
    expect(allFinite(d.error.dbfs)).toBe(true);
    expect(allFinite(d.envelopeSpectrum.dbfs)).toBe(true);
    expect(allFinite(d.autocorr.y)).toBe(true);
    expect(allFinite(d.phasePlane.x)).toBe(true);
    expect(allFinite(d.errorPhasePlane.y)).toBe(true);
    expect(d.outputPolar.rays).toHaveLength(5);
    expect(d.decompositionPolar.rays).toHaveLength(5);
    expect(d.distribution.counts.reduce((sum, value) => sum + value, 0)).toBe(d.y.length);
    expect(d.error.harmonics).toEqual([]);
    expect(d.envelopeSpectrum.harmonics).toEqual([]);
    expect(d.errorPhasePlane.y).toEqual(d.fit.error);
    expect(d.phasePlane.x).toHaveLength(d.y.length - d.phasePlane.lag);
  });

  it.each(individualErrors)('$label has an independent, observable effect', ({ settings }) => {
    const clean = capture(CLEAN_IMPAIRMENTS, 12);
    expect(differs(capture(withError(settings), 12), clean)).toBe(true);
  });

  it('applies several enabled errors to the same record', () => {
    const thermal = capture(withError({ thermalNoiseUv: 180 }), 12);
    const harmonic = capture(withError({ hd3Dbc: -60 }), 12);
    const combinedSettings = withError({ thermalNoiseUv: 180, hd3Dbc: -60, jitterPs: 1, amToneDepthPct: 2 });
    const combined = capture(combinedSettings, 12);
    expect(differs(combined, thermal)).toBe(true);
    expect(differs(combined, harmonic)).toBe(true);

    const d = analyze(combinedSettings, 12);
    expect(d.decomposition.magnitudesDb[2]).toBeGreaterThan(-62);
    expect(d.output.sndr).toBeLessThan(analyze(withError({ thermalNoiseUv: 180 }), 12).output.sndr);
  });

  it('reconstructs every sample as fundamental + harmonics + residual', () => {
    const d = analyze(withError({ hd3Dbc: -70 }), 12);
    for (let i = 0; i < d.y.length; i += 97) {
      expect(d.decomposition.fundamental[i] + d.decomposition.harmonic[i] + d.decomposition.residual[i]).toBeCloseTo(d.y[i], 10);
    }
  });

  it('preserves the expected diagnostic fingerprints', () => {
    const jitter = analyze(withError({ jitterPs: 2 }), 12);
    expect(jitter.phase.pm).toBeGreaterThan(8 * Math.max(jitter.phase.am, 1e-6));

    const hd3 = analyze(withError({ hd3Dbc: -70 }), 12);
    expect(hd3.decomposition.magnitudesDb[2]).toBeGreaterThan(hd3.decomposition.magnitudesDb[1] + 8);

    const memory = analyze(withError({ memoryPct: 0.9 }), 12);
    expect(Math.abs(memory.autocorr.y[47])).toBeGreaterThan(0.004);
  });

  it('has negligible fitted residual when every error is disabled', () => {
    expect(analyze(CLEAN_IMPAIRMENTS, 12).fit.rmse).toBeLessThan(1e-8);
  });

  it('orders the Minimum and Maximum presets by converter performance', () => {
    const minimum = analyze(MIN_IMPAIRMENTS, 12).output.sndr;
    const maximum = analyze(MAX_IMPAIRMENTS, 12).output.sndr;
    expect(minimum).toBeGreaterThan(100);
    expect(maximum).toBeLessThan(20);
    expect(minimum).toBeGreaterThan(maximum);
  });

  it('uses the selected coherent input bin and FFT record length', () => {
    const config = { fs: 800e6, points: 1024, finBin: 123 };
    const d = analyze(CLEAN_IMPAIRMENTS, 12, config);
    expect(d.y).toHaveLength(1024);
    expect(d.output.signal).toBe(123);
    expect(d.fit.frequency).toBeCloseTo(123 / 1024, 12);
  });

  it('places exactly the requested number of glitches in each record', () => {
    const clean = capture(CLEAN_IMPAIRMENTS, 12, 41);
    const glitched = capture(withError({ glitchCount: 7, glitchAmplitudeMv: 100 }), 12, 41);
    expect(Array.from(glitched).filter((value, i) => Math.abs(value - clean[i]) > 1e-9)).toHaveLength(7);
  });

  it.each([
    { label: 'H2', level: 'hd2Dbc' as const, sign: 'hd2Sign' as const },
    { label: 'H3', level: 'hd3Dbc' as const, sign: 'hd3Sign' as const },
  ])('reverses the $label waveform contribution when its polarity changes', ({ level, sign }) => {
    const clean = capture(CLEAN_IMPAIRMENTS, 12);
    const positive = capture(withError({ [level]: -55, [sign]: 1 }), 12);
    const negative = capture(withError({ [level]: -55, [sign]: -1 }), 12);
    for (let i = 0; i < clean.length; i += 97) {
      expect(positive[i] - clean[i]).toBeCloseTo(-(negative[i] - clean[i]), 10);
    }
  });

  it('uses the seed only to draw a repeatable stochastic realization', () => {
    const settings = withError({ thermalNoiseUv: 180, jitterPs: 1, driftStepUv: 20, glitchCount: 4, glitchAmplitudeMv: 50 });
    const first = analyze(settings, 12, undefined, 41);
    const repeat = analyze(settings, 12, undefined, 41);
    const redrawn = analyze(settings, 12, undefined, 42);
    expect(first.y).toEqual(repeat.y);
    expect(differs(first.y, redrawn.y)).toBe(true);
  });
});
