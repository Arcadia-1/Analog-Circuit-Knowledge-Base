/** Shared geometry for the FFT and contribution map so every frequency lands on the same vertical line. */
export function frequencyAxis(width: number, fs: number, points: number) {
  const compact = width < 520;
  const x0 = compact ? 94 : 185;
  const x1 = width - (compact ? 70 : 120);
  const half = Math.floor(points / 2);
  const binOf = (frequency: number) => Math.max(0, Math.min(half, Math.round((frequency / fs) * points)));
  const sx = (bin: number) => x0 + (bin / half) * (x1 - x0);
  const steps = x1 - x0 < 360 ? 2 : 4;
  const ticks = Array.from({ length: steps + 1 }, (_, i) => {
    const bin = (i / steps) * half;
    return { bin, frequency: (bin / points) * fs };
  });
  return { compact, x0, x1, half, binOf, sx, ticks };
}
