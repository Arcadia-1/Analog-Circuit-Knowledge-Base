/**
 * Time-interleaved converters: M slower sub-ADCs take turns, and whatever differs between them, an offset, a gain, the
 * instant each one samples, repeats every M samples and becomes spurs. One sine is enough to measure all three and take
 * them out again, as long as each sub-ADC still sees the tone below its own Nyquist frequency.
 * Ported from ADCToolbox 0.9.1 (github.com/Arcadia-1/ADCToolbox):
 *   timeinterleave/   deinterleave, interleave, extract_mismatch_sine, predict_spurs, calibrate_foreground,
 *                     fractional_delay_fft, fractional_delay_farrow
 *   fundamentals/     find_coherent_frequency, fold_frequency_to_nyquist, through src/lib/frequency.ts
 *   siggen/           apply_quantization_noise, and apply_thermal_noise's sum
 *   spectrum/         analyze_spectrum, through src/lib/spectrum.ts
 * following its example exp_ti01, which builds the mismatched capture this way and compares the two delays.
 * python/adc_time_interleave.py calls ADCToolbox on the same samples; tests/timeinterleave-model.test.ts compares the two.
 *
 * Volts on a ±0.5 V range, seconds and hertz: 4096 samples at 1 GS/s.
 */
import { fft, fftAny } from '../../lib/fft';
import { coherentFrequency, foldFrequency } from '../../lib/frequency';
import { gaussians } from '../../lib/rng';
import { analyzeSpectrum, N_FFT, type Spectrum } from '../../lib/spectrum';

export const FS = 1e9;
export const N = N_FFT;
export const AMP = 0.4;
export const CHANNELS = [2, 4, 8];
/** exp_ti01's Farrow interpolator */
export const TAPS = 9;
const NOISE_LSB = 0.3;
const NOISE_SEED = 7;
const JITTER_SEED = 71;

export type Method = 'off' | 'fft' | 'farrow';

/** Per channel: relative gain, offset in volts, skew in seconds. */
export interface Mismatch {
  gain: Float64Array;
  offset: Float64Array;
  skew: Float64Array;
  /** Relative mismatch of each channel's one-pole input bandwidth. */
  bandwidth?: Float64Array;
}

// one fixed draw per quantity and channel; the controls only scale it
const DRAWS = gaussians(32, 2026);

/** Draws `which` for the first m channels, less their mean and scaled to an rms of one. */
export function pattern(which: number, m: number): Float64Array {
  const z = DRAWS.slice(8 * which, 8 * which + m);
  let sum = 0, square = 0;
  for (const v of z) sum += v;
  const d = z.map((v) => v - sum / m);
  for (const v of d) square += v * v;
  return d.map((v) => v / Math.sqrt(square / m));
}

/** A mismatch with the given rms across the m channels: gain as a fraction, offset in volts, skew in seconds. */
export function mismatch(m: number, gainRms: number, offsetRms: number, skewRms: number, bandwidthRms?: number): Mismatch {
  const out: Mismatch = {
    gain: pattern(0, m).map((z) => 1 + gainRms * z),
    offset: pattern(1, m).map((z) => offsetRms * z),
    skew: pattern(2, m).map((z) => skewRms * z),
  };
  if (bandwidthRms !== undefined) out.bandwidth = pattern(3, m).map((z) => bandwidthRms * z);
  return out;
}

export interface CaptureOptions {
  fs?: number;
  /** RMS aperture jitter in seconds. */
  jitter?: number;
  /** H2 in dBc; H3 is 6 dB lower. Values at or below −100 dBc disable both. */
  harmonicDbc?: number;
}

/** The source before channel mismatch: fundamental plus optional H2 and H3. */
export function inputValue(t: number, fin: number, harmonicDbc = -Infinity): number {
  let v = AMP * Math.cos(2 * Math.PI * fin * t);
  if (harmonicDbc > -100) {
    v += AMP * 10 ** (harmonicDbc / 20) * Math.cos(2 * Math.PI * 2 * fin * t + 0.31);
    v += AMP * 10 ** ((harmonicDbc - 6) / 20) * Math.cos(2 * Math.PI * 3 * fin * t - 0.47);
  }
  return v;
}

/**
 * A channel bandwidth error is modelled as a shifted one-pole corner. The nominal corner is fs/2; returning the ratio
 * to the nominal response keeps the common roll-off out of the lesson and leaves only channel-to-channel mismatch.
 */
export function bandwidthResponse(relativeError: number, frequency: number, fs: number): { amplitude: number; phase: number } {
  const nominal = fs / 2;
  const actual = nominal * Math.max(0.05, 1 + relativeError);
  const xn = frequency / nominal, xa = frequency / actual;
  return {
    amplitude: Math.sqrt((1 + xn * xn) / (1 + xa * xa)),
    phase: Math.atan(xn) - Math.atan(xa),
  };
}

/**
 * exp_ti01's capture: sample n comes from sub-ADC n mod m, which samples its skew late and scales and shifts what it
 * sees. Then 0.3 LSB of thermal noise and the quantiser, which floors and clips on ±0.5 V as apply_quantization_noise
 * does.
 */
export function capture(fin: number, mm: Mismatch, bits: number, len = N, options: CaptureOptions = {}): Float64Array {
  const fs = options.fs ?? FS, jitter = options.jitter ?? 0, harmonicDbc = options.harmonicDbc ?? -Infinity;
  const m = mm.gain.length, T = 1 / fs, lsb = 1 / 2 ** bits, top = 2 ** bits - 1;
  const z = gaussians(len, NOISE_SEED), clock = jitter ? gaussians(len, JITTER_SEED) : null;
  return Float64Array.from({ length: len }, (_, n) => {
    const c = n % m, t = n * T + mm.skew[c] + (clock?.[n] ?? 0) * jitter;
    const harmonics = harmonicDbc > -100 ? [1, 2, 3] : [1];
    let signal = 0;
    for (const h of harmonics) {
      const dbc = h === 1 ? 0 : h === 2 ? harmonicDbc : harmonicDbc - 6;
      const phase = h === 1 ? 0 : h === 2 ? 0.31 : -0.47;
      const bw = bandwidthResponse(mm.bandwidth?.[c] ?? 0, h * fin, fs);
      signal += AMP * 10 ** (dbc / 20) * bw.amplitude * Math.cos(2 * Math.PI * h * fin * t + phase + bw.phase);
    }
    const v = mm.gain[c] * signal + mm.offset[c] + z[n] * NOISE_LSB * lsb;
    return Math.min(top, Math.max(0, Math.floor((v - -0.5) / lsb))) * lsb + -0.5;
  });
}

/** deinterleave: channel c holds samples c, c + m, c + 2m, … */
export const deinterleave = (x: Float64Array, m: number): Float64Array[] =>
  Array.from({ length: m }, (_, c) => x.filter((_, n) => n % m === c));

/** interleave: the inverse. */
export function interleave(channels: Float64Array[]): Float64Array {
  const m = channels.length, out = new Float64Array(m * channels[0].length);
  channels.forEach((ch, c) => ch.forEach((v, k) => (out[k * m + c] = v)));
  return out;
}

export interface Params {
  fin: number;
  /** the tone's amplitude, averaged over the channels */
  amp: number;
  gain: Float64Array;
  offset: Float64Array;
  skew: Float64Array;
}

const mean = (a: ArrayLike<number>): number => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  return s / a.length;
};

/** np.unwrap: a step between neighbours of π or more is taken as whole turns plus the rest, and the turns removed. */
export function unwrap(p: ArrayLike<number>): Float64Array {
  const out = Float64Array.from(p), turn = 2 * Math.PI;
  let correction = 0;
  for (let i = 1; i < p.length; i++) {
    const dd = p[i] - p[i - 1];
    // np.mod keeps the sign of the divisor
    let rest = (dd - -Math.PI) % turn;
    if (rest < 0) rest += turn;
    let wrapped = rest + -Math.PI;
    if (wrapped === -Math.PI && dd > 0) wrapped = Math.PI;
    if (!(Math.abs(dd) < Math.PI)) correction += wrapped - dd;
    out[i] = p[i] + correction;
  }
  return out;
}

/**
 * extract_mismatch_sine: each channel's mean is its offset, and its samples, taken at (k·m + c)/fs, give a phasor at
 * the known tone. The phasors' sizes are the gains, normalised to a mean of one; their phases, less the mean, are the
 * skews, since the channel's own place in the turn is already in the sample times.
 */
export function extractMismatch(x: Float64Array, m: number, fs: number, fin: number): Params {
  const T = 1 / fs;
  const offset = new Float64Array(m), amps = new Float64Array(m), phases = new Float64Array(m);
  deinterleave(x, m).forEach((y, c) => {
    const K = y.length, off = mean(y);
    let re = 0, im = 0;
    for (let k = 0; k < K; k++) {
      const th = 2 * Math.PI * fin * ((k * m + c) * T);
      re += (y[k] - off) * Math.cos(th);
      im -= (y[k] - off) * Math.sin(th);
    }
    offset[c] = off;
    amps[c] = Math.hypot((2 / K) * re, (2 / K) * im);
    phases[c] = Math.atan2((2 / K) * im, (2 / K) * re);
  });
  const amp = mean(amps), unwrapped = unwrap(phases), mid = mean(unwrapped);
  return {
    fin,
    amp,
    gain: amps.map((a) => (amp > 0 ? a / amp : 1)),
    offset,
    skew: unwrapped.map((p) => (p - mid) / (2 * Math.PI * fin)),
  };
}

export interface Spur {
  /** folded into 0 … fs/2 */
  freq: number;
  kind: 'offset' | 'image';
  k: number;
  amp: number;
  dbfs: number;
  dbc: number;
}

/** |X_k| of an m-point sequence, m a power of two. */
function dft(re: ArrayLike<number>, im: ArrayLike<number>): Float64Array {
  const r = Float64Array.from(re), i = Float64Array.from(im);
  fft(r, i);
  return r.map((v, k) => Math.hypot(v, i[k]));
}

/**
 * predict_spurs: an offset pattern puts a tone at k·fs/m, O its m-point DFT, for k = 1 … m/2. O_k and O_{m−k} are one
 * tone there, so it is 2|O_k|/m, except at fs/2, which is its own mirror and |O_k|/m. Gain and skew together, as the
 * complex gain α = gain·e^{j2π·fin·skew} less its mean, put images at fin + k·fs/m of A·|Â_k|/m. Sorted by frequency.
 */
export function predictSpurs(p: Params, fs: number, fullScale = 1): Spur[] {
  const m = p.gain.length;
  const fund = 20 * Math.log10(Math.max((p.amp * mean(p.gain)) / fullScale, 1e-300));
  const db = (amp: number) => {
    const dbfs = amp > 0 ? 20 * Math.log10(amp / fullScale) : -Infinity;
    return { dbfs, dbc: dbfs - fund };
  };
  const spurs: Spur[] = [];
  const O = dft(p.offset, new Float64Array(m));
  for (let k = 1; k <= m / 2; k++) {
    const amp = (O[k] / m) * (2 * k === m ? 1 : 2);
    spurs.push({ freq: foldFrequency((k * fs) / m, fs), kind: 'offset', k, amp, ...db(amp) });
  }
  const re = p.gain.map((g, c) => g * Math.cos(2 * Math.PI * p.fin * p.skew[c]));
  const im = p.gain.map((g, c) => g * Math.sin(2 * Math.PI * p.fin * p.skew[c]));
  const reMean = mean(re), imMean = mean(im);
  const G = dft(re.map((v) => v - reMean), im.map((v) => v - imMean));
  for (let k = 1; k < m; k++) {
    const amp = (p.amp * G[k]) / m;
    spurs.push({ freq: foldFrequency(p.fin + (k * fs) / m, fs), kind: 'image', k, amp, ...db(amp) });
  }
  // a stable sort, as Python's
  return spurs.map((s, i) => ({ s, i })).sort((a, b) => a.s.freq - b.s.freq || a.i - b.i).map(({ s }) => s);
}

/**
 * fractional_delay_fft: rotate every rfft bin by its own frequency times the delay and transform back; the Nyquist
 * bin keeps only its real part, as irfft reads it.
 */
export function delayFft(x: Float64Array, delay: number, fs: number): Float64Array {
  const n = x.length, half = Math.floor(n / 2);
  const re = Float64Array.from(x), im = new Float64Array(n);
  fftAny(re, im);
  const step = 1 / (n * (1 / fs));
  // the full spectrum irfft rebuilds: the rotated rfft bins, and their conjugates above them
  const yr = new Float64Array(n), yi = new Float64Array(n);
  for (let k = 0; k <= half; k++) {
    const th = -2 * Math.PI * (k * step) * delay, c = Math.cos(th), s = Math.sin(th);
    yr[k] = re[k] * c - im[k] * s;
    yi[k] = re[k] * s + im[k] * c;
  }
  if (n % 2 === 0) yi[half] = 0;
  for (let k = 1; k < n - half; k++) {
    yr[n - k] = yr[k];
    yi[n - k] = -yi[k];
  }
  // the inverse transform is the forward one read backwards, divided by n
  fftAny(yr, yi);
  return Float64Array.from({ length: n }, (_, j) => yr[(n - j) % n] / n);
}

/** np.round: halves go to the even neighbour. */
function roundEven(v: number): number {
  const r = Math.round(v);
  return Math.abs(v % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

/** The Lagrange interpolator fractional_delay_farrow convolves with: n taps, evaluated at p = n//2 + frac. */
export function lagrangeTaps(frac: number, taps: number): Float64Array {
  const p = Math.floor(taps / 2) + frac, h = new Float64Array(taps).fill(1);
  for (let i = 0; i < taps; i++) for (let j = 0; j < taps; j++) if (j !== i) h[i] *= (p - j) / (i - j);
  return h;
}

/**
 * fractional_delay_farrow: the whole samples of the delay by a shift that fills with zeros, the rest by the Lagrange
 * interpolator, convolved as np.convolve(mode='same') does, with zeros beyond both ends.
 */
export function delayFarrow(x: Float64Array, delay: number, fs: number, taps = TAPS): Float64Array {
  const n = x.length, d = delay * fs, whole = roundEven(d), P = Math.floor(taps / 2);
  const h = lagrangeTaps(d - whole, taps);
  const y = Float64Array.from({ length: n }, (_, i) => (i - whole >= 0 && i - whole < n ? x[i - whole] : 0));
  return Float64Array.from({ length: n }, (_, i) => {
    let s = 0;
    for (let k = 0; k < taps; k++) {
      const j = i + P - k;
      if (j >= 0 && j < n) s += y[j] * h[k];
    }
    return s;
  });
}

/**
 * calibrate_foreground: offset out first, then the gain, then each channel delayed by its own skew at fs/m, so the
 * channels are mixed only once their levels already agree.
 */
export function calibrate(x: Float64Array, m: number, p: Params, fs: number, method: Exclude<Method, 'off'>, taps = TAPS): Float64Array {
  const channels = deinterleave(x, m).map((ch, c) => ch.map((v) => (v - p.offset[c]) / p.gain[c]));
  return interleave(
    channels.map((ch, c) => {
      if (Math.abs(p.skew[c]) < 1e-18) return ch;
      return method === 'fft' ? delayFft(ch, p.skew[c], fs / m) : delayFarrow(ch, p.skew[c], fs / m, taps);
    }),
  );
}

/** analyze_spectrum on the ±0.5 V range: codes of the same resolution scale it to the full scale the port expects. */
export const spectrumOf = (x: Float64Array, bits: number): Spectrum => analyzeSpectrum(x.map((v) => v * 2 ** bits), bits);

/** The largest spur predict_spurs expects, as an SFDR. */
export const predictedSfdr = (spurs: Spur[]): number => -Math.max(...spurs.map((s) => s.dbc));

/** The sub-ADCs' own Nyquist frequency: calibrate_foreground's delays hold only below it. */
export const channelNyquist = (m: number): number => FS / (2 * m);

/** The fundamental-frequency gain and phase that the physical channel mismatches present to predict_spurs. */
export function physicalParams(mm: Mismatch, fin: number, fs: number): Params {
  const m = mm.gain.length, gain = new Float64Array(m), skew = new Float64Array(m);
  for (let c = 0; c < m; c++) {
    const bw = bandwidthResponse(mm.bandwidth?.[c] ?? 0, fin, fs);
    gain[c] = mm.gain[c] * bw.amplitude;
    skew[c] = mm.skew[c] + bw.phase / (2 * Math.PI * fin);
  }
  return { fin, amp: AMP, gain, offset: mm.offset, skew };
}

export interface Contribution {
  id: 'offset' | 'gain' | 'skew' | 'bandwidth' | 'harmonics' | 'jitter';
  label: string;
  note: string;
  /** Strongest result in dBc. Negative infinity means that source is off. */
  level: number;
  frequencies: number[];
  broadband?: boolean;
}

const zeroes = (m: number) => new Float64Array(m);
const ones = (m: number) => new Float64Array(m).fill(1);
const strongest = (spurs: Spur[]): number => Math.max(...spurs.map((s) => s.dbc));

/** A source-by-source map for the explanatory chart. Periodic mismatch makes tones; random jitter raises a floor. */
export function contributions(mm: Mismatch, fin: number, fs: number, harmonicDbc: number, jitter: number): Contribution[] {
  const m = mm.gain.length;
  const images = (gain: Float64Array, skew: Float64Array) =>
    predictSpurs({ fin, amp: AMP, gain, offset: zeroes(m), skew }, fs, 0.5).filter((s) => s.kind === 'image');
  const offset = predictSpurs({ fin, amp: AMP, gain: ones(m), offset: mm.offset, skew: zeroes(m) }, fs, 0.5).filter((s) => s.kind === 'offset');
  const gain = images(mm.gain, zeroes(m));
  const skew = images(ones(m), mm.skew);
  const bwGain = new Float64Array(m), bwSkew = new Float64Array(m);
  for (let c = 0; c < m; c++) {
    const bw = bandwidthResponse(mm.bandwidth?.[c] ?? 0, fin, fs);
    bwGain[c] = bw.amplitude;
    bwSkew[c] = bw.phase / (2 * Math.PI * fin);
  }
  const bandwidth = images(bwGain, bwSkew);
  const harmonicOn = harmonicDbc > -100;
  const jitterLevel = jitter > 0 ? 20 * Math.log10(2 * Math.PI * fin * jitter) : -Infinity;
  return [
    { id: 'offset', label: 'Offset', note: 'fixed tones at k·fs/M', level: strongest(offset), frequencies: offset.map((s) => s.freq) },
    { id: 'gain', label: 'Gain', note: 'copies around k·fs/M', level: strongest(gain), frequencies: gain.map((s) => s.freq) },
    { id: 'skew', label: 'Timing skew', note: 'same copies, rising with fin', level: strongest(skew), frequencies: skew.map((s) => s.freq) },
    { id: 'bandwidth', label: 'Bandwidth', note: 'frequency-dependent gain and phase', level: strongest(bandwidth), frequencies: bandwidth.map((s) => s.freq) },
    {
      id: 'harmonics', label: 'Harmonics', note: 'H2 and H3 fold into band', level: harmonicOn ? harmonicDbc : -Infinity,
      frequencies: harmonicOn ? [foldFrequency(2 * fin, fs), foldFrequency(3 * fin, fs)] : [],
    },
    { id: 'jitter', label: 'Jitter', note: 'broadband phase-noise floor', level: jitterLevel, frequencies: [], broadband: true },
  ];
}

export interface Reading {
  fin: number;
  bin: number;
  truth: Mismatch;
  /** what extract_mismatch_sine reads from the capture, and what predict_spurs makes of it */
  measured: Params;
  spurs: Spur[];
  raw: Spectrum;
  /** the calibrated capture, or the raw one again when calibration is off */
  out: Spectrum;
  /** what extract_mismatch_sine still reads after calibration */
  left: Params | null;
  rawData: Float64Array;
  outData: Float64Array;
}

export function read(m: number, target: number, mm: Mismatch, bits: number, method: Method, options: CaptureOptions = {}): Reading {
  const fs = options.fs ?? FS;
  const { fin, bin } = coherentFrequency(fs, target, N);
  const x = capture(fin, mm, bits, N, options);
  const measured = extractMismatch(x, m, fs, fin);
  const raw = spectrumOf(x, bits);
  const y = method === 'off' ? null : calibrate(x, m, measured, fs, method);
  const hasExtendedModel = Boolean(mm.bandwidth || options.jitter || (options.harmonicDbc ?? -Infinity) > -100 || options.fs);
  return {
    fin,
    bin,
    truth: mm,
    measured,
    spurs: predictSpurs(hasExtendedModel ? physicalParams(mm, fin, fs) : measured, fs, 0.5),
    raw,
    out: y ? spectrumOf(y, bits) : raw,
    left: y ? extractMismatch(y, m, fs, fin) : null,
    rawData: x,
    outData: y ?? x,
  };
}

/** RMS error against the ideal uniformly sampled input, over the requested leading samples or the whole record. */
export function residualRms(data: Float64Array, fin: number, count = data.length, fs = FS, harmonicDbc = -Infinity): number {
  let power = 0;
  const n = Math.min(count, data.length);
  for (let i = 0; i < n; i++) power += (data[i] - inputValue(i / fs, fin, harmonicDbc)) ** 2;
  return Math.sqrt(power / n);
}

/** Where the sweep puts its tones: the middle of 40 equal steps from 0 to fs/2, each moved to its coherent bin. */
export const SWEEP = Array.from({ length: 40 }, (_, i) => coherentFrequency(FS, ((i + 0.5) * FS) / 80, N).fin);

export interface Sweep {
  fin: number[];
  /** SFDR in dB, measured on the raw capture, predicted from it, and measured after each calibration */
  off: number[];
  predicted: number[];
  fft: number[];
  farrow: number[];
}

/** The same capture, extraction and calibrations at every frequency of SWEEP. */
export function sweep(m: number, mm: Mismatch, bits: number): Sweep {
  const out: Sweep = { fin: SWEEP, off: [], predicted: [], fft: [], farrow: [] };
  for (const fin of SWEEP) {
    const x = capture(fin, mm, bits);
    const p = extractMismatch(x, m, FS, fin);
    out.off.push(spectrumOf(x, bits).sfdr);
    out.predicted.push(predictedSfdr(predictSpurs(p, FS, 0.5)));
    out.fft.push(spectrumOf(calibrate(x, m, p, FS, 'fft'), bits).sfdr);
    out.farrow.push(spectrumOf(calibrate(x, m, p, FS, 'farrow'), bits).sfdr);
  }
  return out;
}
