/**
 * Symbol streams driven by a LinkAnalysis: a slow-motion stream for the 3-D view (one T/H sample and one slicer
 * decision per symbol) and a fast statistical stream that fills the three eye diagrams. No DOM here.
 */
import { mulberry32 } from '../../lib/rng';
import { LEVELS, NF, NFLY, NFPRE, OS, POST, PRE, PS, Prbs13, STX2, T0, metrics, waveAt, type LinkAnalysis, type Metrics } from './model';

export const RING = 1024;
export const MASK = RING - 1;

/** Box–Muller normals from a seeded uniform generator. */
export function normals(seed: number): () => number {
  const rnd = mulberry32(seed);
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }
    const u = rnd() || 1e-12, th = 2 * Math.PI * rnd(), r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(th);
    return r * Math.cos(th);
  };
}

/** The receiver as it runs: the analysis plus FFE taps that adapt toward the MMSE target. */
export class Receiver {
  a: LinkAnalysis;
  dsp: boolean;
  taps: Float64Array;
  live: Metrics;
  constructor(a: LinkAnalysis, dsp: boolean) {
    this.a = a;
    this.dsp = dsp;
    this.taps = Float64Array.from(a.weights);
    this.live = metrics(a.h, this.taps, a.noise, dsp);
  }
  /** Take a new analysis; the taps keep their values and adapt from there. */
  retarget(a: LinkAnalysis, dsp: boolean): void {
    this.a = a;
    this.dsp = dsp;
    this.live = metrics(a.h, this.taps, a.noise, dsp);
  }
  /** Move the taps toward the MMSE solution with time constant tau; returns true while they are still moving. */
  adapt(dt: number, tau = 0.5): boolean {
    const k = 1 - Math.exp(-dt / tau), target = this.a.weights;
    let moved = 0;
    for (let i = 0; i < NF; i++) {
      const e = target[i] - this.taps[i];
      this.taps[i] += e * k;
      moved += Math.abs(e);
    }
    this.live = metrics(this.a.h, this.taps, this.a.noise, this.dsp);
    return moved > 0.02 * (Math.abs(target[NFPRE]) || 1);
  }
  /** Slow-motion time at which the ADC samples symbol n (symbol n leaves the driver at t ≈ n). */
  get tSample(): number {
    return NFLY + (PS + this.a.tsOff) / OS - T0;
  }
}

/** Slow-motion stream: symbols, ADC samples at the CDR phase, FFE + DFE decisions and the errors among them. */
export class SymbolStream {
  readonly sym = new Uint8Array(RING);
  readonly level = new Float32Array(RING);
  readonly sample = new Float32Array(RING);
  readonly decision = new Uint8Array(RING);
  readonly error = new Uint8Array(RING);
  generated = 0;
  sampled = 0;
  decided = 0;
  errors = 0;
  decisions = 0;
  private readonly prbs: Prbs13;
  private readonly gauss: () => number;
  constructor(seed = 0x1d3) {
    this.prbs = new Prbs13(seed);
    this.gauss = normals(seed * 7919 + 1);
  }
  generate(upto: number): void {
    while (this.generated <= upto) {
      const s = this.prbs.symbol();
      this.sym[this.generated & MASK] = s;
      this.level[this.generated & MASK] = LEVELS[s];
      this.generated++;
    }
  }
  /** Fill the pipeline so that time t already has history behind it. */
  start(t: number, rx: Receiver): void {
    this.generate(Math.floor(t) + 64);
    this.sampled = this.decided = Math.floor(t - rx.tSample) - 80;
    this.advance(t, rx);
    this.errors = this.decisions = 0;
  }
  /** Sample and decide every symbol whose time has come; onSample reports each new ADC sample. */
  advance(t: number, rx: Receiver, onSample?: (n: number, v: number) => void): void {
    this.generate(Math.floor(t) + 64);
    const ts = rx.tSample, h = rx.a.h, sigma = rx.a.sigSample;
    while (this.sampled + ts <= t) {
      const n = this.sampled++;
      let v = 0;
      for (let k = -PRE; k <= POST; k++) v += this.level[(n - k) & MASK] * h[k + PRE];
      v = Math.max(-1, Math.min(1, v + this.gauss() * sigma));
      this.sample[n & MASK] = v;
      onSample?.(n, v);
    }
    while (this.decided + NFPRE + ts + 2 <= t && this.decided + NFPRE < this.sampled) this.decide(this.decided++, rx);
  }
  private decide(n: number, rx: Receiver): void {
    let z = 0;
    for (let a = 0; a < NF; a++) z += rx.taps[a] * this.sample[(n - a + NFPRE) & MASK];
    z = z / (rx.live.f0 || 1) - rx.live.b1 * LEVELS[this.decision[(n - 1) & MASK]];
    const d = z < -2 / 3 ? 0 : z < 0 ? 1 : z < 2 / 3 ? 2 : 3, wrong = d !== this.sym[n & MASK];
    this.decision[n & MASK] = d;
    this.error[n & MASK] = wrong ? 1 : 0;
    this.decisions++;
    if (wrong) this.errors++;
  }
}

/** Density image of one eye diagram: 2 UI wide, centred on the sampling instant. */
export class EyeImage {
  static readonly W = 192;
  static readonly H = 112;
  readonly buf = new Float32Array(EyeImage.W * EyeImage.H);
  decay(k: number): void {
    for (let i = 0; i < this.buf.length; i++) this.buf[i] *= k;
  }
  /** Draw one 2-UI trace (2·OS + 1 samples) into the image, vertical range ±range. */
  trace(win: Float32Array, range: number): void {
    const W = EyeImage.W, H = EyeImage.H, sx = (W - 1) / (2 * OS), sy = (H - 1) / (2 * range);
    let x0 = 0, y0 = (range - win[0]) * sy;
    for (let i = 1; i <= 2 * OS; i++) {
      const x1 = i * sx, y1 = (range - win[i]) * sy, dx = x1 - x0, dy = y1 - y0;
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)))), w = 1 / Math.sqrt(steps);
      for (let s = 0; s < steps; s++) {
        const t = s / steps, yi = Math.floor(y0 + dy * t);
        if (yi >= 0 && yi < H) this.buf[yi * W + Math.floor(x0 + dx * t)] += w;
      }
      x0 = x1;
      y0 = y1;
    }
  }
}

/** Fast stream for the eye diagrams: RX pad (V), ADC input (FS) and the equalized output (levels ±1, ±⅓). */
export class EyeStream {
  readonly eyes = [new EyeImage(), new EyeImage(), new EyeImage()] as const;
  /** Equalized value at the sampling instant of the most recent symbols, for checks. */
  readonly centre = new Float32Array(RING);
  n = 64;
  private generated = 0;
  private readonly sym = new Uint8Array(RING);
  private readonly value = new Float32Array(RING);
  private readonly pad: Float32Array[] = [];
  private readonly adc: Float32Array[] = [];
  private readonly out = new Float32Array(2 * OS + 1);
  private readonly prbs: Prbs13;
  private readonly gauss: () => number;
  constructor(seed = 0x0b5) {
    this.prbs = new Prbs13(seed);
    this.gauss = normals(seed * 104729 + 3);
    for (let i = 0; i < 16; i++) {
      this.pad.push(new Float32Array(2 * OS + 1));
      this.adc.push(new Float32Array(2 * OS + 1));
    }
  }
  run(count: number, rx: Receiver): void {
    const a = rx.a, taps = rx.taps, f0 = rx.live.f0 || 1, b1 = rx.live.b1, stx = Math.sqrt(STX2);
    while (this.generated <= this.n + count + 34) {
      const s = this.prbs.symbol();
      this.sym[this.generated & MASK] = s;
      this.value[this.generated & MASK] = LEVELS[s] + this.gauss() * stx;
      this.generated++;
    }
    for (let c = 0; c < count; c++) {
      const n = this.n++, wp = this.pad[n & 15], wa = this.adc[n & 15];
      const mp = n * OS + PS + a.padTs - OS, ma = n * OS + PS + a.tsOff - OS;
      for (let i = 0; i <= 2 * OS; i++) {
        wp[i] = waveAt(a.pad, mp + i, this.value, MASK) + this.gauss() * a.sigPad;
        wa[i] = Math.max(-1, Math.min(1, waveAt(a.adc, ma + i, this.value, MASK) + this.gauss() * a.sigAdc));
      }
      this.eyes[0].trace(wp, a.padRange);
      this.eyes[1].trace(wa, 1);
      if (n < 90) continue;
      // The T-spaced FFE applied at every phase, with the DFE feedback switched once per UI.
      const nd = n - NFPRE;
      for (let i = 0; i <= 2 * OS; i++) {
        let z = 0;
        for (let t = 0; t < NF; t++) z += taps[t] * this.adc[(nd - t + NFPRE) & 15][i];
        const ks = nd + (i < OS / 2 ? -1 : i >= 1.5 * OS ? 1 : 0);
        this.out[i] = z / f0 - b1 * LEVELS[this.sym[(ks - 1) & MASK]];
      }
      this.centre[nd & MASK] = this.out[OS];
      this.eyes[2].trace(this.out, 1.6);
    }
  }
  symbolAt(n: number): number {
    return this.sym[n & MASK];
  }
}
