#!/usr/bin/env python3
"""Reference numbers for the time-interleaving page, computed with ADCToolbox.

    pip install adctoolbox==0.9.1
    python3 python/adc_time_interleave.py

The page ports these ADCToolbox functions to TypeScript, and tests/timeinterleave-model.test.ts checks the port against
the numbers printed here:
  timeinterleave/   deinterleave, interleave, extract_mismatch_sine, predict_spurs, calibrate_foreground,
                    fractional_delay_fft, fractional_delay_farrow
  fundamentals/     find_coherent_frequency
  siggen/           apply_quantization_noise, and apply_thermal_noise's sum
  spectrum/         analyze_spectrum
following the example exp_ti01, whose capture this builds the same way, with noise and a quantiser added.

The mismatch patterns and the noise come from the same deterministic generator as the page, mulberry32 through
Box-Muller, so both sides analyse exactly the same samples.
"""
import contextlib
import io
import math

import numpy as np
from adctoolbox import (analyze_spectrum, calibrate_foreground, deinterleave, extract_mismatch_sine,
                        find_coherent_frequency, fractional_delay_farrow, fractional_delay_fft, interleave,
                        predict_spurs)
from adctoolbox.siggen import ADC_Signal_Generator

FS, N, AMP, TAPS, NOISE_LSB, NOISE_SEED = 1e9, 4096, 0.4, 9, 0.3, 7


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


DRAWS = gaussians(24, 2026)
NOISE = gaussians(N, NOISE_SEED)


def pattern(which, m):
    """Draws `which` for the first m channels, less their mean and scaled to an rms of one."""
    z = DRAWS[8 * which:8 * which + m]
    d = z - z.sum() / m
    return d / np.sqrt((d * d).sum() / m)


def mismatch(m, gain_rms, offset_rms, skew_rms):
    return 1 + gain_rms * pattern(0, m), offset_rms * pattern(1, m), skew_rms * pattern(2, m)


def capture(fin, m, gain, offset, skew, bits):
    """exp_ti01's loop, vectorised, then 0.3 LSB of the page's noise and a quantiser on +/-0.5 V."""
    n = np.arange(N)
    c = n % m
    t = n * (1.0 / FS) + skew[c]
    x = gain[c] * AMP * np.cos(2 * np.pi * fin * t) + offset[c]
    # apply_thermal_noise adds noise_rms times standard normals; these are the page's normals
    x = x + NOISE * NOISE_LSB * (1 / 2 ** bits)
    gen = ADC_Signal_Generator(N=N, Fs=FS, Fin=fin, A=AMP, DC=0.0)
    return gen.apply_quantization_noise(x, n_bits=bits, quant_range=(-0.5, 0.5))


def read(x):
    with contextlib.redirect_stdout(io.StringIO()):
        r = analyze_spectrum(x, fs=FS, max_scale_range=(-0.5, 0.5), win_type="rectangular", side_bin=0,
                             max_harmonic=5, nf_method=3, create_plot=False)
    return r["sfdr_dbc"], r["sndr_dbc"]


def params_text(p):
    return (f"gain % {' '.join(f'{(g - 1) * 100:+.5f}' for g in p['gain'])} | "
            f"offset mV {' '.join(f'{o * 1e3:+.5f}' for o in p['offset'])} | "
            f"skew ps {' '.join(f'{s * 1e12:+.5f}' for s in p['skew'])}")


def sfdr_predicted(spurs):
    """The largest tone in predict_spurs's list. It has an entry per DFT coefficient, and an offset pattern puts two of
    them, k and M - k, on one frequency, where they are a single tone as large as both together."""
    amp, dbc = {}, {}
    for s in spurs:
        f = s["freq_hz"]
        if f in amp and amp[f] > 0:
            dbc[f] += 20 * np.log10((amp[f] + s["amp"]) / amp[f])
            amp[f] += s["amp"]
        else:
            amp[f], dbc[f] = s["amp"], s["dbc"]
    return -max(dbc.values())


SWEEP = [find_coherent_frequency(FS, (i + 0.5) * FS / 80, N)[0] for i in range(40)]
STATES = [
    # channels, target Hz, gain rms, offset rms V, skew rms s, bits
    (4, 100e6, 0.003, 1e-3, 5e-12, 12),
    (4, 17e6, 0.02, 5e-3, 3e-12, 12),
    (2, 180e6, 0.01, 2e-3, 5e-12, 10),
    (8, 40e6, 0.005, 3e-3, 8e-12, 14),
    (4, 300e6, 0.003, 1e-3, 5e-12, 12),
    (8, 450e6, 0.01, 0.0, 10e-12, 16),
]


if __name__ == "__main__":
    print(f"{N} samples at {FS / 1e9:g} GS/s, a {AMP} V tone on a +/-0.5 V range, {NOISE_LSB} LSB of noise")
    print()
    print("mismatch patterns, zero mean and unit rms: gain, offset, skew")
    for m in (2, 4, 8):
        for which in range(3):
            print(f"  M={m} #{which}: " + " ".join(f"{v:+.9f}" for v in pattern(which, m)))
    print()

    # the two delays on a record that is not periodic in its length, so the edges show
    i = np.arange(64)
    x = np.cos(2 * np.pi * 0.071 * i) + 0.3 * np.sin(2 * np.pi * 0.23 * i + 0.4)
    picks = [0, 1, 2, 3, 4, 31, 32, 59, 60, 61, 62, 63]
    print("delays of cos(2 pi 0.071 i) + 0.3 sin(2 pi 0.23 i + 0.4), i = 0 ... 63, at samples " + " ".join(map(str, picks)))
    for name, delay in [("fft 0.3", lambda v: fractional_delay_fft(v, 0.3, 1.0)),
                        ("fft -1.7", lambda v: fractional_delay_fft(v, -1.7, 1.0)),
                        ("farrow 0.3", lambda v: fractional_delay_farrow(v, 0.3, 1.0, n_taps=9)),
                        ("farrow -1.7 x5", lambda v: fractional_delay_farrow(v, -1.7, 1.0, n_taps=5)),
                        ("farrow 2.5 x7", lambda v: fractional_delay_farrow(v, 2.5, 1.0, n_taps=7)),
                        ("farrow 3.5 x3", lambda v: fractional_delay_farrow(v, 3.5, 1.0, n_taps=3))]:
        y = delay(x)
        print(f"  {name:15s} " + " ".join(f"{y[k]:+.9f}" for k in picks))
    # and on an odd length, where irfft has no Nyquist bin to keep real
    y = fractional_delay_fft(x[:63], 0.45, 1.0)
    print(f"  {'fft 0.45 odd':15s} " + " ".join(f"{y[k]:+.9f}" for k in picks[:-1]))
    ch = deinterleave(np.arange(12.0), 3)
    print("deinterleave(0 ... 11, 3): " + " / ".join(" ".join(f"{v:g}" for v in row) for row in ch)
          + " | interleave back: " + " ".join(f"{v:g}" for v in interleave(ch)))
    print()

    for m, target, gain_rms, offset_rms, skew_rms, bits in STATES:
        fin, bin_ = find_coherent_frequency(FS, target, N)
        gain, offset, skew = mismatch(m, gain_rms, offset_rms, skew_rms)
        x = capture(fin, m, gain, offset, skew, bits)
        p = extract_mismatch_sine(x, M=m, fs=FS, fin=fin)
        print(f"M={m}, {bits} bits, fin {fin / 1e6:.6f} MHz (bin {bin_}); rms gain {gain_rms * 100:g} %, "
              f"offset {offset_rms * 1e3:g} mV, skew {skew_rms * 1e12:g} ps")
        print(f"  set        {params_text({'gain': gain, 'offset': offset, 'skew': skew})}")
        print(f"  measured   {params_text(p)} | A {p['A']:.9f} V")
        spurs = predict_spurs(p, FS, full_scale=0.5)
        for s in spurs:
            print(f"    {s['kind']:9s} k={s['k']}  {s['freq_hz'] / 1e6:11.6f} MHz  {s['dbfs']:9.4f} dBFS  {s['dbc']:9.4f} dBc")
        rows = [("off", x)]
        for method in ("fft", "farrow"):
            rows.append((method, calibrate_foreground(x, M=m, params=p, fs=FS, skew_method=method, n_taps=TAPS)))
        print("  SFDR, SNDR dB: " + " | ".join(f"{name} {sfdr:8.3f} {sndr:8.3f}" for name, y in rows for sfdr, sndr in [read(y)])
              + f" | predicted SFDR {sfdr_predicted(spurs):8.3f}")
        for name, y in rows[1:]:
            print(f"  {name:6s} left {params_text(extract_mismatch_sine(y, M=m, fs=FS, fin=fin))}")
        print()

    m, _, gain_rms, offset_rms, skew_rms, bits = STATES[0]
    gain, offset, skew = mismatch(m, gain_rms, offset_rms, skew_rms)
    print(f"sweep for the first case: fin MHz, then SFDR in dB off, predicted, after fft, after farrow")
    for fin in SWEEP:
        x = capture(fin, m, gain, offset, skew, bits)
        p = extract_mismatch_sine(x, M=m, fs=FS, fin=fin)
        after = [read(calibrate_foreground(x, M=m, params=p, fs=FS, skew_method=k, n_taps=TAPS))[0] for k in ("fft", "farrow")]
        print(f"  {fin / 1e6:11.6f} {read(x)[0]:8.3f} {sfdr_predicted(predict_spurs(p, FS, full_scale=0.5)):8.3f} "
              + " ".join(f"{v:8.3f}" for v in after))
