/**
 * ADCToolbox 0.9.1 calibration/calibrate_weight_sine, the way the pages use it: one capture, a known frequency and the
 * fundamental only. Shared by the SAR pages; their python/ scripts check it against ADCToolbox itself.
 */

/** Solve the symmetric positive-definite system G x = h (Cholesky, G stored row-major k × k). */
function solveSpd(G: Float64Array, h: Float64Array, k: number): Float64Array {
  const L = new Float64Array(k * k);
  for (let i = 0; i < k; i++) {
    for (let j = 0; j <= i; j++) {
      let s = G[i * k + j];
      for (let p = 0; p < j; p++) s -= L[i * k + p] * L[j * k + p];
      L[i * k + j] = i === j ? Math.sqrt(s) : s / L[j * k + j];
    }
  }
  const y = new Float64Array(k), x = new Float64Array(k);
  for (let i = 0; i < k; i++) {
    let s = h[i];
    for (let p = 0; p < i; p++) s -= L[i * k + p] * y[p];
    y[i] = s / L[i * k + i];
  }
  for (let i = k - 1; i >= 0; i--) {
    let s = y[i];
    for (let p = i + 1; p < k; p++) s -= L[p * k + i] * x[p];
    x[i] = s / L[i * k + i];
  }
  return x;
}

export interface WeightFit {
  /** per bit, in units of the fitted tone's amplitude */
  weight: Float64Array;
  offset: number;
}

/**
 * calibrate_weight_sine(bits, freq): least squares for  Σ_j w_j b_j + offset + a·quadrature = −(unit tone), once with
 * the cosine and once with the sine as the unit tone; the smaller residual wins, and the weights and offset are divided
 * by the tone's size √(1 + a²), then flipped if the weights sum negative. `bits` holds the rows of an n × m matrix, MSB
 * first. A bit that never changes over the capture carries no information; it is left out of the fit and comes back
 * with a weight of zero, which is the library's rank patch for that case.
 */
export function calibrateWeightSine(bits: ArrayLike<number>, m: number, freq: number): WeightFit {
  const n = bits.length / m;
  const live: number[] = [];
  for (let j = 0; j < m; j++) {
    for (let i = 1; i < n; i++) {
      if (bits[i * m + j] !== bits[j]) {
        live.push(j);
        break;
      }
    }
  }
  const k = live.length + 2;
  const fits = [true, false].map((unitCos) => {
    const G = new Float64Array(k * k), h = new Float64Array(k), row = new Float64Array(k);
    let bb = 0;
    for (let i = 0; i < n; i++) {
      const ph = 2 * Math.PI * freq * i, c = Math.cos(ph), s = Math.sin(ph);
      for (let p = 0; p < live.length; p++) row[p] = bits[i * m + live[p]];
      row[live.length] = 1;
      row[live.length + 1] = unitCos ? s : c;
      const b = unitCos ? -c : -s;
      bb += b * b;
      for (let p = 0; p < k; p++) {
        h[p] += row[p] * b;
        for (let q = 0; q <= p; q++) G[p * k + q] += row[p] * row[q];
      }
    }
    for (let p = 0; p < k; p++) for (let q = p + 1; q < k; q++) G[p * k + q] = G[q * k + p];
    const x = solveSpd(G, h, k);
    let xh = 0;
    for (let p = 0; p < k; p++) xh += x[p] * h[p];
    return { x, residual: bb - xh };
  });
  const x = (fits[0].residual < fits[1].residual ? fits[0] : fits[1]).x;
  const size = Math.sqrt(1 + x[k - 1] ** 2);
  const weight = new Float64Array(m);
  live.forEach((j, p) => (weight[j] = x[p] / size));
  let total = 0;
  for (const w of weight) total += w;
  const sign = total < 0 ? -1 : 1;
  return { weight: weight.map((w) => w * sign), offset: (-x[k - 2] / size) * sign };
}
