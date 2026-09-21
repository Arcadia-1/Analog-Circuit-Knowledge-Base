import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { amplifier, response } from '../src/illustrations/amplifier/model';
import { featuredLessons } from '../src/data/illustrations';
import { isLessonPath, isPublicLessonPath } from '../src/data/publication';

describe('single-pole negative-feedback amplifier', () => {
  it('matches an independent NumPy complex-division reference across the control range', () => {
    const rows = readFileSync(new URL('../python/expected/amplifier_feedback.txt', import.meta.url), 'utf8').trim().split('\n').slice(1);
    for (const row of rows) {
      const [a0Db, gbw, gainDb, f, openDb, loopDb, closedDb, phase] = row.split(/\s+/).map(Number);
      const r = response(amplifier(a0Db, gbw, gainDb), f);
      expect(r.openDb).toBeCloseTo(openDb, 7);
      expect(r.loopDb).toBeCloseTo(loopDb, 7);
      expect(r.closedDb).toBeCloseTo(closedDb, 7);
      expect(r.closedPhase).toBeCloseTo(phase, 7);
    }
  });

  it('reproduces the original 60 dB / 80 dB comparison with exact closed-loop bandwidths', () => {
    const a = amplifier(60, 100e3, 20), b = amplifier(80, 100e3, 20);
    expect(a.closedDc).toBeCloseTo(9.900990099, 9);
    expect(b.closedDc).toBeCloseTo(9.990009990, 9);
    expect(a.closedBw).toBe(10100);
    expect(b.closedBw).toBe(10010);
    expect(a.relativeError * 100).toBeCloseTo(.9900990099, 10);
    expect(b.relativeError * 100).toBeCloseTo(.0999000999, 10);
    expect(b.pole).toBe(a.pole / 10);
    expect(b.closedBw).toBeLessThan(a.closedBw);
    // The old magnitude-only division gives ~14 dB here. Complex division gives |1000/(101+j100)|².
    expect(response(a, 10e3).closedDb).toBeCloseTo(10 * Math.log10(1e6 / 20201), 10);
  });

  it.each([20, 40, 60, 80, 100])('obeys gain, bandwidth and phase identities at A0 = %i dB', (a0Db) => {
    for (const gbw of [1e3, 1e5, 1e8]) for (const gainDb of [0, 20, 60]) {
      const m = amplifier(a0Db, gbw, gainDb);
      const dc = response(m, 0), pole = response(m, m.pole), bw = response(m, m.closedBw);
      expect(m.closedDc * m.closedBw / gbw).toBeCloseTo(1, 12);
      expect(m.closedBw).toBeCloseTo(m.pole + m.beta * gbw, 6);
      expect(1 - m.closedDc / m.idealGain).toBeCloseTo(m.relativeError, 12);
      expect(pole.openDb - dc.openDb).toBeCloseTo(-10 * Math.log10(2), 10);
      expect(bw.closedDb - dc.closedDb).toBeCloseTo(-10 * Math.log10(2), 10);
      expect(pole.openPhase).toBeCloseTo(-45, 12);
      expect(bw.closedPhase).toBeCloseTo(-45, 12);
      expect(response(m, m.unity!).openDb).toBeCloseTo(0, 10);
      if (m.crossover !== null) expect(response(m, m.crossover).loopDb).toBeCloseTo(0, 10);
      const hf = response(m, gbw * 1e6), decade = response(m, gbw * 1e7);
      expect(decade.closedDb - hf.closedDb).toBeCloseTo(-20, 6);
      expect(hf.closedPhase).toBeCloseTo(-90, 2);
      expect(hf.closedDb).toBeCloseTo(hf.openDb, 6);
    }
  });

  it('does not invent a positive-frequency crossover when the DC loop gain is at or below unity', () => {
    expect(amplifier(20, 1e5, 40).crossover).toBeNull();
    expect(amplifier(20, 1e5, 20).crossover).toBeNull();
    const m = amplifier(20, 1e5, 20);
    expect(m.closedDc).toBe(5);
    expect(m.relativeError).toBe(.5);
    expect(amplifier(0, 1e5, 0).unity).toBeNull();
  });

  it('raises actual gain and lowers bandwidth when the requested gain rises', () => {
    const low = amplifier(80, 1e5, 20), high = amplifier(80, 1e5, 40);
    expect(high.closedDc).toBeGreaterThan(low.closedDc);
    expect(high.closedBw).toBeLessThan(low.closedBw);
    expect(high.relativeError).toBeGreaterThan(low.relativeError);
  });

  it('rejects undefined inputs rather than drawing a NaN curve', () => {
    expect(() => amplifier(60, 0, 20)).toThrow(RangeError);
    expect(() => amplifier(NaN, 1e5, 20)).toThrow(RangeError);
    expect(() => amplifier(60, 1e5, -20)).toThrow(RangeError);
    expect(() => response(amplifier(60, 1e5, 20), -1)).toThrow(RangeError);
  });

  it('publishes the lesson in the circuit category with its own thumbnail', () => {
    const path = '/amplifiers/open-loop-and-closed-loop/';
    expect(isLessonPath(path)).toBe(true);
    expect(isPublicLessonPath(path)).toBe(true);
    expect(featuredLessons.find((x) => x.href === path)).toMatchObject({ category: 'Circuits & Systems', thumb: 'amplifier' });
  });
});
