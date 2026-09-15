import { describe, expect, it } from 'vitest';
import { analyze, bwMaxFor, closedLoopMag, loopFor, simulate } from '../src/illustrations/pll/model';

// Reference values from python/pll_int_vs_frac.py (40 MHz reference, 1 MHz loop, target 5.005 GHz).
describe('integer-N vs fractional-N PLL model', () => {
  const target = 5.005e9, fRef = 40e6, bw = 1e6;

  it('sets the closed-loop −3 dB bandwidth exactly over the whole range', () => {
    for (const f of [25e6, 40e6, 100e6]) {
      for (const b of [100e3, 1e6, bwMaxFor(f)]) {
        const { gp, beta } = loopFor(f, b);
        expect(closedLoopMag(b, gp, beta, f)).toBeCloseTo(Math.SQRT1_2, 6);
      }
    }
  });

  it('matches the Python reference for all four dividers', () => {
    const intA = analyze(simulate(target, 'int', 0, fRef, bw));
    const acc = analyze(simulate(target, 'acc', 0, fRef, bw));
    const sd = analyze(simulate(target, 'sd', 0, fRef, bw));
    const dtc = analyze(simulate(target, 'dtc', 0, fRef, bw));
    expect(intA.jitterFs).toBeGreaterThan(187.5 * 0.95);
    expect(intA.jitterFs).toBeLessThan(187.5 * 1.05);
    expect(intA.spurs).toHaveLength(0);
    expect(acc.spurs[0].f).toBeCloseTo(5e6, -3);
    expect(acc.spurs[0].dBc).toBeCloseTo(-20.5, 0);
    expect(sd.jitterFs / 2603.5).toBeGreaterThan(0.95);
    expect(sd.jitterFs / 2603.5).toBeLessThan(1.05);
    expect(Math.abs(dtc.jitterFs / intA.jitterFs - 1)).toBeLessThan(0.02);
  });

  it('locks the fractional loop exactly on target and the integer loop on the nearest channel', () => {
    expect(simulate(target, 'sd', 0, fRef, bw).fOut).toBeCloseTo(target, -2);
    expect(simulate(target, 'int', 0, fRef, bw).fOut).toBe(5e9);
  });
});
