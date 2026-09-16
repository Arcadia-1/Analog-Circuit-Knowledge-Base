/**
 * Integer-N vs fractional-N PLL: reference-rate time-domain model.
 * Mirrors python/pll_int_vs_frac.py (tests/pll-model.test.ts checks the numbers).
 *
 * Loop: linear phase detector, type-II PI filter (ζ = 1) with two extra poles at 6 × BW, closed-loop −3 dB = BW.
 * Noise: white reference + phase-detector timing noise from a −228 dBc/Hz normalised floor, VCO −120 dBc/Hz at 1 MHz.
 * Divider: fixed N | first-order accumulator | MASH 1-1-1 (24-bit, LSB set), either with an ideal-gain DTC with bow INL.
 */
import { fft } from '../../lib/fft';
import { gaussians } from '../../lib/rng';

export type Mode = 'int' | 'acc' | 'sd';

const W = 24, M = 1 << W, MASK = M - 1;
const POLE_X = 6;
const FOM = -228;
const L_VCO_1M = -120;
const BW_MAX = 5e6;
const SIG_REF = 10 ** (FOM / 20) / (2 * Math.PI);
const N_WARM = 8192;
const N_FFT = 32768;
export const N_SHOW = 80;
export const bwMaxFor = (fRef: number): number => Math.min(BW_MAX, fRef / 12);

type C = [number, number];
const cmul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cdiv = (a: C, b: C): C => {
  const d = b[0] * b[0] + b[1] * b[1];
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
};

/** |H(f)| of the closed loop from reference-side timing error to output. */
export function closedLoopMag(f: number, gp: number, beta: number, fRef: number): number {
  const th = (2 * Math.PI * f) / fRef;
  const z: C = [Math.cos(th), Math.sin(th)], zm1: C = [z[0] - 1, z[1]];
  const A = cmul([(gp * gp) / 4, 0], cdiv(z, zm1));
  A[0] += gp;
  const B = cdiv([beta * z[0], beta * z[1]], [zm1[0] + beta, zm1[1]]);
  const L = cmul(A, cmul(B, B));
  const H = cdiv(L, [zm1[0] + L[0], zm1[1] + L[1]]);
  return Math.hypot(H[0], H[1]);
}

const loopCache = new Map<string, { gp: number; beta: number }>();
export function loopFor(fRef: number, bw: number): { gp: number; beta: number } {
  const key = `${fRef}|${bw}`;
  let v = loopCache.get(key);
  if (!v) {
    const beta = 1 - Math.exp((-2 * Math.PI * POLE_X * bw) / fRef);
    let lo = 1e-5, hi = 2;
    for (let i = 0; i < 70; i++) {
      const m = (lo + hi) / 2;
      if (closedLoopMag(bw, m, beta, fRef) < Math.SQRT1_2) lo = m;
      else hi = m;
    }
    v = { gp: (lo + hi) / 2, beta };
    loopCache.set(key, v);
  }
  return v;
}

const NTOT = N_WARM + N_FFT;
const G_REF = gaussians(NTOT, 11);
const G_VCO = gaussians(NTOT, 29);

export interface Sim {
  fRef: number;
  nInt: number;
  nAvg: number;
  fOut: number;
  tOut: number;
  /** output timing error at each reference edge (s), after warm-up */
  x: Float64Array;
  /** phase-detector error for the first N_SHOW cycles (s) */
  e: Float64Array;
  /** divider ratio used in each of the first N_SHOW cycles */
  ndiv: Int16Array;
  /** accumulated quantisation error × T_out for the first N_SHOW cycles (s) */
  qd: Float64Array;
}

export function simulate(targetHz: number, mode: Mode, dtc: boolean, inlPs: number, fRef: number, bw: number, cpMismatch = 0): Sim {
  const T_REF = 1 / fRef;
  const { gp, beta } = loopFor(fRef, bw);
  let nInt: number, fcw: number;
  if (mode === 'int') {
    nInt = Math.round(targetHz / fRef);
    fcw = 0;
  } else {
    nInt = Math.floor(targetHz / fRef + 1e-12);
    fcw = Math.round((targetHz / fRef - nInt) * M);
    if (mode === 'sd' && fcw) fcw |= 1;
  }
  const nAvg = nInt + fcw / M, tOut = T_REF / nAvg;
  // the phase error the DTC has to cancel: one output period of sawtooth after an accumulator, four after MASH 1-1-1
  const top = mode === 'acc' ? 0 : 2, span = mode === 'acc' ? 1 : 4;
  const kp = gp / nAvg, ki = (gp * gp) / 4 / nAvg;
  const sigVco = 1e6 * tOut * Math.sqrt(10 ** (L_VCO_1M / 10) / fRef);
  const x = new Float64Array(N_FFT), e = new Float64Array(N_SHOW), ndiv = new Int16Array(N_SHOW), qd = new Float64Array(N_SHOW);
  let xo = 0, I = 0, p1 = 0, p2 = 0, Q = 0, a1 = 0, a2 = 0, a3 = 0, c2p = 0, c3p = 0, c3pp = 0;
  for (let k = 0; k < NTOT; k++) {
    const q = Q / M;
    let delta = 0;
    if (dtc) {
      const u = (top - q) / span;
      delta = (top - q) * tOut + inlPs * 1e-12 * 4 * u * (1 - u);
    }
    const err = xo + q * tOut + delta + SIG_REF * G_REF[k];
    // charge-pump up/down current mismatch: the pump gain differs by sign of the phase error
    const pump = err * (1 + (err >= 0 ? cpMismatch : -cpMismatch) / 2);
    I += ki * pump;
    p1 += beta * (kp * pump + I - p1);
    p2 += beta * (p1 - p2);
    let y = 0;
    if (mode === 'acc') {
      const s1 = a1 + fcw;
      y = s1 >> W; a1 = s1 & MASK;
    } else if (mode === 'sd') {
      const s1 = a1 + fcw, c1 = s1 >> W; a1 = s1 & MASK;
      const s2 = a2 + a1, c2 = s2 >> W; a2 = s2 & MASK;
      const s3 = a3 + a2, c3 = s3 >> W; a3 = s3 & MASK;
      y = c1 + (c2 - c2p) + (c3 - 2 * c3p + c3pp);
      c2p = c2; c3pp = c3p; c3p = c3;
    }
    const j = k - N_WARM;
    if (j >= 0) {
      x[j] = xo;
      if (j < N_SHOW) { e[j] = err; ndiv[j] = nInt + y; qd[j] = q * tOut; }
    }
    xo += (nInt + y) * -p2 + sigVco * G_VCO[k];
    Q += y * M - fcw;
  }
  return { fRef, nInt, nAvg, fOut: 1 / tOut, tOut, x, e, ndiv, qd };
}

export interface Spur { f: number; dBc: number }
/** Shared vertical scales of the two phase-detector charts. */
export interface EdgeScale { nMin: number; nMax: number; R: number }
export interface Analysis {
  jitterFs: number;
  bandLo: number;
  bandHi: number;
  fTop: number;
  spurs: Spur[];
  curve: { f: number; L: number }[];
}

/** Spectrum of e^{jφ}: phase noise (dBc/Hz, spur bins excluded), spurs (dBc, 5-bin lobe), rms jitter. */
export function analyze(r: Sim): Analysis {
  const n = N_FFT, x = r.x;
  let sx = 0, sxx = 0, sy = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sx += i; sxx += i * i; sy += x[i]; sxy += i * x[i]; }
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx), icpt = (sy - slope * sx) / n;
  const re = new Float64Array(n), im = new Float64Array(n);
  let ss = 0, sw2 = 0;
  for (let i = 0; i < n; i++) {
    const d = x[i] - (icpt + slope * i);
    ss += d * d;
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n), ph = (2 * Math.PI * d) / r.tOut;
    re[i] = w * Math.cos(ph); im[i] = w * Math.sin(ph); sw2 += w * w;
  }
  fft(re, im);
  const fRef = r.fRef, fTop = 0.48 * fRef, half = n / 2, df = fRef / n;
  const P = new Float64Array(half), dB = new Float64Array(half);
  for (let k = 1; k < half; k++) {
    P[k] = 0.5 * (re[k] ** 2 + im[k] ** 2 + re[n - k] ** 2 + im[n - k] ** 2);
    dB[k] = 10 * Math.log10(P[k] + 1e-300);
  }
  const floor = new Float64Array(half), edges = [1];
  for (let i = 1; i <= 60; i++) {
    const v = Math.round((half - 1) ** (i / 60));
    if (v > edges[edges.length - 1]) edges.push(v);
  }
  for (let b = 0; b < edges.length - 1; b++) {
    const seg = Array.from(dB.subarray(edges[b], edges[b + 1] + 1)).sort((u, v) => u - v);
    const med = seg[seg.length >> 1];
    for (let k = edges[b]; k <= edges[b + 1]; k++) floor[k] = med;
  }
  const lobe = new Uint8Array(half), spurs: Spur[] = [];
  for (let k = 6; k < half - 2; k++) {
    if (k * df < 1e4 || dB[k] < floor[k] + 18) continue;
    if (dB[k] < Math.max(dB[k - 2], dB[k - 1], dB[k + 1], dB[k + 2])) continue;
    const pw = (P[k - 2] + P[k - 1] + P[k] + P[k + 1] + P[k + 2]) / (n * sw2);
    spurs.push({ f: k * df, dBc: 10 * Math.log10(pw) });
    for (let j = k - 3; j <= k + 3; j++) lobe[j] = 1;
  }
  spurs.sort((a, b) => b.dBc - a.dBc);
  const curve: { f: number; L: number }[] = [], NPTS = 180;
  for (let i = 0; i < NPTS; i++) {
    const f = 1e4 * (fTop / 1e4) ** (i / (NPTS - 1));
    let a = Math.floor(f / 1.04 / df), b = Math.ceil((f * 1.04) / df);
    if (b - a < 4) { const c = Math.round(f / df); a = c - 2; b = c + 2; }
    a = Math.max(a, 4); b = Math.min(b, half - 1);
    let s = 0, cnt = 0;
    for (let k = a; k <= b; k++) if (!lobe[k]) { s += P[k]; cnt++; }
    if (cnt) curve.push({ f, L: 10 * Math.log10(s / cnt / (fRef * sw2) + 1e-300) });
  }
  return { jitterFs: Math.sqrt(ss / n) * 1e15, bandLo: df, bandHi: fRef / 2, fTop, spurs: spurs.filter((p) => p.f <= fTop), curve };
}
