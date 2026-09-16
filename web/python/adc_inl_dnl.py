#!/usr/bin/env python3
"""Reference numbers for the INL and DNL page, computed with ADCToolbox.

    pip install adctoolbox==0.9.1
    python3 python/adc_inl_dnl.py

The page ports these ADCToolbox functions to TypeScript, and tests/inldnl-model.test.ts checks the port against the
numbers printed here:
  aout/compute_inl_from_ramp   counts / mean(counts) - 1, INL = [0, cumsum(DNL)] at the transitions
  aout/compute_inl_from_sine   code density through -cos(pi * cumsum / total), then the same cumulative sum
  aout/_correct_inl            endpoint or best-fit reference line
  spectrum/analyze_spectrum    rectangular window, side_bin = 0, harmonics 2..5

Both estimators take a stream of codes and histogram it, so a histogram is fed in as np.repeat(code, count). The
histogram itself comes from the same deterministic generator as the page, mulberry32 through Box-Muller.
"""
import contextlib
import io
import math

import numpy as np
from adctoolbox import analyze_inl_from_ramp, analyze_inl_from_sine, analyze_spectrum

OVERDRIVE = 1.02
TEST_BIN, TEST_PHASE, N_FFT, AMP_DBFS = 613, 0.37, 4096, -0.5


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


def chip_trim(n, sigma, chip):
    """One chip's weight errors: weight j is 2^(n-1-j) unit capacitors, so its own error is sigma / sqrt(units)."""
    z = gaussians(n, 1000 * chip + 7)
    return np.array([sigma / 2 ** ((n - 1 - j) / 2) * z[j] for j in range(n)])


def transitions(n, sigma=0.0, chip=1, bow=0.0, s_curve=0.0):
    """Transition levels of a binary capacitor DAC in LSB, with per-weight errors and the two lowest INL shapes."""
    codes = 2 ** n
    w = 2.0 ** np.arange(n - 1, -1, -1) * (1 + chip_trim(n, sigma, chip))
    k = np.arange(1, codes)
    bits = ((k[:, None] >> np.arange(n - 1, -1, -1)[None, :]) & 1).astype(float)
    v = 2 * k / codes - 1
    return bits @ w - 0.5 + bow * (1 - v ** 2) + s_curve * 2.598 * v * (1 - v ** 2)


def shares(n, t, test):
    """Share of a test's samples landing in each code: code width for a ramp, arcsine steps for a full-scale sine."""
    codes = 2 ** n
    if test == "ramp":
        cdf = np.clip((t - codes / 2) / (codes * OVERDRIVE) + 0.5, 0.0, 1.0)
    else:
        cdf = 0.5 + np.arcsin(np.clip((t - codes / 2) / (codes / 2 * OVERDRIVE), -1, 1)) / math.pi
    return np.maximum(0.0, np.diff(np.concatenate(([0.0], cdf, [1.0]))))


def counts(p, total, seed):
    """Poisson counts about the expected share, Gaussian at the counts a code-density test needs."""
    lam = p * total
    return np.maximum(0, np.round(lam + np.sqrt(lam) * gaussians(len(p), seed)))


def as_codes(c):
    return np.repeat(np.arange(len(c)), c.astype(int))


def spectrum(n, t):
    codes = 2 ** n
    i = np.arange(N_FFT)
    x = codes / 2 + codes / 2 * 10 ** (AMP_DBFS / 20) * np.sin(2 * math.pi * TEST_BIN * i / N_FFT + TEST_PHASE)
    out = np.searchsorted(t, x, side="right").astype(float)
    with contextlib.redirect_stdout(io.StringIO()):
        return analyze_spectrum(out - out.mean(), fs=1.0, max_scale_range=(-codes / 2, codes / 2), win_type="rectangular",
                                side_bin=0, max_harmonic=5, nf_method=3, create_plot=False)


if __name__ == "__main__":
    n, total = 10, 2 ** 10 * 64
    print(" shape                     | true DNL min/max | true INL min/max | ramp INL min/max | sine INL min/max | missing")
    for name, kw in (("ideal", {}),
                     ("bow 2 LSB", dict(bow=2.0)),
                     ("S-curve 2 LSB", dict(s_curve=2.0)),
                     ("mismatch 1 %", dict(sigma=0.01, chip=3)),
                     ("mismatch 3 %", dict(sigma=0.03, chip=3))):
        t = transitions(n, **kw)
        width = np.maximum(0.0, np.diff(t))
        true_dnl = width / width.mean() - 1
        true_inl = np.concatenate(([0.0], np.cumsum(true_dnl)))
        true_inl -= np.linspace(true_inl[0], true_inl[-1], len(true_inl))
        out = []
        for test in ("ramp", "sine"):
            c = counts(shares(n, t, test), total, 11)
            with contextlib.redirect_stdout(io.StringIO()):
                if test == "ramp":
                    inl = analyze_inl_from_ramp(as_codes(c), num_bits=n, endpoint="endpoints", create_plot=False)["inl"]
                else:
                    r = analyze_inl_from_sine(as_codes(c), num_bits=n, clip_percent=0.0, create_plot=False)
                    inl = np.asarray(r["inl"])
                    inl = inl - np.linspace(inl[0], inl[-1], len(inl))
            out.append(inl)
        sp = spectrum(n, t)
        print(f" {name:24s} | {true_dnl.min():7.3f} {true_dnl.max():6.3f}  | {true_inl.min():7.3f} {true_inl.max():6.3f}  | "
              f"{out[0].min():7.3f} {out[0].max():6.3f}  | {out[1].min():7.3f} {out[1].max():6.3f}  | "
              f"{int((true_dnl <= -1 + 1e-9).sum()):3d}   ENOB {sp['enob']:6.3f} SFDR {sp['sfdr_dbc']:7.3f}")

    print()
    print("ramp INL of a 2 LSB bow, endpoint vs best fit, and how the estimate settles with samples per code")
    t = transitions(n, bow=2.0)
    for per_code in (16, 64, 256, 1024):
        c = counts(shares(n, t, "ramp"), 2 ** n * per_code, 11)
        with contextlib.redirect_stdout(io.StringIO()):
            end = analyze_inl_from_ramp(as_codes(c), num_bits=n, endpoint="endpoints", create_plot=False)["inl"]
            fit = analyze_inl_from_ramp(as_codes(c), num_bits=n, endpoint="fit", create_plot=False)["inl"]
        print(f"  {per_code:5d} samples/code: endpoint {end.min():7.3f} .. {end.max():6.3f} | best fit {fit.min():7.3f} .. {fit.max():6.3f}")
