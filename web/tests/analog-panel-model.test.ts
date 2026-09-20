import { describe, expect, it } from 'vitest';
import { analyze, CASES } from '../src/illustrations/analog-panel/model';

const allFinite = (values: ArrayLike<number>) => Array.from(values).every(Number.isFinite);

describe('ADCToolbox analog output panel', () => {
  it.each(CASES)('computes all twelve views for $label', ({ id }) => {
    const d = analyze(id, 1, 12);
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
    expect(d.distribution.counts.reduce((sum, v) => sum + v, 0)).toBe(d.y.length);
    expect(d.error.harmonics).toEqual([]);
    expect(d.envelopeSpectrum.harmonics).toEqual([]);
    // Sparse glitches must remain present in the phase-plane diagnostics, not disappear through stride sampling.
    expect(d.errorPhasePlane.y).toEqual(d.fit.error);
    expect(d.phasePlane.x).toHaveLength(d.y.length - d.phasePlane.lag);
  });

  it('reconstructs every sample as fundamental + harmonics + residual', () => {
    const d = analyze('hd3', 1, 12);
    for (let i = 0; i < d.y.length; i += 97) {
      expect(d.decomposition.fundamental[i] + d.decomposition.harmonic[i] + d.decomposition.residual[i]).toBeCloseTo(d.y[i], 10);
    }
  });

  it('preserves the expected diagnostic fingerprints', () => {
    const jitter = analyze('jitter', 1, 12);
    expect(jitter.phase.pm).toBeGreaterThan(8 * Math.max(jitter.phase.am, 1e-6));

    const hd3 = analyze('hd3', 1, 12);
    expect(hd3.decomposition.magnitudesDb[2]).toBeGreaterThan(hd3.decomposition.magnitudesDb[1] + 8);

    const memory = analyze('memory', 1, 12);
    expect(Math.abs(memory.autocorr.y[47])).toBeGreaterThan(0.004);
  });
});
