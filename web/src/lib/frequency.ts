/**
 * ADCToolbox 0.9.1 fundamentals/frequency: where a frequency lands after sampling, and the coherent tone to test with.
 * Shared by the converter pages; their python/ scripts check these against ADCToolbox itself.
 */

/** fold_frequency_to_nyquist: how far f is from the nearest multiple of fs, which is where it lands, 0 … fs/2. */
export const foldFrequency = (f: number, fs: number): number => Math.abs(residual(f, fs));

/** The same distance with its sign: negative when f lands mirrored, and a tone's phase then runs backwards. */
export const residual = (f: number, fs: number): number => f - fs * Math.round(f / fs);

/** fold_bin_to_nyquist: a bin of an n-point record, wrapped into the record and mirrored into 0 … n/2. */
export function foldBin(bin: number, n: number): number {
  const b = ((bin % n) + n) % n;
  return b > Math.floor(n / 2) ? n - b : b;
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/**
 * find_coherent_frequency, policy 'adc_odd': the odd bin, coprime with the record length, nearest the target, and the
 * frequency it stands for. Undersampling is allowed, so the bin may lie far above the record's Nyquist.
 */
export function coherentFrequency(fs: number, target: number, nFft: number, radius = 200): { fin: number; bin: number } {
  const ideal = (target / fs) * nFft, center = Math.round(ideal);
  let bin = 0, best = Infinity;
  for (let b = center - radius; b <= center + radius; b++) {
    if (b <= 0 || b % 2 === 0 || gcd(b, nFft) !== 1) continue;
    if (Math.abs(b - ideal) < best) {
      best = Math.abs(b - ideal);
      bin = b;
    }
  }
  if (!bin) throw new Error(`no odd coprime bin near ${ideal.toFixed(2)} cycles`);
  return { fin: (bin * fs) / nFft, bin };
}
