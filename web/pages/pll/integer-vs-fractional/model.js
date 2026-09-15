/* Behavioural model: integer-N vs fractional-N PLL (mirrors int_vs_frac_model.py). */
const PLL = (() => {
  const W = 24, M = 16777216, MASK = M - 1;
  const POLE_X = 6, FOM = -228, L_VCO_1M = -120, BW_MIN = 100e3, BW_MAX = 5e6;
  const SIG_REF = Math.pow(10, FOM / 20) / (2 * Math.PI);   // white reference + PFD timing noise per edge (634 fs)
  const N_WARM = 8192, N_FFT = 32768, N_SHOW = 80;
  const bwMaxFor = (fRef) => Math.min(BW_MAX, fRef / 12);   // keeps the extra poles below Nyquist; stable over the whole range

  // ---- loop design: type-II PI (zeta = 1) + two poles at 6x BW, closed-loop -3 dB = BW (per reference) ----
  const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const cdiv = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
  function clMag(f, gp, beta, fRef) {
    const th = 2 * Math.PI * f / fRef, z = [Math.cos(th), Math.sin(th)], zm1 = [z[0] - 1, z[1]];
    const A = cmul([gp * gp / 4, 0], cdiv(z, zm1)); A[0] += gp;
    const B = cdiv([beta * z[0], beta * z[1]], [zm1[0] + beta, zm1[1]]);
    const L = cmul(A, cmul(B, B));
    const H = cdiv(L, [zm1[0] + L[0], zm1[1] + L[1]]);
    return Math.hypot(H[0], H[1]);
  }
  const loopCache = new Map();
  function loopFor(fRef, bw) {
    const key = `${fRef}|${bw}`;
    if (!loopCache.has(key)) {
      const beta = 1 - Math.exp(-2 * Math.PI * POLE_X * bw / fRef);
      let lo = 1e-5, hi = 2;
      for (let i = 0; i < 70; i++) { const m = (lo + hi) / 2; (clMag(bw, m, beta, fRef) < Math.SQRT1_2) ? lo = m : hi = m; }
      loopCache.set(key, { gp: (lo + hi) / 2, beta });
    }
    return loopCache.get(key);
  }

  // ---- seeded noise (identical realisation for every divider, so only the divider differs) ----
  function gaussians(n, seed) {
    let s = seed >>> 0; const out = new Float64Array(n);
    const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = 0; i < n; i += 2) {
      const u1 = rnd() || 1e-12, u2 = rnd(), r = Math.sqrt(-2 * Math.log(u1));
      out[i] = r * Math.cos(2 * Math.PI * u2); if (i + 1 < n) out[i + 1] = r * Math.sin(2 * Math.PI * u2);
    }
    return out;
  }
  const NTOT = N_WARM + N_FFT;
  const G_REF = gaussians(NTOT, 11), G_VCO = gaussians(NTOT, 29);

  // ---- time-domain simulation at the reference rate ----
  // mode: 'int' | 'acc' (first-order accumulator) | 'sd' (MASH 1-1-1) | 'dtc' (MASH 1-1-1 + ideal-gain DTC, bow INL)
  function simulate(targetHz, mode, inlPs, fRef, bw) {
    const T_REF = 1 / fRef, { gp: GP, beta } = loopFor(fRef, bw);
    let nInt, fcw;
    if (mode === 'int') { nInt = Math.round(targetHz / fRef); fcw = 0; }
    else {
      nInt = Math.floor(targetHz / fRef + 1e-12); fcw = Math.round((targetHz / fRef - nInt) * M);
      if (fcw >= M) { nInt += 1; fcw -= M; }
      if ((mode === 'sd' || mode === 'dtc') && fcw) fcw |= 1;         // LSB set: breaks up short MASH cycles
    }
    const alpha = fcw / M, nAvg = nInt + alpha, tOut = T_REF / nAvg;
    const kp = GP / nAvg, ki = GP * GP / 4 / nAvg;
    const sigVco = (1e6 * tOut) * Math.sqrt(Math.pow(10, L_VCO_1M / 10) / fRef);
    const x = new Float64Array(N_FFT), e = new Float64Array(N_SHOW), ndiv = new Int8Array(N_SHOW), qd = new Float64Array(N_SHOW);
    let xo = 0, I = 0, p1 = 0, p2 = 0, Q = 0, a1 = 0, a2 = 0, a3 = 0, c2p = 0, c3p = 0, c3pp = 0;
    for (let k = 0; k < NTOT; k++) {
      const q = Q / M;
      let delta = 0;
      if (mode === 'dtc') { const u = (2 - q) / 4; delta = (2 - q) * tOut + inlPs * 1e-12 * 4 * u * (1 - u); }
      const err = xo + q * tOut + delta + SIG_REF * G_REF[k];
      I += ki * err; p1 += beta * (kp * err + I - p1); p2 += beta * (p1 - p2);
      let y = 0;
      if (mode === 'acc') { const s1 = a1 + fcw; y = s1 >> W; a1 = s1 & MASK; }
      else if (mode === 'sd' || mode === 'dtc') {
        const s1 = a1 + fcw, c1 = s1 >> W; a1 = s1 & MASK;
        const s2 = a2 + a1, c2 = s2 >> W; a2 = s2 & MASK;
        const s3 = a3 + a2, c3 = s3 >> W; a3 = s3 & MASK;
        y = c1 + (c2 - c2p) + (c3 - 2 * c3p + c3pp); c2p = c2; c3pp = c3p; c3p = c3;
      }
      const j = k - N_WARM;
      if (j >= 0) { x[j] = xo; if (j < N_SHOW) { e[j] = err; ndiv[j] = nInt + y; qd[j] = q * tOut; } }
      xo += (nInt + y) * -p2 + sigVco * G_VCO[k];
      Q += y * M - fcw;
    }
    return { mode, fRef, bw, nInt, alpha, nAvg, fOut: 1 / tOut, tOut, x, e, ndiv, qd };
  }

  // ---- spectrum of exp(j*phi): phase noise (dBc/Hz) and spurs (dBc), rms jitter ----
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang), h = len >> 1;
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < h; k++) {
          const ur = re[i + k], ui = im[i + k], vr = re[i + k + h] * cr - im[i + k + h] * ci, vi = re[i + k + h] * ci + im[i + k + h] * cr;
          re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + h] = ur - vr; im[i + k + h] = ui - vi;
          const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
        }
      }
    }
  }
  function analyze(r) {
    const n = N_FFT, x = r.x;
    let sx = 0, sxx = 0, sy = 0, sxy = 0;
    for (let i = 0; i < n; i++) { sx += i; sxx += i * i; sy += x[i]; sxy += i * x[i]; }
    const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx), icpt = (sy - slope * sx) / n;
    const re = new Float64Array(n), im = new Float64Array(n);
    let ss = 0, sw2 = 0;
    for (let i = 0; i < n; i++) {
      const d = x[i] - (icpt + slope * i); ss += d * d;
      const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n), ph = 2 * Math.PI * d / r.tOut;
      re[i] = w * Math.cos(ph); im[i] = w * Math.sin(ph); sw2 += w * w;
    }
    fft(re, im);
    const fRef = r.fRef, fTop = 0.48 * fRef, half = n / 2, df = fRef / n, P = new Float64Array(half), dB = new Float64Array(half);
    for (let k = 1; k < half; k++) { P[k] = 0.5 * (re[k] * re[k] + im[k] * im[k] + re[n - k] * re[n - k] + im[n - k] * im[n - k]); dB[k] = 10 * Math.log10(P[k] + 1e-300); }
    // floor = median in log-spaced bins; spur = local max >= 12 dB above the floor
    const floor = new Float64Array(half), edges = [1];
    for (let i = 1; i <= 60; i++) { const v = Math.round(Math.pow(half - 1, i / 60)); if (v > edges[edges.length - 1]) edges.push(v); }
    for (let b = 0; b < edges.length - 1; b++) {
      const seg = Array.from(dB.subarray(edges[b], edges[b + 1] + 1)).sort((u, v) => u - v), med = seg[seg.length >> 1];
      for (let k = edges[b]; k <= edges[b + 1]; k++) floor[k] = med;
    }
    const lobe = new Uint8Array(half), spurs = [];
    for (let k = 6; k < half - 2; k++) {
      if (k * df < 1e4 || dB[k] < floor[k] + 18) continue;
      if (dB[k] < Math.max(dB[k - 2], dB[k - 1], dB[k + 1], dB[k + 2])) continue;
      const pw = (P[k - 2] + P[k - 1] + P[k] + P[k + 1] + P[k + 2]) / (n * sw2);
      spurs.push({ f: k * df, dBc: 10 * Math.log10(pw) });
      for (let j = k - 3; j <= k + 3; j++) lobe[j] = 1;
    }
    spurs.sort((a, b) => b.dBc - a.dBc);
    const curve = [], NPTS = 180;
    for (let i = 0; i < NPTS; i++) {
      const f = 1e4 * Math.pow(fTop / 1e4, i / (NPTS - 1));
      let a = Math.floor(f / 1.04 / df), b = Math.ceil(f * 1.04 / df);
      if (b - a < 4) { const c = Math.round(f / df); a = c - 2; b = c + 2; }
      a = Math.max(a, 4); b = Math.min(b, half - 1);
      let s = 0, cnt = 0;
      for (let k = a; k <= b; k++) if (!lobe[k]) { s += P[k]; cnt++; }
      if (cnt) curve.push({ f, L: 10 * Math.log10(s / cnt / (fRef * sw2) + 1e-300) });
    }
    return { jitterFs: Math.sqrt(ss / n) * 1e15, bandLo: df, bandHi: fRef / 2, fTop, spurs: spurs.filter((p) => p.f <= fTop), curve };
  }

  return { BW_MIN, bwMaxFor, N_SHOW, N_FFT, FOM, L_VCO_1M, SIG_REF, simulate, analyze };
})();
