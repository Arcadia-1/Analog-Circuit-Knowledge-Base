#!/usr/bin/env python3
"""Reference numbers for the "Reading the error" page, computed with ADCToolbox.

    python -m pip install -r python/requirements.txt
    python3 python/adc_error_views.py

The page ports these ADCToolbox functions to TypeScript, and tests/errors-model.test.ts checks the port against the
numbers printed here:
  fundamentals/fit_sine_4param   A cos(wt) + B sin(wt) + C at a known frequency
  aout/analyze_error_by_value    residual binned by signal value
  aout/analyze_error_by_phase    residual binned by phase, with the AM / PM / noise split
  aout/analyze_error_pdf         distribution of the residual
  aout/analyze_error_spectrum    spectrum of the residual
  siggen/nonidealities           apply_thermal_noise, apply_static_nonlinearity, apply_jitter,
                                 apply_memory_effect, apply_am_tone, apply_quantization_noise

The waveform comes from the same deterministic generator as the page, mulberry32 through Box-Muller, so both sides
analyse exactly the same samples.
"""
import contextlib
import io
import math

import numpy as np
from adctoolbox import analyze_error_by_phase, analyze_error_by_value, analyze_spectrum, fit_sine_4param

N_FFT, TEST_BIN, AMP_DBFS, FS = 4096, 613, -1.0, 100e6


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


def capture(n, bin_index=TEST_BIN, noise=0.0, k2=0.0, k3=0.0, jitter=0.0, memory=0.0, am_depth=0.0, am_bin=41, seed=5):
    """One capture through the impairments, in the order the ADCToolbox signal generator applies them."""
    codes = 2 ** n
    mid = codes / 2
    amp = mid * 10 ** (AMP_DBFS / 20)
    zj, zn = gaussians(N_FFT, seed), gaussians(N_FFT, seed + 1)
    i = np.arange(N_FFT)
    t = i + (zj * jitter * FS if jitter else 0.0)
    u = np.sin(2 * math.pi * bin_index * t / N_FFT)
    ac = amp * (u + k2 * u ** 2 + k3 * u ** 3)
    if am_depth:
        ac = ac * (1 + am_depth * np.sin(2 * math.pi * am_bin * i / N_FFT))
    x = mid + ac
    if memory:
        out = np.empty(N_FFT)
        prev_msb = 0.0
        for k in range(N_FFT):
            msb = math.floor(x[k] / codes * 16) / 16
            out[k] = codes * (msb + math.floor((x[k] / codes - msb) * 4096) / 4096 + memory * prev_msb)
            prev_msb = msb
        x = out
    return np.round(x + (zn * noise if noise else 0.0))


def spectrum(sig, n):
    with contextlib.redirect_stdout(io.StringIO()):
        return analyze_spectrum(sig - sig.mean(), fs=1.0, max_scale_range=(-2 ** (n - 1), 2 ** (n - 1)),
                                win_type="rectangular", side_bin=0, max_harmonic=5, nf_method=3, create_plot=False)


CASES = (
    ("quantisation only", {}),
    ("thermal noise 2 LSB", dict(noise=2.0)),
    ("static k2 = 1 %", dict(k2=0.01)),
    ("static k3 = 1 %", dict(k3=0.01)),
    ("jitter 2 ps", dict(jitter=2e-12)),
    ("memory 0.2 %", dict(memory=0.002)),
    ("AM tone 1 %", dict(am_depth=0.01)),
)

if __name__ == "__main__":
    n = 12
    print(" impairment            | fit amp      dc      rmse | error by value  | error by phase: am / pm / base | ENOB   SFDR")
    for name, kw in CASES:
        y = capture(n, **kw)
        fit = fit_sine_4param(y, frequency_estimate=TEST_BIN / N_FFT, max_iterations=0)
        with contextlib.redirect_stdout(io.StringIO()):
            v = analyze_error_by_value(y, norm_freq=TEST_BIN / N_FFT, n_bins=96, clip_percent=0.0,
                                       max_iterations=0, create_plot=False)
            p = analyze_error_by_phase(y, norm_freq=TEST_BIN / N_FFT, n_bins=96, max_iterations=0, create_plot=False)
        sp = spectrum(y, n)
        vm = v["error_mean"][np.isfinite(v["error_mean"])]
        print(f" {name:21s} | {fit['amplitude']:8.2f} {fit['dc_offset']:7.2f} {fit['rmse']:6.3f} | "
              f"{vm.min():6.3f} .. {vm.max():6.3f} | "
              f"{p['am_noise_rms_v']:6.3f} {p['pm_noise_rms_v']:6.3f} {p['base_noise_rms_v']:6.3f} | "
              f"{sp['enob']:6.3f} {sp['sfdr_dbc']:7.2f}")

    print()
    print("the residual on its own: its largest remaining line, and the noise floor under it")
    for name, kw in CASES:
        y = capture(n, **kw)
        fit = fit_sine_4param(y, frequency_estimate=TEST_BIN / N_FFT, max_iterations=0)
        sp = spectrum(np.asarray(fit["residuals"]), n)
        print(f"  {name:21s} largest line {sp['sig_pwr_dbfs']:7.2f} dBFS, floor {sp['noise_floor_dbfs']:7.2f} dBFS, "
              f"line over floor {sp['sig_pwr_dbfs'] - sp['noise_floor_dbfs']:6.2f} dB")
