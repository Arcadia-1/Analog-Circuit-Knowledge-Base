/** A stable, unity-DC-gain system with two independently placed real poles. */
export interface TwoPoleModel {
  f1: number;
  f2: number;
  omega1: number;
  omega2: number;
  slowFrequency: number;
  fastFrequency: number;
  slowRate: number;
  fastRate: number;
  ratio: number;
}

export interface StepMetrics {
  t10: number;
  t90: number;
  riseTime: number;
  settlingTime: number;
}

/** H(s) = 1 / [(1 + s/w1)(1 + s/w2)], with pole frequencies expressed in hertz. */
export function twoPoleModel(f1: number, f2: number): TwoPoleModel {
  if (![f1, f2].every(Number.isFinite) || f1 <= 0 || f2 <= 0) {
    throw new RangeError('Both pole frequencies must be finite and positive.');
  }
  const omega1 = 2 * Math.PI * f1, omega2 = 2 * Math.PI * f2;
  const slowFrequency = Math.min(f1, f2), fastFrequency = Math.max(f1, f2);
  return {
    f1, f2, omega1, omega2,
    slowFrequency,
    fastFrequency,
    slowRate: 2 * Math.PI * slowFrequency,
    fastRate: 2 * Math.PI * fastFrequency,
    ratio: fastFrequency / slowFrequency,
  };
}

/** Exact unit-step response. The expm1 form remains well conditioned as the two poles approach each other. */
export function stepResponse(model: TwoPoleModel, time: number): number {
  if (!Number.isFinite(time) || time < 0) throw new RangeError('Time must be finite and nonnegative.');
  const a = model.slowRate, b = model.fastRate, delta = b - a;
  const tail = delta === 0
    ? Math.exp(-a * time) * (1 + a * time)
    : Math.exp(-a * time) * (1 + a * -Math.expm1(-delta * time) / delta);
  return Math.max(0, Math.min(1, 1 - tail));
}

/** Time at which the monotonic response first reaches a fraction of its final value. */
export function crossingTime(model: TwoPoleModel, level: number): number {
  if (!Number.isFinite(level) || level <= 0 || level >= 1) throw new RangeError('Use a level strictly between zero and one.');
  let low = 0, high = 1 / model.slowRate;
  while (stepResponse(model, high) < level) high *= 2;
  for (let i = 0; i < 64; i++) {
    const mid = (low + high) / 2;
    if (stepResponse(model, mid) < level) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

export function stepMetrics(model: TwoPoleModel): StepMetrics {
  const t10 = crossingTime(model, 0.1), t90 = crossingTime(model, 0.9);
  return { t10, t90, riseTime: t90 - t10, settlingTime: crossingTime(model, 0.98) };
}

export function formatTime(seconds: number, significant = 4): string {
  if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError('Time must be finite and nonnegative.');
  const scale = seconds >= 1 ? 1 : seconds >= 1e-3 ? 1e-3 : seconds >= 1e-6 ? 1e-6 : 1e-9;
  const unit = scale === 1 ? 's' : scale === 1e-3 ? 'ms' : scale === 1e-6 ? 'µs' : 'ns';
  return `${Number((seconds / scale).toPrecision(significant))} ${unit}`;
}
