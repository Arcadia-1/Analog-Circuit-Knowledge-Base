#!/usr/bin/env python3
"""Reference numbers for the page on reading a SAR converter's bits, computed with ADCToolbox.

    python -m pip install -r python/requirements.txt
    python3 python/adc_reading_the_bits.py

The page ports these ADCToolbox functions to TypeScript, and tests/bits-model.test.ts checks the port against the
numbers printed here:
  dout/          analyze_bit_activity, analyze_overflow, analyze_weight_radix, analyze_enob_sweep
  calibration/   calibrate_weight_sine at a known frequency
  spectrum/      compute_spectrum with a Hamming window and side_bin left to auto detection
  fundamentals/  find_coherent_frequency
following the examples exp_d11 (bit activity), exp_d12 (ENOB against bits), exp_d13 (weights and radix) and exp_d14
(overflow), whose SAR loop this repeats.

The noise and the faults come from the same deterministic generator as the page, mulberry32 through Box-Muller, so both
sides analyse exactly the same bits.
"""
import contextlib
import io
import math
import warnings

import numpy as np
from adctoolbox import (analyze_bit_activity, analyze_enob_sweep, analyze_overflow, analyze_weight_radix,
                        calibrate_weight_sine, find_coherent_frequency)
from adctoolbox.spectrum.compute_spectrum import compute_spectrum

N, FS = 2**13, 1e9
NOISE_SEED, FAULT_SEED = 11, 12
ARRAYS = {
    "binary": [1024, 512, 256, 128, 64, 32, 16, 8, 4, 2, 1, 1],
    "redundant": [1024, 512, 256, 256, 128, 64, 32, 16, 8, 4, 2, 1, 1],
    "subradix": [1156, 642, 357, 198, 110, 61, 34, 18, 10, 5, 3, 2, 1, 1],
}


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


FIN, BIN = find_coherent_frequency(FS, 300e6, N)
NOISE = gaussians(N, NOISE_SEED)
FAULT = uniforms(N, FAULT_SEED)


def capture(caps, amp, dc, noise_rms, fault):
    """exp_d11's SAR loop on 2*amp*sin + dc + noise, then a fault: a bit that reads 0 in one sample in ten (exp_d11's
    poor contact in bit 11 of 12), or an LSB that is a coin toss (exp_d12)."""
    caps = np.asarray(caps, dtype=float)
    steps = caps / np.sum(caps)
    t = np.arange(N) / FS
    residue = 2 * amp * np.sin(2 * np.pi * FIN * t) + dc + NOISE * noise_rms
    bits = np.zeros((N, len(caps)))
    for j in range(len(caps)):
        bits[:, j] = (residue > 0).astype(int)
        if j < len(caps) - 1:
            residue -= (2 * bits[:, j] - 1) * steps[j]
    if fault == "contact":
        bits[FAULT < 0.10, len(caps) - 2] = 0
    elif fault == "lsb":
        bits[:, -1] = np.floor(FAULT * 2)
    return bits


def spectrum(x, win):
    r = compute_spectrum(x, fs=FS, win_type=win)
    return r["plot_data"]["side_bin"], r["metrics"]["enob"]


def at_one(bits, weight):
    """analyze_overflow's share of samples whose segment reads 1 or more, counted to within 1e-12. The library tests
    >= 1 exactly, and a segment of all ones sums, bit by bit, to its weights' total or to one ulp below it depending on
    the order the platform adds them in, so its own figure for such a segment is 0 or the right one by chance."""
    out = []
    for ii in range(bits.shape[1]):
        share = bits[:, ii:] @ weight[ii:] / np.sum(weight[ii:])
        out.append(np.mean(share >= 1 - 1e-12) * 100)
    return out


def row(values, fmt):
    return " ".join(format(v, fmt) for v in values)


CASES = [
    # array, amplitude, dc, noise rms, fault
    ("binary", 0.49, 0.0, 200e-6, "none"),
    ("binary", 0.499, 0.01, 0.0, "none"),
    ("binary", 0.499, -0.01, 0.0, "none"),
    ("binary", 0.499, 0.0, 0.0, "contact"),
    ("binary", 0.499, 0.0, 200e-6, "lsb"),
    ("binary", 0.55, 0.0, 200e-6, "none"),
    ("redundant", 0.49, 0.0, 200e-6, "none"),
    ("subradix", 0.49, 0.0, 200e-6, "none"),
    ("subradix", 0.52, 0.005, 500e-6, "contact"),
]


if __name__ == "__main__":
    warnings.simplefilter("ignore")
    print(f"{N} samples at {FS / 1e9:g} GS/s, tone at {FIN / 1e6:.6f} MHz (bin {BIN})")
    print()

    # side_bin auto on tones that are not all coherent, for every window the ports offer
    print("compute_spectrum side_bin=None: cycles, window -> side bins, ENOB")
    noise = gaussians(4096, 3)
    for cycles in (101.0, 101.1, 101.37, 250.5):
        x = 0.9 * np.sin(2 * np.pi * cycles * np.arange(4096) / 4096 + 0.3) + noise * 1e-4
        for win in ("rectangular", "hann", "hamming", "blackmanharris", "flattop"):
            r = compute_spectrum(x, fs=1.0, max_scale_range=1.0, win_type=win)
            print(f"  {cycles:7.2f} {win:15s} {r['plot_data']['side_bin']:3d} {r['metrics']['enob']:9.5f}")
    print()

    for name, amp, dc, noise_rms, fault in CASES:
        caps = ARRAYS[name]
        bits = capture(caps, amp, dc, noise_rms, fault)
        m = len(caps)
        print(f"{name} {m} bits, amplitude {amp:g}, dc {dc:+g}, noise {noise_rms * 1e6:g} uV, fault {fault}")
        print(f"  activity %   {row(analyze_bit_activity(bits, create_plot=False), '.4f')}")
        cal = calibrate_weight_sine(bits, freq=BIN / N)
        w = cal["weight"]
        print(f"  weight       {row(w, '.9e')}")
        print(f"  offset       {cal['offset']:.9e}  rank patch {cal['rank_patch']['applied']}")
        radix = analyze_weight_radix(w, create_plot=False)
        print(f"  radix        {row(radix['radix'][1:], '.6f')}")
        print(f"  wgtsca {radix['wgtsca']:.9e}  effres {radix['effres']:.6f}")
        lo, hi, p0, _ = analyze_overflow(bits, w, create_plot=False)
        print(f"  overflow lo  {row(lo, '.6f')}")
        print(f"  overflow hi  {row(hi, '.6f')}")
        print(f"  at 0 %       {row(p0, '.4f')}")
        print(f"  at 1 %       {row(at_one(bits, w), '.4f')}")
        with contextlib.redirect_stdout(io.StringIO()):
            enob, _ = analyze_enob_sweep(bits, freq=FIN / FS, create_plot=False)
        print(f"  enob sweep   {row(enob, '.5f')}")
        sides = [spectrum(bits[:, :k] @ w[:k], "hamming")[0] for k in range(1, m + 1)]
        print(f"  side bins    {row(sides, 'd')}")
        nominal = spectrum(bits @ np.asarray(caps, dtype=float), "hamming")
        print(f"  nominal weights: side bins {nominal[0]}, ENOB {nominal[1]:.5f}")
        print()

    # exp_d13: the nominal arrays, the last capacitor halved as its terminating half unit
    for name, caps in ARRAYS.items():
        weights = np.append(np.asarray(caps[:-1], dtype=float), caps[-1] * 0.5)
        r = analyze_weight_radix(weights, create_plot=False)
        print(f"exp_d13 {name}: radix {row(r['radix'][1:], '.6f')} | wgtsca {r['wgtsca']:.9e} effres {r['effres']:.6f}")
    # a weight list with a trim weight far below the rest, and a negative one
    r = analyze_weight_radix(np.array([512.0, 260.0, -127.0, 64.0, 33.0, 15.5, 8.0, 4.1, 2.0, 1.0, 0.2]), create_plot=False)
    print(f"trimmed: radix {row(r['radix'][1:], '.6f')} | wgtsca {r['wgtsca']:.9e} effres {r['effres']:.6f}")
