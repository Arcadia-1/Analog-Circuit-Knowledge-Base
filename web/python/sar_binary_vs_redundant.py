#!/usr/bin/env python3
"""Reference numbers for the binary vs redundant SAR ADC page, computed with ADCToolbox.

    pip install adctoolbox==0.9.1
    python3 python/sar_binary_vs_redundant.py

The page ports these ADCToolbox functions to TypeScript, and tests/sar-model.test.ts checks the port against the
numbers printed here:
  models: sar_convert, sar_reconstruct, sar_apply_cap_mismatch
  calibration: calibrate_weight_sine at the known training frequency, then scale_calibration_output(target_weights)
  spectrum: analyze_spectrum with a rectangular window, side_bin=0, max_harmonic=5

Redundant weights are radix-1.8 integers with largest-remainder rounding; 16 bits gives the list used in
ADCToolbox examples/05_debug_digital/exp_d16. Mismatch uses fixed standard normals Z so both sides draw the same chip.
"""
import contextlib
import io
import math

import numpy as np
from adctoolbox import analyze_spectrum, calibrate_weight_sine, scale_calibration_output
from adctoolbox.models import sar_apply_cap_mismatch, sar_convert, sar_reconstruct

N_FFT, TRAIN_BIN, TEST_BIN, TEST_PHASE, AMP_DBFS = 4096, 499, 613, 0.37, -0.5
ADCTOOLBOX_RADIX18_16BIT = [29127, 16182, 8990, 4995, 2775, 1542, 856, 476, 264, 147, 82, 45, 25, 14, 8, 4, 2, 1]


def binary_weights(n):
    return [2 ** (n - 1 - j) for j in range(n)]


def redundant_weights(n, r=1.8):
    target = 2 ** n - 1
    m = int(n * math.log(2) / math.log(r))
    c = target * (r - 1) / (r ** m - 1)
    exact = [c * r ** (m - 1 - j) for j in range(m)]
    w = [math.floor(e) for e in exact]
    for j in sorted(range(m), key=lambda j: exact[j] - w[j], reverse=True)[: target - sum(w)]:
        w[j] += 1
    return w


def z_fixed(m):
    """Deterministic stand-in for standard normal draws, shared with the TypeScript tests."""
    return np.array([1.5 * math.sin(2.3 * j + 0.9) for j in range(m)])


class FixedNormals:
    def __init__(self, z):
        self.z = z

    def standard_normal(self, size):
        return self.z[:size]


def tone(bin_index, phase=0.0):
    k = np.arange(N_FFT)
    return 0.5 + 0.5 * 10 ** (AMP_DBFS / 20) * np.sin(2 * math.pi * bin_index * k / N_FFT + phase)


def spectrum(trace):
    with contextlib.redirect_stdout(io.StringIO()):
        return analyze_spectrum(trace - trace.mean(), fs=1.0, max_scale_range=(-0.5, 0.5), win_type="rectangular",
                                side_bin=0, max_harmonic=5, nf_method=3, create_plot=False)


def case(raw, n, sigma):
    raw = np.array(raw, dtype=float)
    nominal = raw / (raw.sum() + raw[-1])
    actual = sar_apply_cap_mismatch(nominal, sigma=sigma, rng=FixedNormals(z_fixed(len(raw)))) if sigma else nominal
    train = sar_convert(tone(TRAIN_BIN), actual)
    test = sar_convert(tone(TEST_BIN, TEST_PHASE), actual)
    with contextlib.redirect_stdout(io.StringIO()):
        fit = calibrate_weight_sine(train, freq=TRAIN_BIN / N_FFT, nominal_weights=nominal)
    calibrated = np.asarray(scale_calibration_output(fit, target_weights=nominal)["weight"])
    before = spectrum(sar_reconstruct(test, nominal))
    after = spectrum(test.astype(float) @ calibrated)
    dc = sar_convert(np.array([0.7434]), actual)[0].astype(float)
    return dict(before=before, after=after, calibrated=calibrated * 2 ** n, actual=actual * 2 ** n,
                code=dc @ nominal * 2 ** n, code_cal=dc @ calibrated * 2 ** n)


if __name__ == "__main__":
    assert redundant_weights(16) == ADCTOOLBOX_RADIX18_16BIT
    for n in (8, 10, 12, 14, 16):
        w = redundant_weights(n)
        print(f"N={n:2d} redundant weights ({len(w)}): {w}")
    print()
    print(" N  sigma  arch       | before ENOB  SFDR | after ENOB  SFDR | max |w_cal - w_actual| LSB | DC code nominal / calibrated")
    for n, sigma in ((12, 0.0), (12, 0.10), (16, 0.10)):
        for name, raw in (("binary", binary_weights(n)), ("redundant", redundant_weights(n))):
            r = case(raw, n, sigma)
            b, a = r["before"], r["after"]
            werr = np.max(np.abs(r["calibrated"] - r["actual"]))
            print(f"{n:2d} {sigma * 100:4.0f}%  {name:9s} | {b['enob']:10.4f} {b['sfdr_dbc']:7.3f} | {a['enob']:9.4f} {a['sfdr_dbc']:7.3f} | "
                  f"{werr:12.4f} | {r['code']:.4f} / {r['code_cal']:.4f}")
