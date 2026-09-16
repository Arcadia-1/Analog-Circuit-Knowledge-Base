#!/usr/bin/env python3
"""Reference numbers for the aliasing page, computed with ADCToolbox.

    pip install adctoolbox==0.9.1
    python3 python/adc_aliasing.py

The page ports these ADCToolbox functions to TypeScript, and tests/aliasing-model.test.ts checks the port against the
numbers printed here:
  fundamentals/frequency   fold_frequency_to_nyquist, fold_bin_to_nyquist, find_coherent_frequency
  siggen/nonidealities     apply_static_nonlinearity_hd, apply_quantization_noise, and apply_thermal_noise's sum
  spectrum/                analyze_spectrum
following the examples exp_c01 (six Nyquist zones) and exp_d00 (keeping every N-th sample without a filter).

The noise comes from the same deterministic generator as the page, mulberry32 through Box-Muller, so both sides
analyse exactly the same samples.
"""
import contextlib
import io
import math

import numpy as np
from adctoolbox import analyze_spectrum, find_coherent_frequency, fold_bin_to_nyquist, fold_frequency_to_nyquist
from adctoolbox.siggen import ADC_Signal_Generator

FS, N_FFT, N_BITS, AMP_DBFS, NOISE_LSB, SEED = 1e9, 4096, 12, -1.0, 0.3, 7


def gaussians(count, seed):
    """The standard normals of src/lib/rng.ts: mulberry32 uniforms through Box-Muller, in 32-bit unsigned arithmetic."""
    imul = lambda a, b: (a * b) & 0xFFFFFFFF
    state = seed & 0xFFFFFFFF

    def rnd():
        nonlocal state
        state = (state + 0x6D2B79F5) & 0xFFFFFFFF
        t = imul(state ^ (state >> 15), state | 1)
        t ^= (t + imul(t ^ (t >> 7), t | 61)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 2 ** 32

    out = np.zeros(count)
    for i in range(0, count, 2):
        r = math.sqrt(-2 * math.log(rnd() or 1e-12))
        u2 = rnd()
        out[i] = r * math.cos(2 * math.pi * u2)
        if i + 1 < count:
            out[i + 1] = r * math.sin(2 * math.pi * u2)
    return out


def capture(fin, keep, hd2, hd3, seed=SEED):
    """The converter's own record, keep x 4096 samples at FS, in codes: the exp_d00 chain on a 0 ... 1 V range."""
    length, lsb = keep * N_FFT, 1 / 2 ** N_BITS
    gen = ADC_Signal_Generator(N=length, Fs=FS, Fin=fin, A=0.5 * 10 ** (AMP_DBFS / 20), DC=0.5)
    sig = gen.apply_static_nonlinearity_hd(hd2_dB=hd2, hd3_dB=hd3)
    # apply_thermal_noise adds noise_rms times standard normals; these are the page's normals
    sig = sig + gaussians(length, seed) * NOISE_LSB * lsb
    return gen.apply_quantization_noise(sig, n_bits=N_BITS, quant_range=(0.0, 1.0)) / lsb


def read(codes):
    with contextlib.redirect_stdout(io.StringIO()):
        r = analyze_spectrum(codes - codes.mean(), fs=1.0, max_scale_range=(-2 ** (N_BITS - 1), 2 ** (N_BITS - 1)),
                             win_type="rectangular", side_bin=0, max_harmonic=5, nf_method=3, create_plot=False)
    return r["enob"], r["sfdr_dbc"]


def mhz(f):
    return f"{f / 1e6:9.3f}"


if __name__ == "__main__":
    # exp_c01: one output frequency, and the input of each of six zones that lands on it
    fs, lands = 1100e6, fold_frequency_to_nyquist(123e6, 1100e6)
    twins = [(i // 2 + 1) * fs - lands if i % 2 else (i // 2) * fs + lands for i in range(6)]
    print(f"fs 1100 MHz, 123 MHz lands at {lands / 1e6:.3f} MHz; so do " + ", ".join(f"{f / 1e6:.0f}" for f in twins))
    print("  folded back: " + ", ".join(f"{fold_frequency_to_nyquist(f, fs) / 1e6:.3f}" for f in twins))
    print("fold at 1 GS/s, MHz: " + ", ".join(
        f"{f / 1e6:g} -> {fold_frequency_to_nyquist(f, FS) / 1e6:g}" for f in (0, 250e6, 500e6, 750e6, 1e9, 1230e6, 2770e6, 2999e6)))
    print("fold bin in 4096: " + ", ".join(f"{b} -> {fold_bin_to_nyquist(b, N_FFT):g}" for b in (100, 2048, 3000, 4096, 5000, -100, 12345)))
    print()

    # exp_d00, widened: every keep-th sample of the converter's record, for tones in the first three Nyquist zones
    hd2, hd3 = -70.0, -60.0
    print(f"12-bit converter at 1 GS/s, -1 dBFS tone, HD2 {hd2:g} dBc, HD3 {hd3:g} dBc, {NOISE_LSB} LSB noise; MHz")
    print(" target keep |    bin    fin (MHz) |  lands at   H2 lands   H3 lands | out bin | ENOB  SFDR  at fs | ENOB  SFDR  kept")
    for target in (70e6, 140e6, 770e6, 1230e6, 2770e6):
        for keep in (1, 2, 3, 4):
            fin, m = find_coherent_frequency(FS, target, keep * N_FFT)
            fs_out = FS / keep
            codes = capture(fin, keep, hd2, hd3)
            enob_in, sfdr_in = read(codes)
            enob_out, sfdr_out = read(codes[keep - 1::keep])
            landing = " ".join(mhz(fold_frequency_to_nyquist(h * fin, fs_out)) for h in (1, 2, 3))
            print(f"{target / 1e6:7.0f} {keep:4d} | {m:6d} {mhz(fin)} | {landing} | {fold_bin_to_nyquist(m, N_FFT):7g} "
                  f"| {enob_in:6.3f} {sfdr_in:6.2f} | {enob_out:6.3f} {sfdr_out:6.2f}")
