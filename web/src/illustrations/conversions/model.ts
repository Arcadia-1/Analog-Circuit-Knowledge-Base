/**
 * What a conversion costs: the same converter written every way a datasheet writes it, the two figures of merit, and
 * the walls — a clock's jitter, a capacitor's kT/C and the quantiser itself — that stand in front of it.
 * Every formula is ADCToolbox's, through src/lib/units.ts; python/adc_conversions.py calls the library itself and
 * tests/conversions-model.test.ts compares the two.
 */
import {
  amplitudesToSnr,
  binToFreq,
  dbToMag,
  enobToSnr,
  freqToBin,
  jitterLimit,
  lsbToVolts,
  noiseBandwidth,
  nsdToSnr,
  schreierFom,
  sineAmplitudeToPower,
  snrToEnob,
  snrToNsd,
  thermalLimit,
  voltsToLsb,
  vrmsToDbm,
  waldenFom,
} from '../../lib/units';

/** the record length the lesson's bin conversions use, so a bin is a bin of the same FFT as the other lessons */
export const N_FFT = 4096;
/** the Walden figures the landscape draws, in joules per conversion step */
export const FOM_W = [10e-15, 100e-15, 1000e-15];
/** and the Schreier figures, in dB */
export const FOM_S = [160, 170, 180, 190];

export interface Part {
  /** sampling rate, Hz */
  fs: number;
  /** oversampling ratio: the noise bandwidth is fs / 2·osr */
  osr: number;
  /** what it achieves, dB */
  sndr: number;
  /** what it draws, W */
  power: number;
  /** full scale, V peak to peak */
  vfs: number;
  /** the resolution it is sold as, which is always more than its ENOB */
  bits: number;
}

/** Four working points a converter is asked for, spread over five decades of sampling rate. */
export const PARTS: Record<string, Part> = {
  audio: { fs: 6.144e6, osr: 64, sndr: 100, power: 3e-3, vfs: 2, bits: 24 },
  sensor: { fs: 1e6, osr: 1, sndr: 60, power: 20e-6, vfs: 1, bits: 12 },
  radio: { fs: 500e6, osr: 1, sndr: 65, power: 60e-3, vfs: 1, bits: 14 },
  scope: { fs: 10e9, osr: 1, sndr: 40, power: 1.5, vfs: 0.5, bits: 8 },
};

export interface Ladder {
  bw: number;
  enob: number;
  /** the SNDR that ENOB converts back to, which is not quite the one you started from */
  back: number;
  nsd: number;
  fromNsd: number;
  /** the rms the noise must have for that SNDR, in volts and in LSB of the nominal resolution */
  noiseV: number;
  noiseLsb: number;
  lsbV: number;
  fromAmplitudes: number;
  signalDbm: number;
  signalMw: number;
  walden: number;
  schreier: number;
}

/** The same converter, written every way a datasheet writes it. */
export function ladder(part: Part): Ladder {
  const { fs, osr, sndr, power, vfs, bits } = part;
  const bw = noiseBandwidth(fs, osr);
  const enob = snrToEnob(sndr);
  const nsd = snrToNsd(sndr, fs, osr);
  const amplitude = vfs / 2;
  const noiseV = amplitude / Math.SQRT2 / dbToMag(sndr);
  return {
    bw,
    enob,
    back: enobToSnr(enob),
    nsd,
    fromNsd: nsdToSnr(nsd, fs, osr),
    noiseV,
    noiseLsb: voltsToLsb(noiseV, vfs, bits),
    lsbV: lsbToVolts(1, vfs, bits),
    fromAmplitudes: amplitudesToSnr(amplitude, noiseV),
    signalDbm: vrmsToDbm(amplitude / Math.SQRT2),
    signalMw: sineAmplitudeToPower(amplitude) * 1e3,
    walden: waldenFom(power, fs, enob),
    schreier: schreierFom(power, sndr, bw),
  };
}

/** The ENOB a fixed Walden figure buys at this sampling rate: FOM = P / (2^ENOB · fs). */
export const enobAtWalden = (power: number, fom: number, fs: number): number => Math.log2(power / (fom * fs));

/** The SNDR a fixed Schreier figure buys over this bandwidth. */
export const sndrAtSchreier = (power: number, fom: number, bw: number): number => fom - 10 * Math.log10(bw / power);

/** The bins a frequency and a bin index convert to and from, the one round trip that need not come back. */
export const bins = (freq: number, fs: number): { bin: number; back: number } => {
  const bin = freqToBin(freq, fs, N_FFT);
  return { bin, back: binToFreq(bin, fs, N_FFT) };
};

export interface Walls {
  /** SNR each wall allows at the input frequency asked for, in the band the converter keeps */
  jitter: number;
  thermal: number;
  quantiser: number;
  /** what oversampling took off all three, dB */
  gain: number;
  /** which one is lowest, and how far the part is from it */
  nearest: 'jitter' | 'thermal' | 'quantiser';
  headroom: number;
}

/**
 * What stands in front of a converter at one input frequency: its clock, its sampling capacitor, and its own codes.
 * All three noises are spread over fs / 2, so all three come down by the 10 log OSR that amplitudes_to_snr adds when
 * only the band below fs / 2·OSR is kept. calculate_jitter_limit and calculate_thermal_noise_limit are the numbers at
 * the Nyquist rate, before that gain.
 */
export function walls(part: Part, fin: number, jitterS: number, capPf: number): Walls {
  const gain = part.osr > 1 ? 10 * Math.log10(part.osr) : 0;
  const jitter = jitterLimit(fin, jitterS) + gain;
  const thermal = thermalLimit(capPf, part.vfs) + gain;
  const quantiser = enobToSnr(part.bits) + gain;
  const lowest = Math.min(jitter, thermal, quantiser);
  return {
    jitter,
    thermal,
    quantiser,
    gain,
    nearest: lowest === jitter ? 'jitter' : lowest === thermal ? 'thermal' : 'quantiser',
    headroom: lowest - part.sndr,
  };
}

export interface Reading {
  part: Part;
  ladder: Ladder;
  walls: Walls;
  fin: number;
}

export function read(part: Part, fin: number, jitterS: number, capPf: number): Reading {
  return { part, ladder: ladder(part), walls: walls(part, fin, jitterS, capPf), fin };
}
