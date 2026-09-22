#!/usr/bin/env python3
"""Reference numbers for the binary vs redundant SAR ADC page, computed with ADCToolbox.

    python -m pip install -r python/requirements.txt
    python3 python/sar_binary_vs_redundant.py

The page ports these ADCToolbox functions to TypeScript, and tests/sar-model.test.ts checks the port against the
numbers printed here:
  models: sar_convert, sar_reconstruct, sar_apply_cap_mismatch
  calibration: calibrate_weight_sine on a full independent record at the known training frequency, then
               scale_calibration_output(target_weights); the known-zero mismatch case retains nominal weights
  spectrum: analyze_spectrum with a rectangular window, side_bin=0, max_harmonic=5

Redundant weights come from the nominal resolution alone, see redundant_weights(). ADCToolbox's own 16-bit example
set (examples/05_debug_digital/exp_d16) is the same family without the margin cap, printed below for comparison.
Mismatch uses fixed standard normals Z so both sides draw the same chip.
"""
import contextlib
import io
import math

import numpy as np
from adctoolbox import analyze_spectrum, calibrate_weight_sine, scale_calibration_output
from adctoolbox.models import sar_apply_cap_mismatch, sar_convert, sar_reconstruct

N_FFT, N_TRAIN, TRAIN_BIN, TEST_BIN, TEST_PHASE, AMP_DBFS, FS = 4096, 4096, 499, 613, 0.37, -0.5, 100e6
ADCTOOLBOX_RADIX18_16BIT = [29127, 16182, 8990, 4995, 2775, 1542, 856, 476, 264, 147, 82, 45, 25, 14, 8, 4, 2, 1]


def binary_weights(n):
    return [2 ** (n - 1 - j) for j in range(n)]


RADIX = 1.8


def comparisons(n):
    """The fewest comparisons whose radix 2^(n/m) does not exceed RADIX."""
    return math.ceil(n * math.log(2) / math.log(RADIX))


def redundant_weights(n, m=None):
    """Geometric with radix 2^(n/m), summing to 2^n - 1, each weight capped by the sum of the ones after it so every
    comparison but the last keeps at least one LSB of margin. The cap binds at the bottom: the tail is 4 2 1 1."""
    m = m or comparisons(n)
    p = 2 ** (n / m)
    w = [0] * m
    rest = 0
    for j in range(m - 1, 0, -1):
        w[j] = 1 if j == m - 1 else min(round((p - 1) * p ** (m - 1 - j)), rest)
        rest += w[j]
    w[0] = 2 ** n - 1 - rest
    return w


def margins(w):
    return [sum(w[j + 1:]) + w[-1] - w[j] for j in range(len(w))]


def z_fixed(m):
    """Deterministic stand-in for standard normal draws, shared with the TypeScript tests."""
    return np.array([1.5 * math.sin(2.3 * j + 0.9) for j in range(m)])


class FixedNormals:
    def __init__(self, z):
        self.z = z

    def standard_normal(self, size):
        return self.z[:size]


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


def tone(bin_index, n, phase=0.0, jitter_ps=0.0, count=N_FFT):
    """A coherent sine, sampled at t + dt when the clock jitters (ADCToolbox siggen.apply_jitter), offset by the half
    unit of the terminating capacitor so the decision levels sit half an LSB below the code levels."""
    k = np.arange(count)
    if jitter_ps:
        k = k + gaussians(2 * N_FFT, 7)[:count] * jitter_ps * 1e-12 * FS
    return 0.5 + 0.5 * 2 ** -n + 0.5 * 10 ** (AMP_DBFS / 20) * np.sin(2 * math.pi * bin_index * k / N_FFT + phase)


def spectrum(trace):
    with contextlib.redirect_stdout(io.StringIO()):
        return analyze_spectrum(trace - trace.mean(), fs=1.0, max_scale_range=(-0.5, 0.5), win_type="rectangular",
                                side_bin=0, max_harmonic=5, nf_method=3, create_plot=False)


def case(raw, n, sigma, jitter_ps=0.0, mismatch_normals=None):
    raw = np.array(raw, dtype=float)
    nominal = raw / (raw.sum() + raw[-1])
    z = z_fixed(len(raw)) if mismatch_normals is None else mismatch_normals
    actual = sar_apply_cap_mismatch(nominal, sigma=sigma, rng=FixedNormals(z)) if sigma else nominal
    train = sar_convert(tone(TRAIN_BIN, n, count=N_TRAIN), actual)
    test = sar_convert(tone(TEST_BIN, n, TEST_PHASE, jitter_ps), actual)
    if sigma == 0:
        # The simulator knows there is no weight error. A finite unconstrained fit would only learn quantisation error.
        calibrated = nominal.copy()
    else:
        with contextlib.redirect_stdout(io.StringIO()):
            fit = calibrate_weight_sine(train, freq=TRAIN_BIN / N_FFT, nominal_weights=nominal)
        calibrated = np.asarray(scale_calibration_output(fit, target_weights=nominal)["weight"])
    before = spectrum(sar_reconstruct(test, nominal))
    after = spectrum(test.astype(float) @ calibrated)
    dc = sar_convert(np.array([0.7434 + 0.5 * 2.0 ** -n]), actual)[0].astype(float)
    return dict(before=before, after=after, calibrated=calibrated * 2 ** n, actual=actual * 2 ** n,
                code=dc @ nominal * 2 ** n, code_cal=dc @ calibrated * 2 ** n)


if __name__ == "__main__":
    print(f"ADCToolbox exp_d16, radix 1.8 without the margin cap ({len(ADCTOOLBOX_RADIX18_16BIT)}): "
          f"{ADCTOOLBOX_RADIX18_16BIT}, margins {margins(ADCTOOLBOX_RADIX18_16BIT)[-5:]}")
    for n in (8, 10, 12, 14, 16):
        w = redundant_weights(n)
        print(f"N={n:2d} redundant weights ({len(w)}, radix {2 ** (n / len(w)):.3f}): {w}")
        assert min(margins(w)[:-1]) >= 1 and w[-1] == 1 and all(w[j] >= w[j + 1] for j in range(len(w) - 1))
    print()
    print(f"Calibration uses {N_TRAIN} samples; every result below is measured on an independent {N_FFT}-sample record.")
    print(" N  sigma  arch       | before ENOB  SFDR | after ENOB  SFDR | max |w_cal - w_actual| LSB | DC code nominal / calibrated")
    for n, sigma in ((12, 0.0), (12, 0.10), (16, 0.10)):
        for name, raw in (("binary", binary_weights(n)), ("redundant", redundant_weights(n))):
            r = case(raw, n, sigma)
            b, a = r["before"], r["after"]
            werr = np.max(np.abs(r["calibrated"] - r["actual"]))
            print(f"{n:2d} {sigma * 100:4.0f}%  {name:9s} | {b['enob']:10.4f} {b['sfdr_dbc']:7.3f} | {a['enob']:9.4f} {a['sfdr_dbc']:7.3f} | "
                  f"{werr:12.4f} | {r['code']:.4f} / {r['code_cal']:.4f}")
    print()
    print("Page default, 12 bits, 10% mismatch, chip 43, no comparator noise or jitter")
    for i, (name, raw) in enumerate((("binary", binary_weights(12)), ("redundant", redundant_weights(12)))):
        r = case(raw, 12, 0.10, mismatch_normals=gaussians(len(raw), 43000 + i))
        print(f"  {name:9s}: after ENOB {r['after']['enob']:.4f}, SFDR {r['after']['sfdr_dbc']:.4f} dB")
    print()
    f_in = TEST_BIN / N_FFT * FS
    print(f"clock jitter at f_in = {f_in / 1e6:.3f} MHz, 12 bits, ideal capacitors")
    for jitter_ps in (0.0, 2.0, 5.0):
        r = case(binary_weights(12), 12, 0.0, jitter_ps)
        theory = -20 * math.log10(2 * math.pi * f_in * jitter_ps * 1e-12) if jitter_ps else math.inf
        print(f"  {jitter_ps:3.1f} ps: ENOB {r['before']['enob']:7.4f}  SNDR {r['before']['sndr_dbc']:7.3f} dB  "
              f"(jitter alone allows {theory:.2f} dB)")
