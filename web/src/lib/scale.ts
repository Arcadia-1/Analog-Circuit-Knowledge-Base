/** Smallest 1·2·5 decade value that is at least `raw`. */
export function niceStep(raw: number): number {
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * p).find((v) => v >= raw) ?? 10 * p;
}

export const linear = (d0: number, d1: number, r0: number, r1: number) => (v: number): number =>
  r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);

export const log10Scale = (f0: number, f1: number, r0: number, r1: number) => {
  const l0 = Math.log10(f0), l1 = Math.log10(f1);
  return (f: number): number => r0 + ((Math.log10(f) - l0) / (l1 - l0)) * (r1 - r0);
};

/** Symmetric log in base 2 around zero: symlog(r) = sign(r) · log2(1 + |r|). */
export const symlog = (r: number): number => Math.sign(r) * Math.log2(1 + Math.abs(r));
export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
