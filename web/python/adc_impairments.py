#!/usr/bin/env python3
"""Reference numbers for the lesson on what sets a converter's floor, computed with ADCToolbox.

    python -m pip install -r python/requirements.txt
    python3 python/adc_impairments.py

The lesson ports these ADCToolbox functions to TypeScript, and tests/impairments-model.test.ts checks the port against
the numbers printed here:
  siggen/nonidealities   apply_thermal_noise's sum, apply_jitter, apply_quantization_noise, apply_incomplete_sampling,
                         apply_memory_effect, apply_am_tone
  aout/                  analyze_error_by_phase, and fit_sine_4param under it
  fundamentals/          find_coherent_frequency, amplitudes_to_snr, calculate_jitter_limit, snr_to_enob
  spectrum/              analyze_spectrum
following the examples exp_g01 (thermal noise), exp_g03 (resolution), exp_g04 and exp_a04 (jitter, and measuring it
back), exp_g06 (settling and memory) and exp_g07 (an interfering tone).

The noise and the jitter come from the same deterministic generator as the lesson, mulberry32 through Box-Muller, so
both sides analyse exactly the same samples.
"""
import contextlib
import io
import math
import warnings

import numpy as np
from adctoolbox import (amplitudes_to_snr, analyze_error_by_phase, analyze_spectrum, calculate_jitter_limit,
                        find_coherent_frequency, snr_to_enob)
from adctoolbox.siggen import ADC_Signal_Generator

N, FS, AMP, DC = 4096, 1e9, 0.45, 0.5
BASE_NOISE, BITS = 10e-6, 14
NOISE_SEED, JITTER_SEED = 31, 32
# the interfering tone of exp_g07, moved onto a bin of its own
AM_BIN = 41


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


NOISE = gaussians(N, NOISE_SEED)
JITTER = gaussians(N, JITTER_SEED)
TONE, TONE_BIN = find_coherent_frequency(FS, 97e6, N)

# kind: the strengths swept, and the one the lesson opens at
SWEEPS = {
    "thermal": ([1e-6, 2e-6, 5e-6, 1e-5, 2e-5, 5e-5, 1e-4, 2e-4, 5e-4, 1e-3], 5e-5),
    "quantiser": ([4, 6, 8, 10, 11, 12, 13, 14, 15, 16], 12),
    "jitter": ([1e-15, 2e-15, 5e-15, 1e-14, 2e-14, 5e-14, 1e-13, 2e-13, 5e-13, 1e-12], 1e-13),
    "settling": ([0.0, 0.02, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5], 0.15),
    "memory": ([0.0, 0.0005, 0.001, 0.002, 0.005, 0.009, 0.02], 0.005),
    "interferer": ([0.0, 0.0001, 0.0003, 0.001, 0.003, 0.01, 0.03], 0.003),
}


def capture(kind, strength, fin=None):
    """A coherent sine through one impairment, then the noise floor and the converter, as the examples chain them."""
    fin = TONE if fin is None else fin
    gen = ADC_Signal_Generator(N=N, Fs=FS, Fin=fin, A=AMP, DC=DC)
    if kind == "jitter":
        # apply_jitter regenerates the sine at the moments the clock actually struck; these are the lesson's normals
        t = np.arange(N) / FS + JITTER * strength
        sig = AMP * np.sin(2 * np.pi * fin * t) + DC
    else:
        sig = gen.get_clean_signal()
    if kind == "settling":
        sig = gen.apply_incomplete_sampling(sig, coeff_k=strength)
    elif kind == "memory":
        sig = gen.apply_memory_effect(sig, memory_strength=strength)
    elif kind == "interferer":
        sig = gen.apply_am_tone(sig, am_tone_freq=AM_BIN * FS / N, am_tone_depth=strength)
    # apply_thermal_noise adds noise_rms times standard normals; these are the lesson's normals
    sig = sig + NOISE * (strength if kind == "thermal" else BASE_NOISE)
    bits = int(strength) if kind == "quantiser" else BITS
    return gen.apply_quantization_noise(sig, n_bits=bits, quant_range=(0.0, 1.0))


def read(x):
    with contextlib.redirect_stdout(io.StringIO()):
        r = analyze_spectrum(x, fs=FS, max_scale_range=(0.0, 1.0), win_type="rectangular", side_bin=0,
                             max_harmonic=5, nf_method=3, create_plot=False)
    return r["sndr_dbc"], r["snr_dbc"], r["sfdr_dbc"], r["enob"]


def limit(kind, strength, fin=None):
    """The SNR each impairment allows at best: none of the three has anything to do with the others."""
    fin = TONE if fin is None else fin
    if kind == "thermal":
        return amplitudes_to_snr(sig_amplitude=AMP, noise_amplitude=strength)
    if kind == "quantiser":
        return amplitudes_to_snr(sig_amplitude=AMP, noise_amplitude=(1 / 2 ** int(strength)) / math.sqrt(12))
    if kind == "jitter":
        return float(calculate_jitter_limit(fin, strength))
    return float("nan")


def split(x, fin=None):
    """analyze_error_by_phase: how much of the residual rides on the signal, on its slope, and on neither."""
    fin = TONE if fin is None else fin
    with contextlib.redirect_stdout(io.StringIO()):
        r = analyze_error_by_phase(x, norm_freq=fin / FS, n_bins=96, include_base_noise=True, create_plot=False)
    return r["am_noise_rms_v"], r["pm_noise_rms_v"], r["pm_noise_rms_rad"], r["base_noise_rms_v"]


def row(values, fmt):
    return " ".join(format(v, fmt) for v in values)


if __name__ == "__main__":
    warnings.simplefilter("ignore")
    print(f"{N} samples at {FS / 1e9:g} GS/s, a {AMP} V sine on 0 ... 1 V at {TONE / 1e6:.6f} MHz (bin {TONE_BIN}), "
          f"{BASE_NOISE * 1e6:g} uV of noise and a {BITS}-bit converter behind every impairment")
    print()

    for kind, (strengths, default) in SWEEPS.items():
        print(f"{kind}: strength, then SNDR, SNR, SFDR, ENOB, and the SNR the impairment alone would allow")
        for s in strengths:
            sndr, snr, sfdr, enob = read(capture(kind, s))
            allowed = limit(kind, s)
            print(f"  {s:11.6g} {sndr:9.4f} {snr:9.4f} {sfdr:9.4f} {enob:8.4f} "
                  + ("      -" if math.isnan(allowed) else f"{allowed:9.4f}"))
        x = capture(kind, default)
        am, pm, rad, base = split(x)
        sndr, snr, sfdr, enob = read(x)
        print(f"  at {default:g}: SNDR {sndr:.4f}, SNR {snr:.4f}, SFDR {sfdr:.4f}, ENOB {enob:.4f}, "
              f"{snr_to_enob(snr):.4f} bits of SNR")
        print(f"  error by phase: am {am:.9f} V, pm {pm:.9f} V ({rad:.9f} rad), base {base:.9f} V")
        if kind == "jitter":
            print(f"  jitter recovered from the pm noise: {rad / (2 * math.pi * TONE) * 1e15:.4f} fs, set {default * 1e15:g} fs")
        spec = [x[k] for k in (0, 1, 2, 3, 100, 2047)]
        print(f"  samples 0 ... 3, 100, 2047: {row(spec, '.9f')}")
        print()

    print("jitter recovered across the sweep, fs: set, then recovered")
    for s in SWEEPS["jitter"][0]:
        _, _, rad, _ = split(capture("jitter", s))
        print(f"  {s * 1e15:11.4f} {rad / (2 * math.pi * TONE) * 1e15:11.4f}")
    print()

    print("the limits against input frequency: fin MHz, jitter 100 fs, thermal 50 uV, 12 bits")
    for target in (10e6, 30e6, 97e6, 200e6, 400e6):
        fin, _ = find_coherent_frequency(FS, target, N)
        print(f"  {fin / 1e6:11.6f} {limit('jitter', 1e-13, fin):9.4f} {limit('thermal', 5e-5, fin):9.4f} "
              f"{limit('quantiser', 12, fin):9.4f}")
