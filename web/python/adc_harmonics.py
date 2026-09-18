#!/usr/bin/env python3
"""Reference numbers for the lesson on pulling the harmonics out, computed with ADCToolbox.

    python -m pip install -r python/requirements.txt
    python3 python/adc_harmonics.py

The lesson ports these ADCToolbox functions to TypeScript, and tests/harmonics-model.test.ts checks the port against
the numbers printed here:
  siggen/nonidealities   apply_static_nonlinearity, apply_static_nonlinearity_hd, apply_thermal_noise's sum,
                         apply_quantization_noise
  aout/                  analyze_decomposition_time and analyze_decomposition_polar, which share
                         decompose_harmonic_error, and fit_static_nonlin
  fundamentals/          find_coherent_frequency, fit_sine_4param with its frequency estimated from the FFT
  spectrum/              analyze_spectrum, for the harmonics the FFT reports at the same time
following the examples exp_a11 (decomposition in time), exp_a12 (in polar), exp_a25 (the spectra of each impairment)
and exp_a31 (fitting k2 and k3 back out).

The noise comes from the same deterministic generator as the lesson, mulberry32 through Box-Muller, so both sides
analyse exactly the same samples.
"""
import contextlib
import io
import math
import warnings

import numpy as np
from adctoolbox import (analyze_decomposition_polar, analyze_decomposition_time, analyze_spectrum,
                        find_coherent_frequency, fit_static_nonlin)
from adctoolbox.siggen import ADC_Signal_Generator

N, FS, AMP, DC = 4096, 1e9, 0.45, 0.5
BITS, NOISE_SEED = 14, 31
# the lesson's working point: a converter with a little curvature, a little noise, and five harmonics under Nyquist
CASES = {
    "clean": (None, None, 10e-6),
    "second": (-60.0, None, 10e-6),
    "third": (None, -60.0, 10e-6),
    "both": (-55.0, -65.0, 10e-6),
    "buried": (-70.0, -75.0, 200e-6),
}


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
TONE, TONE_BIN = find_coherent_frequency(FS, 97e6, N)


def coefficients(hd2_db, hd3_db):
    """apply_static_nonlinearity_hd's rule: k = 2^(n-1) · 10^(dBc/20) / A^(n-1)."""
    k = lambda db, order: 0.0 if db is None else (2 ** (order - 1) * 10 ** (db / 20)) / AMP ** (order - 1)
    return k(hd2_db, 2), k(hd3_db, 3)


def capture(hd2_db, hd3_db, noise_rms):
    """A coherent sine bent by a static curve, then the noise floor and the converter."""
    gen = ADC_Signal_Generator(N=N, Fs=FS, Fin=TONE, A=AMP, DC=DC)
    sig = gen.apply_static_nonlinearity_hd(gen.get_clean_signal(), hd2_dB=hd2_db, hd3_dB=hd3_db)
    return gen.apply_quantization_noise(sig + NOISE * noise_rms, n_bits=BITS, quant_range=(0.0, 1.0))


def row(values, fmt):
    return " ".join(format(v, fmt) for v in values)


if __name__ == "__main__":
    warnings.simplefilter("ignore")
    print(f"{N} samples at {FS / 1e9:g} GS/s, a {AMP} V sine on 0 ... 1 V at {TONE / 1e6:.6f} MHz (bin {TONE_BIN}), "
          f"a {BITS}-bit converter, and harmonics 2 ... 5 all below Nyquist")
    print()

    for name, (hd2, hd3, noise) in CASES.items():
        x = capture(hd2, hd3, noise)
        k2, k3 = coefficients(hd2, hd3)
        with contextlib.redirect_stdout(io.StringIO()):
            d = analyze_decomposition_time(x, harmonic=5, create_plot=False)
            p = analyze_decomposition_polar(x, harmonic=5, create_plot=False)
            s = analyze_spectrum(x, fs=FS, max_scale_range=(0.0, 1.0), win_type="rectangular", side_bin=0,
                                 max_harmonic=5, nf_method=3, create_plot=False)
        fit2, fit3 = fit_static_nonlin(x, 3)[:2]
        asked = f"HD2 {hd2:g} dBc" if hd2 is not None else "HD2 none"
        asked += f", HD3 {hd3:g} dBc" if hd3 is not None else ", HD3 none"
        print(f"{name}: {asked}, {noise * 1e6:g} uV of noise")
        print(f"  k2 set {k2:.9f}, fitted {fit2:.9f}; k3 set {k3:.9f}, fitted {fit3:.9f}")
        print(f"  decomposition, harmonics 1 ... 5")
        print(f"    magnitude {row(d['magnitudes'], '.9f')}")
        print(f"    dB        {row(d['magnitudes_db'], '9.4f')}")
        print(f"    phase rad {row(d['phases'], '9.6f')}")
        print(f"    residual rms {d['residual_rms']:.9f}, noise {d['noise_db']:.4f} dB, "
              f"fundamental at {d['fundamental_freq']:.9f} of fs")
        print(f"    polar agrees: {np.allclose(d['magnitudes'], p['magnitudes']) and np.allclose(d['phases'], p['phases'])}")
        print(f"    parts at 0, 1, 2, 100: fundamental {row(d['fundamental_signal'][[0, 1, 2, 100]], '.9f')}")
        print(f"                           harmonics   {row(d['harmonic_signal'][[0, 1, 2, 100]], '.9f')}")
        print(f"                           residual    {row(d['noise_residual'][[0, 1, 2, 100]], '.9f')}")
        print(f"  the spectrum says: SNDR {s['sndr_dbc']:.4f}, SFDR {s['sfdr_dbc']:.4f}, "
              f"harmonics {row([s['harmonics_dbc'][k] for k in range(4)], '9.4f')}")
        print(f"  samples 0 ... 3, 100, 2047: {row(x[[0, 1, 2, 3, 100, 2047]], '.9f')}")
        print()
