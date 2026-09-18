#!/usr/bin/env python3
"""Reference numbers for the lesson on how long a record has to be, computed with ADCToolbox.

    python -m pip install -r python/requirements.txt
    python3 python/adc_record_length.py

The lesson ports these ADCToolbox functions to TypeScript, and tests/record-model.test.ts checks the port against the
numbers printed here:
  spectrum/              analyze_spectrum, with the window and the side-bin detection it uses by default
  models/sar.py          sar_convert, sar_reconstruct, sar_ideal_weights
  fundamentals/          snr_to_enob and enob_to_snr, to set the noise that hits a target ENOB
following the examples exp_s13 (a Monte Carlo sweep of FFT length against SFDR and SNDR), exp_s09 (the same tone just
below Nyquist at short even and odd record lengths) and exp_s01-exp_s05, which are the single-capture calls under them.

The noise comes from the same deterministic generator as the lesson, mulberry32 through Box-Muller, so both sides
analyse exactly the same samples.
"""
import contextlib
import io
import math
import warnings

import numpy as np
from adctoolbox import analyze_spectrum, enob_to_snr, snr_to_enob
from adctoolbox.models import sar_convert, sar_ideal_weights, sar_reconstruct

FS = 800e6
AMP, DC = 0.49, 0.5
BITS, TARGET_ENOB = 10, 9.0
HD3_DBC = -80.0
FIN_RATIO = 0.123
RUNS = 16
SEED = 20260604
# exp_s13 sweeps 2^4 ... 2^16; the lesson stops at 2^14, which is all a browser needs to show the shape
LENGTHS = [2 ** p for p in range(4, 15)]
# exp_s09's short records, even and odd, with the tone just below Nyquist
SHORT = [4, 5, 8, 9, 16, 17, 32, 33, 64, 65, 128, 129, 256, 257]
SAR_BITS = 4


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


def coherent_odd_bin(n_fft, ratio=FIN_RATIO):
    """exp_s13's bin: the nearest to ratio · fs, nudged to an odd one so the harmonics keep clear of it."""
    k = int(round(ratio * n_fft))
    k = min(max(k, 1), n_fft // 2 - 1)
    if k % 2 == 0:
        k += 1 if k + 1 < n_fft // 2 else -1
    return max(k, 1)


def near_nyquist_bin(n_fft):
    """exp_s09's bin: the last one below Nyquist, which is N/2 - 1 for an even record and N//2 for an odd one."""
    return max(1, n_fft // 2 - 1) if n_fft % 2 == 0 else n_fft // 2


def noise_rms_for_enob(enob=TARGET_ENOB, bits=BITS, amp=AMP):
    """The input noise that, on top of an ideal quantiser's own, brings a capture to this many effective bits."""
    total = (amp ** 2 / 2) / 10 ** (enob_to_snr(enob) / 10)
    return math.sqrt(max(total - (1 / 2 ** bits) ** 2 / 12, 0.0))


def quantise(v, bits):
    """An ideal converter on 0 ... 1: exactly what sar_convert and sar_reconstruct do with ideal weights."""
    return np.floor(np.clip(v, 0.0, np.nextafter(1.0, 0.0)) * 2 ** bits) / 2 ** bits


def capture(n_fft, run, noise_rms, hd3_dbc=HD3_DBC, bits=BITS):
    """exp_s13's capture: a coherent tone with a third harmonic at a fixed level, noise, and the converter."""
    bin_ = coherent_odd_bin(n_fft)
    i = np.arange(n_fft)
    hd3 = AMP * 10 ** (hd3_dbc / 20)
    clean = DC + AMP * np.sin(2 * np.pi * bin_ * i / n_fft) + hd3 * np.sin(2 * np.pi * 3 * bin_ * i / n_fft)
    return quantise(clean + gaussians(n_fft, SEED + 1009 * run + n_fft) * noise_rms, bits)


def read(x):
    with contextlib.redirect_stdout(io.StringIO()):
        r = analyze_spectrum(x, fs=FS, max_scale_range=(0.0, 1.0), create_plot=False, show_label=False)
    return r["sndr_dbc"], r["sfdr_dbc"], r["enob"]


def summary(values):
    a = np.asarray(values)
    return a.mean(), a.std(ddof=1), a.min(), a.max()


def row(values, fmt):
    return " ".join(format(v, fmt) for v in values)


if __name__ == "__main__":
    warnings.simplefilter("ignore")
    noise = noise_rms_for_enob()
    hd3 = AMP * 10 ** (HD3_DBC / 20)
    print(f"a {BITS}-bit converter at {FS / 1e6:g} MS/s, a {AMP} V tone at {FIN_RATIO:g} of fs with a third harmonic "
          f"{-HD3_DBC:g} dB down ({hd3 * 1e6:.4f} uV), and enough noise for {TARGET_ENOB:g} effective bits "
          f"({noise * 1e6:.6f} uV rms)")
    print(f"analyze_spectrum is left at its defaults, the Hann window and the side bins it detects itself; "
          f"{RUNS} captures at each length")
    print()

    print("[FFT length against what it measures: N, bin, then SFDR mean, sigma, min, max, then SNDR the same way]")
    for n_fft in LENGTHS:
        sfdr, sndr = [], []
        for run in range(RUNS):
            s, f, _ = read(capture(n_fft, run, noise))
            sndr.append(s)
            sfdr.append(f)
        print(f"  {n_fft:7d} {coherent_odd_bin(n_fft):6d} " + row(summary(sfdr), "9.4f") + "  " + row(summary(sndr), "9.4f"))
    print()

    print("[one capture at 4096, for the spectrum the page draws]")
    x = capture(4096, 0, noise)
    sndr, sfdr, enob = read(x)
    print(f"  SNDR {sndr:.4f}, SFDR {sfdr:.4f}, ENOB {enob:.4f}, {snr_to_enob(sndr):.4f} bits of SNDR")
    print(f"  samples 0 ... 3, 100, 2047: {row(x[[0, 1, 2, 3, 100, 2047]], '.9f')}")
    print()

    print(f"[exp_s09, a {SAR_BITS}-bit SAR just below Nyquist: N, bin, SNDR, SFDR, ENOB]")
    w = sar_ideal_weights(SAR_BITS)
    ideal = True
    for n_fft in SHORT:
        b = near_nyquist_bin(n_fft)
        vin = DC + AMP * np.sin(2 * np.pi * b * np.arange(n_fft) / n_fft)
        aout = sar_reconstruct(sar_convert(vin, w, quant_range=(0.0, 1.0)), w, quant_range=(0.0, 1.0))
        ideal = ideal and np.allclose(aout, quantise(vin, SAR_BITS))
        with contextlib.redirect_stdout(io.StringIO()):
            r = analyze_spectrum(aout, fs=FS, max_scale_range=(0.0, 1.0), win_type="rectangular", nf_method=3,
                                 create_plot=False, show_label=False)
        print(f"  {n_fft:5d} {b:5d} {r['sndr_dbc']:9.4f} {r['sfdr_dbc']:9.4f} {r['enob']:8.4f}")
    print(f"  an ideal SAR is a plain floor quantiser at every one of these lengths: {ideal}")
