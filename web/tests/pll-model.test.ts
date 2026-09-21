import { describe, expect, it } from 'vitest';
import { analyze, bwMaxFor, closedLoopMag, dividerSequence, loopFor, simulate } from '../src/illustrations/pll/model';

// Reference values from python/pll_int_vs_frac.py (40 MHz reference, 1 MHz loop, target 5.005 GHz).
describe('integer-N vs fractional-N PLL model', () => {
  const target = 5.005e9, fRef = 40e6, bw = 1e6;

  type Complex = [number, number];
  const add = (a: Complex, b: Complex): Complex => [a[0] + b[0], a[1] + b[1]];
  const scale = (a: Complex, k: number): Complex => [a[0] * k, a[1] * k];

  /** Drive the actual sequential state update with a complex sinusoid; this does not reuse the transfer formula. */
  function stateMagnitude(f: number, gp: number, beta: number, ref: number): number {
    const n = Math.round(5e9 / ref), kp = gp / n, ki = gp * gp / (4 * n), w = 2 * Math.PI * f / ref;
    let integral: Complex = [0, 0], p1: Complex = [0, 0], p2: Complex = [0, 0], x: Complex = [0, 0];
    let drive: Complex = [1, 0];
    const turn: Complex = [Math.cos(w), Math.sin(w)];
    for (let k = 0; k < 12000; k++) {
      const error = add(x, drive);
      integral = add(integral, scale(error, ki));
      p1 = add(p1, scale(add(add(scale(error, kp), integral), scale(p1, -1)), beta));
      p2 = add(p2, scale(add(p1, scale(p2, -1)), beta));
      x = add(x, scale(p2, -n));
      drive = [drive[0] * turn[0] - drive[1] * turn[1], drive[0] * turn[1] + drive[1] * turn[0]];
    }
    return Math.hypot(x[0], x[1]);
  }

  it('sets the closed-loop −3 dB bandwidth exactly over the whole range', () => {
    for (const f of [25e6, 40e6, 100e6]) {
      for (const b of [100e3, 1e6, bwMaxFor(f)]) {
        const { gp, beta } = loopFor(f, b);
        expect(closedLoopMag(b, gp, beta, f)).toBeCloseTo(Math.SQRT1_2, 6);
      }
    }
  });

  it('matches an independent sinusoidal solution of the sequential loop states and remains stable', () => {
    for (const ref of [25e6, 40e6, 100e6]) {
      const { gp, beta } = loopFor(ref, bw);
      for (const f of [100e3, 1e6, 0.2 * ref]) {
        expect(stateMagnitude(f, gp, beta, ref)).toBeCloseTo(closedLoopMag(f, gp, beta, ref), 9);
      }
    }
  });

  it('implements the accumulator as first order and MASH 1-1-1 as third order', () => {
    for (const alpha of [0.01, 0.125, 0.2875, 0.49]) {
      const acc = dividerSequence(alpha, 'acc', 65536);
      const mash = dividerSequence(alpha, 'sd', 65536);
      const mean = (a: Int8Array) => a.reduce((sum, v) => sum + v, 0) / a.length;
      expect(new Set(acc.y)).toEqual(new Set([0, 1]));
      expect(Math.abs(mean(acc.y) - acc.alpha)).toBeLessThan(1 / acc.y.length);
      expect(Math.abs(mean(mash.y) - mash.alpha)).toBeLessThan(4 / mash.y.length);
      expect(Math.min(...mash.y)).toBeLessThan(0);
      expect(Math.max(...mash.y)).toBeGreaterThan(1);
      expect(Math.min(...acc.phase)).toBeGreaterThanOrEqual(-1);
      expect(Math.max(...acc.phase)).toBeLessThanOrEqual(1);
      expect(Math.max(...mash.phase.map(Math.abs))).toBeLessThanOrEqual(4);
    }
  });

  it('matches the Python reference for all four dividers', () => {
    const intA = analyze(simulate(target, 'int', false, 0, fRef, bw));
    const acc = analyze(simulate(target, 'acc', false, 0, fRef, bw));
    const sd = analyze(simulate(target, 'sd', false, 0, fRef, bw));
    const dtc = analyze(simulate(target, 'sd', true, 0, fRef, bw));
    expect(intA.jitterFs).toBeGreaterThan(187.5 * 0.95);
    expect(intA.jitterFs).toBeLessThan(187.5 * 1.05);
    expect(intA.spurs).toHaveLength(0);
    expect(acc.spurs[0].f).toBeCloseTo(5e6, -3);
    expect(acc.spurs[0].dBc).toBeCloseTo(-20.5, 0);
    expect(sd.jitterFs / 2681.7).toBeGreaterThan(0.98);
    expect(sd.jitterFs / 2681.7).toBeLessThan(1.02);
    // alpha = 1/8 is rational and this MASH is not dithered, so its deterministic period produces tones.
    expect(sd.spurs.length).toBeGreaterThan(0);
    expect(Math.abs(dtc.jitterFs / intA.jitterFs - 1)).toBeLessThan(0.02);
  });

  // Charge-pump up/down mismatch folds the shaped quantisation noise into a spur at the fractional offset.
  it('turns charge-pump mismatch into a fractional spur, at a near-integer channel', () => {
    const near = 5.0005e9, offset = 5e5;
    expect(analyze(simulate(near, 'sd', false, 0, fRef, bw, 0)).spurs).toHaveLength(0);
    const mismatched = analyze(simulate(near, 'sd', false, 0, fRef, bw, 0.05));
    expect(mismatched.spurs[0].f).toBeCloseTo(offset, -3);
    expect(mismatched.spurs[0].dBc).toBeCloseTo(-46.5, 0);
    expect(mismatched.jitterFs / 2693.8).toBeGreaterThan(0.95);
    expect(mismatched.jitterFs / 2693.8).toBeLessThan(1.05);
    // the accumulator spur is set by the ramp, not by the pump; the DTC cancels the ramp, so nothing folds
    const acc = analyze(simulate(near, 'acc', false, 0, fRef, bw, 0.05));
    // Large modulation suppresses the actual carrier by ~17 dB: the sideband can exceed it.
    expect(acc.carrierPower).toBeLessThan(0.025);
    expect(acc.spurs[0].dBc).toBeCloseTo(12.5, 0);
    expect(analyze(simulate(near, 'sd', true, 0, fRef, bw, 0.05)).spurs).toHaveLength(0);
  });

  // The DTC cancels the phase error the divider builds up, so what is left is its own INL, shaped like the code driving it.
  it('models DTC INL for accumulator and undithered MASH sequences', () => {
    const near = 5.0005e9, offset = 5e5;
    expect(analyze(simulate(near, 'acc', true, 0, fRef, bw)).spurs).toHaveLength(0);
    // the accumulator drives the DTC with a sawtooth that repeats every 1/alpha cycles: spurs at alpha * f_ref and above
    const spurs = [0.5, 1, 2, 5].map((inl) => analyze(simulate(near, 'acc', true, inl, fRef, bw)).spurs);
    expect(spurs.map((s) => s[0].dBc)).toEqual([-49.4, -43.4, -37.4, -29.4].map((v) => expect.closeTo(v, 0)));
    for (const s of spurs) expect(s[0].f).toBeCloseTo(offset, -3);
    expect(spurs[3].slice(0, 3).map((p) => Math.round(p.f / offset))).toEqual([1, 2, 3]);
    // 20 dB per decade of INL
    for (const [i, inl] of [1, 2, 5].entries()) expect(spurs[i + 1][0].dBc - spurs[0][0].dBc).toBeCloseTo(20 * Math.log10(inl / 0.5), 0);
    // This deterministic MASH sequence has no detected line above the model's spur threshold for these settings.
    for (const inl of [1, 5]) expect(analyze(simulate(near, 'sd', true, inl, fRef, bw)).spurs).toHaveLength(0);
    expect(analyze(simulate(near, 'sd', true, 5, fRef, bw)).jitterFs / 339).toBeCloseTo(1, 1);
  });

  it('locks the fractional loop exactly on target and the integer loop on the nearest channel', () => {
    expect(simulate(target, 'sd', false, 0, fRef, bw).fOut).toBeCloseTo(target, -2);
    expect(simulate(target, 'int', false, 0, fRef, bw).fOut).toBe(5e9);
  });
});
