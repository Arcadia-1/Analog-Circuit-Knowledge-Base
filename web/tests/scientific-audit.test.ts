import { describe, expect, it } from 'vitest';
import { gaussians } from '../src/lib/rng';
import { analyzeSpectrum } from '../src/lib/spectrum';
import { foldFrequency } from '../src/lib/frequency';
import { read as aliasing, floorOf, KEEP } from '../src/illustrations/aliasing/model';
import { decompose, spectrumPolar, FIN_BIN, analyze as panel, CLEAN_IMPAIRMENTS } from '../src/illustrations/analog-panel/model';
import { binaryWeights, redundantWeights, convert, reconstruct, type Trial } from '../src/illustrations/sar/model';
import { read, mismatch, outputSpectrum, outputSpurs, physicalParams, predictSpurs, FS, AMP } from '../src/illustrations/timeinterleave/model';
import { analyze, dividerSequence, simulate, type Sim } from '../src/illustrations/pll/model';

/** Analytical or independent signal identities, not snapshots copied from the implementation. */
describe('scientific audit: public lessons', () => {
  it('uses full-scale sine power consistently with Parseval', () => {
    const x = Float64Array.from({ length: 4096 }, (_, i) => 2048 + 1024 * Math.cos(2 * Math.PI * 113 * i / 4096));
    const s = analyzeSpectrum(x, 12);
    expect(s.dbfs[113]).toBeCloseTo(20 * Math.log10(0.5), 10);
    expect(s.dbfs.reduce((sum, db) => sum + 10 ** (db / 10), 0)).toBeCloseTo(0.25, 10);
  });

  it('folds aliasing harmonics correctly without changing the fixed-size output noise floor', () => {
    const readings = KEEP.map((factor) => aliasing(1.23e9, factor, -120, -120));
    for (const [i, r] of readings.entries()) {
      expect(r.after.dbfs).toHaveLength(2049);
      for (const tone of r.landings) {
        const f = tone.order * r.fin / r.fsOut;
        expect(tone.lands / r.fsOut).toBeCloseTo(Math.abs(f - Math.round(f)), 12);
      }
      expect(Math.abs(floorOf(r.after) - floorOf(readings[0].after))).toBeLessThan(0.4);
      expect(Math.abs(floorOf(r.after) - floorOf(r.before) - 10 * Math.log10(KEEP[i]))).toBeLessThan(0.4);
    }
  });

  it('implements ideal SAR rounding and saturation for both arrays', () => {
    for (const w of [binaryWeights(8), redundantWeights(8)]) {
      const decisions = new Uint8Array(w.length);
      for (let x = 0.125; x < 256; x += 0.25) {
        convert(x, w, null, decisions);
        expect(reconstruct(decisions, w)[0]).toBe(Math.min(255, Math.round(x)));
      }
    }
  });

  it('does not confuse analog DAC error with an impossibility of digital correction', () => {
    // Bit 01 covers [0.5, 2.3). Its optimal digital level is 1.4, giving <= 0.9 LSB error.
    const w = [2.8, 1], decisions = new Uint8Array(2), trace: Trial[] = [];
    convert(2.125, w, null, decisions, trace);
    expect([...decisions]).toEqual([0, 1]);
    expect(Math.abs(reconstruct(decisions, w)[0] - 2.125)).toBeGreaterThan(1);
    expect(Math.abs(reconstruct(decisions, [2.8, 1.4])[0] - 2.125)).toBeLessThan(1);
    expect(trace.at(-1)?.lo).toBe(0);
    expect(trace.at(-1)?.hi).toBe(2);
  });

  it.each([2, 3, 4, 5])('recovers the physical relative cosine phase of H%i, including mirrored harmonics', (h) => {
    const phase1 = 0.37, phaseH = 0.81, n = 4096;
    const y = Float64Array.from({ length: n }, (_, i) => 2048 + 1000 * Math.cos(2 * Math.PI * FIN_BIN * i / n + phase1)
      + 10 * Math.cos(2 * Math.PI * h * FIN_BIN * i / n + phaseH));
    const d = decompose(y), p = spectrumPolar(y, analyzeSpectrum(y, 12));
    expect(d.phases[h - 1]).toBeCloseTo(phaseH - h * phase1, 9);
    expect(p.rays[h - 1].angle).toBeCloseTo(phaseH - h * phase1, 9);
    expect(d.magnitudesDb[h - 1]).toBeCloseTo(-40, 9);
  });

  it('does not report a synthetic startup transient when all panel errors are disabled', () => {
    expect(panel(CLEAN_IMPAIRMENTS, 12).fit.rmse).toBeLessThan(1e-8);
  });

  it.each([3, 5, 17])('keeps a clean 12-bit converter near 69 dB SNDR after decimation by %i', (factor) => {
    const r = read(4, 100e6, mismatch(4, 0, 0, 0), 12, 'off', { decimation: factor });
    // A = 0.4 V; independent quantization (LSB²/12) + thermal noise (0.3 LSB)².
    const expected = 10 * Math.log10(0.4 ** 2 / 2 / ((1 / 12 + 0.3 ** 2) / 4096 ** 2));
    expect(Math.abs(r.raw.sndr - expected)).toBeLessThan(0.6);
    expect(r.coherent).toBe(true);
    expect(r.fftPoints).toBe(4096);
    expect(r.metricsResolved).toBe(true);
  });

  it('measures a known -60 dBc noncoherent spur after subtracting the carrier', () => {
    const f = 0.17321;
    const x = Float64Array.from({ length: 1366 }, (_, i) => 0.1 + 0.4 * Math.cos(2 * Math.PI * f * i + 0.2)
      + 0.0004 * Math.cos(2 * Math.PI * 2 * f * i + 0.7));
    const s = outputSpectrum(x, 16, f, false);
    expect(s.sndr).toBeCloseTo(60, 1);
    expect(s.sfdr).toBeCloseTo(60, 1);
    expect(read(4, 100e6, mismatch(4, 0, 0, 0), 12, 'off', { decimation: 255 }).metricsResolved).toBe(true);
  });

  it.each([1, 2, 3, 4, 5, 8])('predicts the spectrum of the actual visited channel sequence at decimation %i', (factor) => {
    const m = 8, n = 4096, fin = 73 * FS / (n * factor), mm = mismatch(m, 0.03, 0.002, 1e-11);
    const x = Float64Array.from({ length: n }, (_, i) => {
      const c = (i * factor) % m;
      return AMP * mm.gain[c] * Math.cos(2 * Math.PI * fin * (i * factor / FS + mm.skew[c])) + mm.offset[c];
    });
    const s = analyzeSpectrum(x.map((v) => v * 65536), 16);
    const predictions = outputSpurs(physicalParams(mm, fin, FS), FS, factor);
    if (factor === m) expect(predictions).toHaveLength(0);
    for (const spur of predictions) {
      const bin = Math.round(spur.freq / (FS / factor) * n);
      expect(s.dbfs[bin]).toBeCloseTo(spur.dbfs, 7);
      expect(s.dbfs[bin] - s.dbfs[s.signal]).toBeCloseTo(spur.dbc, 7);
      expect(spur.freq).toBeCloseTo(foldFrequency(spur.freq, FS / factor), 5);
    }
  });

  it.each([1, 3, 5, 15, 16])('supports an integer channel count of %i', (m) => {
    const mm = mismatch(m, 0.01, 0.001, 2e-12, 0.02);
    expect(mm.gain).toHaveLength(m);
    expect(mm.offset).toHaveLength(m);
    expect(mm.skew).toHaveLength(m);
    expect(mm.bandwidth).toHaveLength(m);
    for (const values of [mm.gain.map((v) => v - 1), mm.offset, mm.skew, mm.bandwidth!]) {
      const mean = values.reduce((sum, value) => sum + value, 0) / m;
      expect(Math.abs(mean)).toBeLessThan(1e-15);
    }
    const p = physicalParams(mm, 101e6, FS);
    const spurs = outputSpurs(p, FS);
    expect(spurs.every((spur) => Number.isFinite(spur.freq) && Number.isFinite(spur.dbc))).toBe(true);
  });

  it.each([3, 5, 15])('matches a direct DFT for an odd %i-channel mismatch pattern', (m) => {
    const fin = 101e6;
    const offset = Float64Array.from({ length: m }, (_, c) => 0.001 * Math.cos(2 * Math.PI * 2 * c / m + 0.2));
    const gain = Float64Array.from({ length: m }, (_, c) => 1 + 0.01 * Math.sin(2 * Math.PI * c / m + 0.4));
    const skew = Float64Array.from({ length: m }, (_, c) => 2e-12 * Math.cos(2 * Math.PI * 2 * c / m - 0.3));
    const spurs = predictSpurs({ fin, amp: AMP, gain, offset, skew }, FS, 0.5);
    const magnitude = (re: Float64Array, im: Float64Array, k: number) => {
      let real = 0, imaginary = 0;
      for (let c = 0; c < m; c++) {
        const phase = 2 * Math.PI * k * c / m;
        real += re[c] * Math.cos(phase) + im[c] * Math.sin(phase);
        imaginary += im[c] * Math.cos(phase) - re[c] * Math.sin(phase);
      }
      return Math.hypot(real, imaginary);
    };
    const complexGain = gain.map((value, c) => value * Math.cos(2 * Math.PI * fin * skew[c]));
    const complexPhase = gain.map((value, c) => value * Math.sin(2 * Math.PI * fin * skew[c]));
    expect(spurs).toHaveLength(Math.floor(m / 2) + m - 1);
    for (const spur of spurs) {
      const expected = spur.kind === 'offset'
        ? magnitude(offset, new Float64Array(m), spur.k) / m * (2 * spur.k === m ? 1 : 2)
        : AMP * magnitude(complexGain, complexPhase, spur.k) / m;
      expect(spur.amp).toBeCloseTo(expected, 12);
    }
  });

  it.each([0.005, 0.125, 0.2875, 0.495])('verifies divider order using closed-form accumulator remainders at alpha %f', (alpha) => {
    const modulus = 2n ** 24n, word = BigInt(Math.round(alpha * Number(modulus)));
    const acc = dividerSequence(alpha, 'acc', 1024), mash = dividerSequence(alpha, 'sd', 1024);
    const errors = [0, 0, 0];
    for (let k = 0; k < 1024; k++) {
      const t = BigInt(k + 1);
      // Cascaded sums: r3[k] = FCW * (k+1)(k+2)(k+3)/6 mod 2^24, independently of the carry recurrence.
      const e = -Number((word * t * (t + 1n) * (t + 2n) / 6n) % modulus) / Number(modulus);
      expect(mash.y[k] - mash.alpha).toBe(e - 3 * errors[0] + 3 * errors[1] - errors[2]);
      expect(mash.phase[k]).toBe(e - 2 * errors[0] + errors[1]);
      expect(acc.phase[k]).toBeCloseTo(-Number(word * t % modulus) / Number(modulus), 14);
      errors.unshift(e); errors.pop();
    }
  });

  it('normalizes PLL sidebands to the carrier using the Bessel solution of sinusoidal phase modulation', () => {
    // exp(j beta cos(wt)): carrier J0(beta), first sideband J1(beta).
    const bessel = (order: number, x: number) => {
      let term = order ? x / 2 : 1, sum = term;
      for (let k = 1; k < 25; k++) { term *= -x * x / (4 * k * (k + order)); sum += term; }
      return sum;
    };
    const beta = 0.8, n = 32768, fRef = 40e6, tOut = 1 / 5e9, bin = 512;
    const sim = { fRef, tOut, x: Float64Array.from({ length: n }, (_, i) => beta * Math.cos(2 * Math.PI * bin * i / n) * tOut / (2 * Math.PI)) } as Sim;
    const a = analyze(sim), j0 = bessel(0, beta), j1 = bessel(1, beta);
    expect(a.carrierPower).toBeCloseTo(j0 ** 2, 6);
    expect(a.spurs.find((s) => s.f === bin * fRef / n)?.dBc).toBeCloseTo(20 * Math.log10(j1 / j0), 4);
    expect(a.jitterFs).toBeCloseTo(beta * tOut / (2 * Math.PI * Math.SQRT2) * 1e15, 1);
  });

  it('uses SSB phase-noise density, without a factor-of-two normalization error', () => {
    const fRef = 40e6, tOut = 1 / 5e9, sigma = 1e-13;
    const a = analyze({ fRef, tOut, x: gaussians(32768, 137).map((v) => v * sigma) } as Sim);
    const band = a.curve.filter((p) => p.f > 1e6 && p.f < 1e7);
    const density = band.reduce((sum, p) => sum + 10 ** (p.L / 10), 0) / band.length;
    const expected = (2 * Math.PI * sigma / tOut) ** 2 / fRef;
    expect(Math.abs(10 * Math.log10(density / expected))).toBeLessThan(0.4);
  });

  it('bounds fractional frequency rounding by half of a 24-bit step', () => {
    for (const fRef of [25e6, 40e6, 100e6]) {
      const target = 5.0123e9;
      const r = simulate(target, 'sd', false, 0, fRef, 1e6);
      expect(Math.abs(r.fOut - target)).toBeLessThanOrEqual(fRef / 2 ** 25 + 1e-5);
    }
  });
});
