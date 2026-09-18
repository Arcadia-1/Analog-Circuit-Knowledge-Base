/** How numpy does the small things, where the pages have to agree with it to the last digit. */

/**
 * np.sum of a float array: pairwise, in blocks of up to 128 that are themselves summed through eight running totals,
 * which is not the order a plain loop adds in, and differs from it in the last bit.
 */
export function npSum(a: ArrayLike<number>, start = 0, end = a.length): number {
  const n = end - start;
  if (n < 8) {
    let s = 0;
    for (let i = start; i < end; i++) s += a[i];
    return s;
  }
  if (n <= 128) {
    const r = [0, 1, 2, 3, 4, 5, 6, 7].map((j) => a[start + j]);
    let i = 8;
    for (; i < n - (n % 8); i += 8) for (let j = 0; j < 8; j++) r[j] += a[start + i + j];
    let s = r[0] + r[1] + (r[2] + r[3]) + (r[4] + r[5] + (r[6] + r[7]));
    for (; i < n; i++) s += a[start + i];
    return s;
  }
  let half = n >> 1;
  half -= half % 8;
  return npSum(a, start, start + half) + npSum(a, start + half, end);
}

/** np.round and Python's round: halves go to the even neighbour. */
export function roundEven(v: number): number {
  const r = Math.round(v);
  return Math.abs(v % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

/** Gaussian elimination with partial pivoting. */
export function solve(m: number[][], r: number[]): number[] {
  const k = r.length, a = m.map((row, i) => [...row, r[i]]);
  for (let i = 0; i < k; i++) {
    let p = i;
    for (let j = i + 1; j < k; j++) if (Math.abs(a[j][i]) > Math.abs(a[p][i])) p = j;
    [a[i], a[p]] = [a[p], a[i]];
    for (let j = i + 1; j < k; j++) {
      const f = a[j][i] / a[i][i];
      for (let c = i; c <= k; c++) a[j][c] -= f * a[i][c];
    }
  }
  const x = new Array<number>(k).fill(0);
  for (let i = k - 1; i >= 0; i--) {
    let s = a[i][k];
    for (let j = i + 1; j < k; j++) s -= a[i][j] * x[j];
    x[i] = s / a[i][i];
  }
  return x;
}
