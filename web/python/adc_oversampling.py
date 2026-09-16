#!/usr/bin/env python3
"""Reference numbers for the oversampling page, computed with ADCToolbox.

    pip install adctoolbox==0.9.1
    python3 python/adc_oversampling.py

The page ports these ADCToolbox functions to TypeScript, and tests/oversampling-model.test.ts checks the port against
the numbers printed here:
  siggen/nonidealities   apply_noise_shaping, apply_quantization_noise
  spectrum/              analyze_spectrum with an OSR
  oversampling/          ntfperf, perfosr (sweep_performance_vs_osr and fit_sine_4param), ifilter
following the examples exp_o01 (a noise-shaped spectrum), exp_o02 (ifilter) and exp_o03 (ntfperf and perfosr).
"""
import contextlib
import io
import warnings

import numpy as np
from scipy import signal
from adctoolbox import analyze_spectrum, find_coherent_frequency, ifilter, ntfperf, perfosr
from adctoolbox.siggen import ADC_Signal_Generator

N, FS, AMP = 2**13, 100e6, 0.4
OSRS = [1, 2, 4, 8, 16, 32, 64, 128, 256]


def capture(order, bits):
    """exp_o01's converter at exp_o03's tone: plain quantisation, or quantisation shaped by (1 - z^-1)^order."""
    fin, _ = find_coherent_frequency(FS, FS / 640, N)
    gen = ADC_Signal_Generator(N=N, Fs=FS, Fin=fin, A=AMP, DC=0.0)
    if order == 0:
        return gen.apply_quantization_noise(n_bits=bits, quant_range=(-0.5, 0.5))
    return gen.apply_noise_shaping(n_bits=bits, quant_range=(-0.5, 0.5), order=order)


def ntf(order):
    """(1 - z^-1)^order as exp_o03 writes it: (z - 1)^order / z^order."""
    return signal.TransferFunction(np.poly([1.0] * order), [1.0] + [0.0] * order, dt=1)


def read(data, osr):
    with contextlib.redirect_stdout(io.StringIO()):
        r = analyze_spectrum(data, fs=FS, osr=osr, max_scale_range=[-0.5, 0.5], win_type="rectangular", side_bin=0,
                             max_harmonic=5, nf_method=3, create_plot=False)
    return r["sndr_dbc"], r["sfdr_dbc"]


if __name__ == "__main__":
    warnings.simplefilter("ignore")
    fin, bin_ = find_coherent_frequency(FS, FS / 640, N)
    print(f"{N} samples at {FS / 1e6:g} MHz, a {AMP} V tone at {fin / 1e3:.3f} kHz (bin {bin_}) on a +/-0.5 V range")
    print()
    print("ntfperf: in-band noise below a flat NTF over the whole band, dB")
    print("order | " + " ".join(f"{f'OSR {o}':>9s}" for o in OSRS))
    for order in range(4):
        print(f"{order:5d} | " + " ".join(f"{ntfperf(ntf(order), 0, 0.5 / o):9.3f}" for o in OSRS))
    print()
    for bits in (4, 10):
        print(f"{bits}-bit quantiser: analyze_spectrum SNDR and SFDR at OSR 1 and 32, dB; perfosr SNDR at each OSR, dB;")
        print("  and the rms of the record, of ifilter's band 0 ... fs/64, and of what it leaves out")
        for order in range(4):
            data = capture(order, bits)
            full, band = read(data, 1), read(data, 32)
            _, sweep, _, _ = perfosr(data, osr=np.array(OSRS))
            inband = ifilter(data, [[0, 0.5 / 32]]).ravel()
            print(f"  order {order}: {full[0]:8.3f} {full[1]:8.3f} | {band[0]:8.3f} {band[1]:8.3f} | "
                  + " ".join(f"{s:8.3f}" for s in sweep))
            print(f"           rms {np.std(data):.6e} {np.std(inband):.6e} {np.std(data - inband):.6e}")
