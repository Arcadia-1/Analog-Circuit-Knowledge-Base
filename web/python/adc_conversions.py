#!/usr/bin/env python3
"""Reference numbers for the lesson on what a conversion costs, computed with ADCToolbox.

    python -m pip install -r python/requirements.txt
    python3 python/adc_conversions.py

The lesson ports these ADCToolbox functions to TypeScript, and tests/conversions-model.test.ts checks the port against
the numbers printed here:
  fundamentals/units      db_to_mag, mag_to_db, db_to_power, power_to_db, lsb_to_volts, volts_to_lsb, bin_to_freq,
                          freq_to_bin, snr_to_enob, enob_to_snr, dbm_to_vrms, vrms_to_dbm, dbm_to_mw, mw_to_dbm,
                          sine_amplitude_to_power
  fundamentals/snr_nsd    amplitudes_to_snr, snr_to_nsd, nsd_to_snr
  fundamentals/metrics    calculate_walden_fom, calculate_schreier_fom, calculate_thermal_noise_limit,
                          calculate_jitter_limit
following the examples exp_c02 (unit conversions), exp_c03 (figures of merit and limits), exp_c04 (amplitudes to SNR)
and exp_c05 (noise spectral density).

Nothing here is sampled: these are the closed forms a datasheet is written in, so the page can be read as a converter
being specified rather than measured.
"""
import math

from adctoolbox import (amplitudes_to_snr, bin_to_freq, db_to_mag, db_to_power, dbm_to_mw, dbm_to_vrms, enob_to_snr,
                        freq_to_bin, lsb_to_volts, mag_to_db, mw_to_dbm, nsd_to_snr, power_to_db, sine_amplitude_to_power,
                        snr_to_enob, snr_to_nsd, volts_to_lsb, vrms_to_dbm)
from adctoolbox.fundamentals import (calculate_jitter_limit, calculate_schreier_fom, calculate_thermal_noise_limit,
                                     calculate_walden_fom)

N_FFT = 4096
# name: sampling rate, oversampling ratio, SNDR in dB, power in W, full scale in V, nominal bits
PARTS = {
    "audio": (6.144e6, 64, 100.0, 3e-3, 2.0, 24),
    "sensor": (1e6, 1, 60.0, 20e-6, 1.0, 12),
    "radio": (500e6, 1, 65.0, 60e-3, 1.0, 14),
    "scope": (10e9, 1, 40.0, 1.5, 0.5, 8),
}
FOM_W = [10e-15, 100e-15, 1000e-15]
FOM_S = [160.0, 170.0, 180.0, 190.0]


def ladder(fs, osr, sndr, vfs, bits):
    """The same converter written the way each part of a datasheet writes it."""
    bw = fs / (2 * osr)
    enob = snr_to_enob(sndr)
    nsd = snr_to_nsd(sndr, fs=fs, osr=osr)
    amplitude = vfs / 2
    noise_v = amplitude / math.sqrt(2) / db_to_mag(sndr)
    return {
        "bw": bw,
        "enob": enob,
        "back": enob_to_snr(enob),
        "nsd": nsd,
        "from_nsd": nsd_to_snr(nsd, fs=fs, osr=osr),
        "noise_v": noise_v,
        "noise_lsb": volts_to_lsb(noise_v, vref=vfs, n_bits=bits),
        "lsb_v": lsb_to_volts(1, vref=vfs, n_bits=bits),
        "from_amplitudes": amplitudes_to_snr(sig_amplitude=amplitude, noise_amplitude=noise_v),
        "signal_dbm": vrms_to_dbm(amplitude / math.sqrt(2)),
        "signal_mw": sine_amplitude_to_power(amplitude) * 1e3,
    }


def row(values, fmt):
    return " ".join(format(v, fmt) for v in values)


if __name__ == "__main__":
    print("[unit round trips]")
    print("  dB -> magnitude -> dB")
    for db in (-80.0, -40.0, -6.02, 0.0, 20.0):
        print(f"  {db:8.2f} {db_to_mag(db):14.9f} {mag_to_db(db_to_mag(db)):9.4f}")
    print("  dB -> power ratio -> dB")
    for db in (-3.01, 0.0, 10.0, 30.0):
        print(f"  {db:8.2f} {db_to_power(db):14.6f} {power_to_db(db_to_power(db)):9.4f}")
    print("  volts -> LSB -> volts, on a 1 V range")
    for v in (1e-6, 1e-3, 0.25, 0.5):
        print(f"  {v:10.6f} {volts_to_lsb(v, vref=1.0, n_bits=12):14.6f} {lsb_to_volts(volts_to_lsb(v, vref=1.0, n_bits=12), vref=1.0, n_bits=12):12.9f}")
    print(f"  frequency -> bin -> frequency, {N_FFT} points at 1 GS/s")
    for f in (1e6, 96.923828e6, 250e6, 499.9e6):
        b = freq_to_bin(f, fs=1e9, n_fft=N_FFT)
        print(f"  {f / 1e6:11.6f} {b:6d} {bin_to_freq(b, fs=1e9, n_fft=N_FFT) / 1e6:12.6f}")
    print("  SNR -> ENOB -> SNR")
    for snr in (40.0, 61.96, 74.0, 100.0):
        print(f"  {snr:8.2f} {snr_to_enob(snr):9.4f} {enob_to_snr(snr_to_enob(snr)):9.4f}")
    print("  dBm -> Vrms -> dBm, and dBm -> mW -> dBm, into 50 ohm")
    for dbm in (-30.0, -10.0, 0.0, 13.0):
        print(f"  {dbm:8.2f} {dbm_to_vrms(dbm):12.9f} {vrms_to_dbm(dbm_to_vrms(dbm)):9.4f} {dbm_to_mw(dbm):12.6f} {mw_to_dbm(dbm_to_mw(dbm)):9.4f}")
    print("  sine peak amplitude -> power into 50 ohm, W")
    for amp in (0.1, 0.5, 1.0):
        print(f"  {amp:8.2f} {sine_amplitude_to_power(amp):14.9f}")
    print()

    print("[the same converter, written every way a datasheet writes it]")
    for name, (fs, osr, sndr, power, vfs, bits) in PARTS.items():
        d = ladder(fs, osr, sndr, vfs, bits)
        print(f"  {name}: {fs / 1e6:g} MS/s, OSR {osr}, SNDR {sndr:g} dB, {power * 1e3:g} mW, {vfs:g} V range, {bits} bits")
        print(f"    bandwidth {d['bw'] / 1e3:12.4f} kHz, ENOB {d['enob']:8.4f} bits, back to SNDR {d['back']:8.4f} dB")
        print(f"    NSD {d['nsd']:10.4f} dBFS/Hz, back to SNR {d['from_nsd']:8.4f} dB")
        print(f"    noise {d['noise_v'] * 1e6:12.6f} uV rms = {d['noise_lsb']:10.6f} LSB of {d['lsb_v'] * 1e6:10.6f} uV, from amplitudes {d['from_amplitudes']:8.4f} dB")
        print(f"    signal {d['signal_dbm']:9.4f} dBm = {d['signal_mw']:12.6f} mW into 50 ohm")
        print(f"    Walden {calculate_walden_fom(power, fs, d['enob']) * 1e15:12.4f} fJ/conv-step, "
              f"Schreier {calculate_schreier_fom(power, sndr, d['bw']):8.4f} dB")
    print()

    print("[what a fixed Walden FOM buys: ENOB against sampling rate, at 10 mW]")
    print("  fs MHz, then 10, 100 and 1000 fJ/conv-step")
    for fs in (1e6, 1e7, 1e8, 1e9, 1e10, 1e11):
        print(f"  {fs / 1e6:11.1f} " + row([math.log2(10e-3 / (fom * fs)) for fom in FOM_W], "9.4f"))
    print()

    print("[what a fixed Schreier FOM buys: SNDR against bandwidth, at 10 mW]")
    print("  BW MHz, then 160, 170, 180 and 190 dB")
    for bw in (1e5, 1e6, 1e7, 1e8, 1e9, 1e10):
        print(f"  {bw / 1e6:11.4f} " + row([fom - 10 * math.log10(bw / 10e-3) for fom in FOM_S], "9.4f"))
    print()

    print("[the two walls]")
    print("  aperture jitter: fin MHz, then the SNR 10, 50, 100 and 500 fs allow")
    for fin in (1e6, 1e7, 1e8, 1e9, 5e9):
        print(f"  {fin / 1e6:11.1f} " + row([calculate_jitter_limit(fin, tj) for tj in (1e-14, 5e-14, 1e-13, 5e-13)], "9.4f"))
    print("  the gain oversampling adds, which amplitudes_to_snr has built in: OSR, then dB")
    for osr in (1, 2, 8, 64, 256):
        print(f"  {osr:11d} {amplitudes_to_snr(sig_amplitude=0.5, noise_amplitude=1e-3, osr=osr) - amplitudes_to_snr(sig_amplitude=0.5, noise_amplitude=1e-3):9.4f}")
    print("  kT/C on a 1 V range: C pF, then the SNR it allows, and its ENOB")
    for cap in (0.01, 0.1, 1.0, 10.0, 100.0):
        limit = calculate_thermal_noise_limit(cap, v_fs=1.0)
        print(f"  {cap:11.2f} {limit:9.4f} {snr_to_enob(limit):9.4f}")
