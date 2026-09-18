/**
 * The closed forms a datasheet is written in, ported from ADCToolbox 0.9.1 (github.com/Arcadia-1/ADCToolbox):
 *   fundamentals/units.py    db_to_mag, mag_to_db, db_to_power, power_to_db, lsb_to_volts, volts_to_lsb, bin_to_freq,
 *                            freq_to_bin, snr_to_enob, enob_to_snr, dbm_to_vrms, vrms_to_dbm, dbm_to_mw, mw_to_dbm,
 *                            sine_amplitude_to_power
 *   fundamentals/snr_nsd.py  amplitudes_to_snr, snr_to_nsd, nsd_to_snr
 *   fundamentals/metrics.py  calculate_walden_fom, calculate_schreier_fom, calculate_thermal_noise_limit,
 *                            calculate_jitter_limit
 * Nothing here samples anything; every one is the formula, with the library's own rounded constants where it has them.
 */
import { roundEven } from './numeric';

/** db_to_mag: an amplitude ratio. */
export const dbToMag = (db: number): number => 10 ** (db / 20);
/** mag_to_db */
export const magToDb = (mag: number): number => 20 * Math.log10(mag);
/** db_to_power: a power ratio. */
export const dbToPower = (db: number): number => 10 ** (db / 10);
/** power_to_db */
export const powerToDb = (power: number): number => 10 * Math.log10(power);

/** lsb_to_volts: one LSB is the range over its codes. */
export const lsbToVolts = (lsb: number, vref: number, bits: number): number => lsb * (vref / 2 ** bits);
/** volts_to_lsb */
export const voltsToLsb = (volts: number, vref: number, bits: number): number => volts / (vref / 2 ** bits);

/** bin_to_freq */
export const binToFreq = (bin: number, fs: number, nFft: number): number => (bin * fs) / nFft;
/** freq_to_bin: the nearest bin, rounded numpy's way, so half a bin goes to the even one. */
export const freqToBin = (freq: number, fs: number, nFft: number): number => roundEven((freq * nFft) / fs);

/** snr_to_enob, with the 6.02 and 1.76 the industry quotes rather than 6.0206 and 1.7609. */
export const snrToEnob = (snr: number): number => (snr - 1.76) / 6.02;
/** enob_to_snr */
export const enobToSnr = (enob: number): number => enob * 6.02 + 1.76;

/** The noise bandwidth both NSD conversions work in: fs / 2 for Nyquist sampling, narrower as the OSR grows. */
export const noiseBandwidth = (fs: number, osr = 1): number => fs / (2 * osr);

/** snr_to_nsd: spread the noise that SNR implies over the noise bandwidth, in dBFS per hertz. */
export const snrToNsd = (snr: number, fs: number, osr = 1, signalDbfs = 0): number =>
  powerToDb(10 ** (signalDbfs / 10) / 10 ** (snr / 10) / noiseBandwidth(fs, osr));

/** nsd_to_snr: and back, by collecting that density over the same bandwidth. */
export const nsdToSnr = (nsd: number, fs: number, osr = 1, signalDbfs = 0): number =>
  powerToDb(10 ** (signalDbfs / 10) / (10 ** (nsd / 10) * noiseBandwidth(fs, osr)));

/** dbm_to_vrms */
export const dbmToVrms = (dbm: number, z = 50): number => Math.sqrt((dbToPower(dbm) / 1000) * z);
/** vrms_to_dbm */
export const vrmsToDbm = (vrms: number, z = 50): number => powerToDb(((vrms * vrms) / z) * 1000);
/** dbm_to_mw */
export const dbmToMw = (dbm: number): number => dbToPower(dbm);
/** mw_to_dbm */
export const mwToDbm = (mw: number): number => powerToDb(mw);
/** sine_amplitude_to_power: a sine of this peak into a load, in watts. */
export const sineAmplitudeToPower = (amplitude: number, z = 50): number => (amplitude / Math.SQRT2) ** 2 / z;

/** amplitudes_to_snr: a sine of this peak against noise of this rms, with the oversampling gain if there is any. */
export const amplitudesToSnr = (amplitude: number, noiseRms: number, osr = 1): number =>
  20 * Math.log10(amplitude / Math.SQRT2 / noiseRms) + (osr > 1 ? 10 * Math.log10(osr) : 0);

/** calculate_walden_fom: the energy a conversion step costs, in joules. Lower is better. */
export const waldenFom = (power: number, fs: number, enob: number): number => power / (2 ** enob * fs);
/** calculate_schreier_fom: dB of SNDR per hertz of bandwidth per watt. Higher is better. */
export const schreierFom = (power: number, sndr: number, bw: number): number => sndr + 10 * Math.log10(bw / power);

/** calculate_thermal_noise_limit: the SNR a sampling capacitor's own kT/C noise leaves, at the library's 300 K. */
export const thermalLimit = (capPf: number, vfs = 1): number =>
  powerToDb(vfs ** 2 / 8 / ((1.38e-23 * 300) / (capPf * 1e-12)));

/** calculate_jitter_limit: −20 log (2π f τ), the SNR a clock of this jitter leaves at this input frequency. */
export const jitterLimit = (fin: number, jitter: number): number => -20 * Math.log10(2 * Math.PI * fin * jitter);
