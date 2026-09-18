#!/usr/bin/env python3
"""Reference numbers for the page on averaging and the polar spectrum, computed with ADCToolbox.

    python -m pip install -r python/requirements.txt
    python3 python/adc_polar_averaging.py

The page ports these ADCToolbox functions to TypeScript, and tests/polar-model.test.ts checks the port against the
numbers printed here:
  spectrum/   compute_spectrum over several runs, power-averaged and coherently averaged (as analyze_spectrum and
              analyze_spectrum_polar call it), with its phase alignment, harmonic bookkeeping and noise-floor estimate
  fundamentals/  find_coherent_frequency
following the examples exp_s07 (power against coherent averaging), exp_s10 (the polar plot), exp_s11 (static curvature
against a memory effect) and exp_s12 (the polar plot, averaged).

The phases and the noise come from the same deterministic generator as the page, mulberry32 through Box-Muller, so
both sides analyse exactly the same samples.
"""
import math

import numpy as np
from adctoolbox import find_coherent_frequency
from adctoolbox.spectrum.compute_spectrum import compute_spectrum

N, FS, AMP, DC = 1024, 100e6, 0.499, 0.5
PHASE_SEED, NOISE_SEED = 21, 22
HARMONICS = 5
CHECKPOINTS = [1, 2, 3, 5, 7, 10, 15, 20, 30, 50, 70, 100]


def mulberry32(seed):
    """src/lib/rng.ts's uniform generator, in 32-bit unsigned arithmetic."""
    imul = lambda a, b: (a * b) & 0xFFFFFFFF
    state = seed & 0xFFFFFFFF

    def rnd():
        nonlocal state
        state = (state + 0x6D2B79F5) & 0xFFFFFFFF
        t = imul(state ^ (state >> 15), state | 1)
        t ^= (t + imul(t ^ (t >> 7), t | 61)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 2 ** 32

    return rnd


def gaussians(count, seed):
    """The standard normals of src/lib/rng.ts: mulberry32 uniforms through Box-Muller."""
    rnd = mulberry32(seed)
    out = np.zeros(count)
    for i in range(0, count, 2):
        r = math.sqrt(-2 * math.log(rnd() or 1e-12))
        u2 = rnd()
        out[i] = r * math.cos(2 * math.pi * u2)
        if i + 1 < count:
            out[i + 1] = r * math.sin(2 * math.pi * u2)
    return out


def uniforms(count, seed):
    rnd = mulberry32(seed)
    return np.array([rnd() for _ in range(count)])


PHASES = uniforms(100, PHASE_SEED) * 2 * np.pi
NOISE = gaussians(100 * (N + 1), NOISE_SEED).reshape(100, N + 1)


def static_runs(fin, runs, hd2, hd3, sign, noise):
    """exp_s07 and exp_s12: a sine at a random phase per run through x + k2 x^2 + k3 x^3, plus noise; an HD of None
    leaves that term out."""
    t = np.arange(N) / FS
    k2 = 10 ** (hd2 / 20) / (AMP / 2) if hd2 is not None else 0.0
    k3 = sign * 10 ** (hd3 / 20) / (AMP ** 2 / 4) if hd3 is not None else 0.0
    out = np.zeros((runs, N))
    for r in range(runs):
        x = AMP * np.sin(2 * np.pi * fin * t + PHASES[r])
        out[r] = x + k2 * x ** 2 + k3 * x ** 3 + NOISE[r, :N] * noise
    return out


def memory_runs(fin, runs, strength, noise):
    """exp_s11's memory effect: a 4-bit coarse code and an 18-bit fine one, and a share of the previous sample's coarse
    code added to each output, at a random phase per run."""
    t = np.arange(N + 1) / FS
    out = np.zeros((runs, N))
    for r in range(runs):
        x = AMP * np.sin(2 * np.pi * fin * t + PHASES[r]) + DC + NOISE[r] * noise
        msb = np.floor(x * 2 ** 4) / 2 ** 4
        lsb = np.floor((x - msb) * 2 ** 18) / 2 ** 18
        out[r] = msb[1:] + lsb[1:] + strength * msb[:-1]
    return out


def read(data, coherent):
    r = compute_spectrum(data, fs=FS, win_type="boxcar", coherent_averaging=coherent, max_harmonic=HARMONICS)
    m, p = r["metrics"], r["plot_data"]
    return r, m, p


def row(values, fmt):
    return " ".join(format(v, fmt) for v in values)


CASES = [
    # name, kind, target Hz, runs, parameters, noise
    ("s12 one run", "static", 5e6, 1, (-80.0, -73.0, 1), 100e-6),
    ("s12 ten runs", "static", 5e6, 10, (-80.0, -73.0, 1), 100e-6),
    ("s12 hundred runs", "static", 5e6, 100, (-80.0, -73.0, 1), 100e-6),
    ("s11 k3 < 0", "static", 13e6, 10, (None, -66.0, -1), 50e-6),
    ("s07 levels", "static", 5e6, 30, (-100.0, -90.0, 1), 100e-6),
    ("memory 5 MHz", "memory", 5e6, 1, (0.02,), 50e-6),
    ("memory 20 MHz", "memory", 20e6, 10, (0.02,), 50e-6),
    ("memory 37 MHz", "memory", 37e6, 1, (0.05,), 200e-6),
]


def make(kind, fin, runs, params, noise):
    return static_runs(fin, runs, *params, noise) if kind == "static" else memory_runs(fin, runs, *params, noise)


if __name__ == "__main__":
    print(f"{N} samples at {FS / 1e6:g} MHz, a {AMP} V sine, rectangular window, harmonics 2 ... {HARMONICS}")
    print()
    for name, kind, target, runs, params, noise in CASES:
        fin, bin_ = find_coherent_frequency(FS, target, N)
        data = make(kind, fin, runs, params, noise)
        print(f"{name}: {kind} {params}, noise {noise * 1e6:g} uV, {runs} runs, fin {fin / 1e6:.6f} MHz (bin {bin_})")
        for coherent in (False, True):
            r, m, p = read(data, coherent)
            label = "coherent" if coherent else "power   "
            print(f"  {label} bin {p['fundamental_bin']} at {p['fundamental_bin_fractional']:.6f}, side {p['side_bin']}, "
                  f"signal {m['sig_pwr_dbfs']:.4f} dBFS, SNDR {m['sndr_dbc']:.4f}, SNR {m['snr_dbc']:.4f}, "
                  f"THD {m['thd_dbc']:.4f}, SFDR {m['sfdr_dbc']:.4f}, spur {p['spur_bin_idx']}")
            print(f"    harmonic bins {row(p['harmonic_bins'], 'd')}, dBc {row(m['harmonics_dbc'], '.4f')}")
            db = p["power_spectrum_db_plot"]
            print(f"    dBFS at 1 5 bin H2 100 511 512: "
                  f"{row([db[k] for k in (1, 5, bin_, int(p['harmonic_bins'][0]), 100, 511, 512)], '.4f')}")
            if coherent:
                spec = p["complex_spectrum"]
                bins = [bin_] + [int(b) for b in p["harmonic_bins"]]
                print(f"    phase deg at bin, H2 ... H5: {row([np.degrees(np.angle(spec[b])) for b in bins], '.4f')}")
                print(f"    |V| dB at bin, H2 ... H5: {row([20 * np.log10(abs(spec[b]) + 1e-20) for b in bins], '.4f')}")
                print(f"    |V| dB at 3 77 300 511: {row([20 * np.log10(abs(spec[b]) + 1e-20) for b in (3, 77, 300, 511)], '.4f')}, "
                      f"1st percentile {np.percentile(20 * np.log10(np.abs(spec) + 1e-20), 1):.4f}")
        print()

    # exp_s07's comparison: SNDR and SNR as the runs pile up
    fin, _ = find_coherent_frequency(FS, 5e6, N)
    data = make("static", fin, 100, (-80.0, -73.0, 1), 100e-6)
    print("s12 levels at 1 ... 100 runs: runs, then SNDR and SNR power-averaged, SNDR and SNR coherently averaged")
    for runs in CHECKPOINTS:
        _, pm, _ = read(data[:runs], False)
        _, cm, _ = read(data[:runs], True)
        print(f"  {runs:3d} {pm['sndr_dbc']:9.4f} {pm['snr_dbc']:9.4f} {cm['sndr_dbc']:9.4f} {cm['snr_dbc']:9.4f}")
