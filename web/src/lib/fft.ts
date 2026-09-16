/** In-place radix-2 complex FFT (forward, no normalisation). Length must be a power of two. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang), half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k, b = a + half;
        const vr = re[b] * cr - im[b] * ci, vi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - vr; im[b] = im[a] - vi;
        re[a] = re[a] + vr; im[a] = im[a] + vi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

/**
 * The same transform for a record of any length, as numpy's FFT takes it: radix-2 lengths go straight to `fft`, any
 * other length through Bluestein's chirp, X_k = w_k · (a ∗ b)_k with w_k = e^(−iπk²/n), a_j = x_j·w_j and b = conj(w),
 * the convolution done by radix-2 transforms at least 2n − 1 long.
 */
export function fftAny(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if ((n & (n - 1)) === 0) return fft(re, im);
  let m = 1;
  while (m < 2 * n - 1) m <<= 1;
  const wr = new Float64Array(n), wi = new Float64Array(n);
  const ar = new Float64Array(m), ai = new Float64Array(m), br = new Float64Array(m), bi = new Float64Array(m);
  for (let k = 0; k < n; k++) {
    const phase = (Math.PI * k * k) / n;
    wr[k] = Math.cos(phase);
    wi[k] = -Math.sin(phase);
    ar[k] = re[k] * wr[k] - im[k] * wi[k];
    ai[k] = re[k] * wi[k] + im[k] * wr[k];
    // b is the conjugate chirp at lags ±k, the negative ones wrapped to the top of the buffer
    br[k] = br[(m - k) % m] = wr[k];
    bi[k] = bi[(m - k) % m] = -wi[k];
  }
  fft(ar, ai);
  fft(br, bi);
  for (let k = 0; k < m; k++) {
    const r = ar[k] * br[k] - ai[k] * bi[k];
    ai[k] = ar[k] * bi[k] + ai[k] * br[k];
    ar[k] = r;
  }
  // a forward transform read backwards is the inverse one, less its 1/m
  fft(ar, ai);
  for (let k = 0; k < n; k++) {
    const cr = ar[(m - k) % m] / m, ci = ai[(m - k) % m] / m;
    re[k] = wr[k] * cr - wi[k] * ci;
    im[k] = wr[k] * ci + wi[k] * cr;
  }
}
