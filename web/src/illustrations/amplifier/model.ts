/** A single-pole, small-signal amplifier with real, frequency-independent negative feedback. */
export interface Amplifier {
  a0: number;
  gbw: number;
  beta: number;
  idealGain: number;
  pole: number;
  loopDc: number;
  closedDc: number;
  closedBw: number;
  relativeError: number;
  unity: number | null;
  crossover: number | null;
}

export function amplifier(a0Db: number, gbw: number, gainDb: number): Amplifier {
  if (![a0Db, gbw, gainDb].every(Number.isFinite) || a0Db < 0 || a0Db > 200 || gbw <= 0 || gainDb < 0 || gainDb > 200) {
    throw new RangeError('Use finite nonnegative gains up to 200 dB and a positive GBW in Hz.');
  }
  const a0 = 10 ** (a0Db / 20), idealGain = 10 ** (gainDb / 20);
  const beta = 1 / idealGain, pole = gbw / a0, loopDc = beta * a0;
  return {
    a0, gbw, beta, idealGain, pole, loopDc,
    closedDc: a0 / (1 + loopDc),
    closedBw: pole * (1 + loopDc),
    relativeError: 1 / (1 + loopDc),
    unity: a0 > 1 ? pole * Math.sqrt(a0 * a0 - 1) : null,
    crossover: loopDc > 1 ? pole * Math.sqrt(loopDc * loopDc - 1) : null,
  };
}

export interface Response {
  openDb: number;
  loopDb: number;
  closedDb: number;
  openPhase: number;
  closedPhase: number;
}

export function response(m: Amplifier, f: number): Response {
  if (!Number.isFinite(f) || f < 0) throw new RangeError('Frequency must be finite and nonnegative.');
  const r = f / m.pole, feedback = 1 + m.loopDc;
  // T = A / (1 + beta*A) = A0 / (1 + beta*A0 + j*f/fp).
  // This uses the complex denominator, never |A| / (1 + beta*|A|).
  return {
    openDb: 20 * Math.log10(m.a0 / Math.hypot(1, r)),
    loopDb: 20 * Math.log10(m.loopDc / Math.hypot(1, r)),
    closedDb: 20 * Math.log10(m.a0 / Math.hypot(feedback, r)),
    openPhase: -Math.atan2(r, 1) * 180 / Math.PI,
    closedPhase: -Math.atan2(r, feedback) * 180 / Math.PI,
  };
}

/** Compact labels with enough precision to distinguish 10.010 kHz from 10.100 kHz. */
export function frequency(f: number, significant = 5): string {
  const scale = f >= 1e9 ? 1e9 : f >= 1e6 ? 1e6 : f >= 1e3 ? 1e3 : 1;
  const unit = scale === 1e9 ? 'GHz' : scale === 1e6 ? 'MHz' : scale === 1e3 ? 'kHz' : 'Hz';
  return `${Number((f / scale).toPrecision(significant))} ${unit}`;
}
