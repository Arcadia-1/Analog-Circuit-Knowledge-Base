#!/usr/bin/env python3
"""Reference numbers for the coherent-sampling page, computed with ADCToolbox.

    python -m pip install -r python/requirements.txt
    python3 python/adc_coherent_sampling.py

The page uses the same spectrum port as the other converter pages (src/lib/spectrum.ts, from
spectrum/compute_spectrum and spectrum/_window) but drives it with a perfect converter, so every number is a property
of the FFT rather than of the ADC. tests/coherence-model.test.ts checks the port against the numbers printed here.
"""
import contextlib
import io
import math

import numpy as np
from adctoolbox import analyze_spectrum
from adctoolbox.spectrum._window import _SIDE_BIN_DEFAULTS

TONE, AMP_DBFS = 613 / 4096, -1.0
# the table src/lib/spectrum.ts copies as SIDE_BINS; read from the library so a change there shows in the output
SIDE_BINS = {w: _SIDE_BIN_DEFAULTS[w]["coherent"] for w in ("rectangular", "hann", "blackmanharris", "flattop")}


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


def base_cycles(length):
    k = round(length * TONE)
    return k if k % 2 else k + 1


def capture(n, length, cycles, noise=0.0, seed=3):
    codes = 2 ** n
    mid = codes / 2
    amp = mid * 10 ** (AMP_DBFS / 20)
    i = np.arange(length)
    x = mid + amp * np.sin(2 * math.pi * cycles * i / length)
    if noise:
        x = x + gaussians(length, seed) * noise
    return np.round(x)


def read(sig, n, win, side_bin):
    with contextlib.redirect_stdout(io.StringIO()):
        return analyze_spectrum(sig - sig.mean(), fs=1.0, max_scale_range=(-2 ** (n - 1), 2 ** (n - 1)),
                                win_type=win, side_bin=side_bin, max_harmonic=5, nf_method=3, create_plot=False)


if __name__ == "__main__":
    n, length, noise = 12, 4096, 0.0
    base = base_cycles(length)
    print(f"{n} bits, {length}-point record, tone at {base} cycles, no added noise")
    print("side bins counted as signal: " + ", ".join(f"{w} {side}" for w, side in SIDE_BINS.items()))
    print(" offset | " + " | ".join(f"{w:>14s}" for w in SIDE_BINS))
    print("        | " + " | ".join(f"{'ENOB':>6s} {'SFDR':>7s}" for _ in SIDE_BINS))
    for offset in (0.0, 0.1, 0.25, 0.5):
        cells = []
        for win, side in SIDE_BINS.items():
            r = read(capture(n, length, base + offset), n, win, side)
            cells.append(f"{r['enob']:6.3f} {r['sfdr_dbc']:7.2f}")
        print(f"  {offset:4.2f}  | " + " | ".join(cells))

    print()
    print("record length, coherent, rectangular window: the floor per bin drops but the total does not")
    for length in (256, 1024, 4096, 16384):
        b = base_cycles(length)
        r = read(capture(n, length, b), n, "rectangular", 0)
        print(f"  {length:6d} points, {b:5d} cycles: ENOB {r['enob']:6.3f}  SFDR {r['sfdr_dbc']:7.2f}  "
              f"noise floor {r['noise_floor_dbfs']:8.2f} dBFS")
