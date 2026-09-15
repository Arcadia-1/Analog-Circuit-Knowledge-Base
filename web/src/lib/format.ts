/** Number with a typographic minus sign. */
export const nf = (v: number, digits: number): string => v.toFixed(digits).replace('-', '−');

const trimZeros = (s: string): string => s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');

/** Frequency with an SI prefix, trailing zeros removed: 1.2 MHz, 20 MHz, 3.05 kHz. */
export function freqText(f: number): string {
  const a = Math.abs(f);
  if (a >= 1e9) return `${trimZeros((a / 1e9).toFixed(4))} GHz`;
  if (a >= 1e6) return `${trimZeros((a / 1e6).toFixed(a >= 1e7 ? 1 : 2))} MHz`;
  if (a >= 1e3) return `${trimZeros((a / 1e3).toFixed(a >= 1e5 ? 0 : 1))} kHz`;
  return `${a.toFixed(0)} Hz`;
}

/** Time jitter: femtoseconds below 1 ps, picoseconds above. */
export const jitterText = (fs: number): string =>
  fs >= 1e3 ? `${nf(fs / 1e3, fs >= 1e4 ? 1 : 2)} ps` : `${nf(fs, 0)} fs`;
