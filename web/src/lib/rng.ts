/** Deterministic uniform generator (mulberry32). */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** n standard-normal samples from a fixed seed (Box–Muller). */
export function gaussians(n: number, seed: number): Float64Array {
  const rnd = mulberry32(seed);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i += 2) {
    const u1 = rnd() || 1e-12;
    const u2 = rnd();
    const r = Math.sqrt(-2 * Math.log(u1));
    out[i] = r * Math.cos(2 * Math.PI * u2);
    if (i + 1 < n) out[i + 1] = r * Math.sin(2 * Math.PI * u2);
  }
  return out;
}

/** n uniform samples in [0, 1) from a fixed seed. */
export function uniforms(n: number, seed: number): Float64Array {
  const rnd = mulberry32(seed);
  return Float64Array.from({ length: n }, () => rnd());
}
