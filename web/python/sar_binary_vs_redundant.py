#!/usr/bin/env python3
"""Reference model for the binary vs redundant SAR ADC illustration (the web page mirrors it).

All quantities in LSB units; the input x lies in [0, 2^N). Comparison i = 1..M uses threshold t_i:
    t_1 = 2^(N-1),   t_{i+1} = t_i + (2 b_i - 1) s_i,   code = clip(t_M + b_M - 1, 0, 2^N - 1)
Binary SAR: M = N, s_i = 2^(N-1-i). Redundant SAR: M > N, sub-binary integer steps with
    R_i = 1 + sum_{j>i} s_j - s_i >= 0   (a decision error of up to R_i LSB at comparison i is corrected later).
The analog threshold seen by the comparator differs from t_i by
    capacitor mismatch: each move s_i is realised as s_i (1 + d_i), d_i ~ N(0, sigma_u / sqrt(2 s_i)), fixed per chip
    incomplete DAC settling: the comparator sees a_i - eps (a_i - a_{i-1}) (eps = unsettled fraction of the last move)
    comparator noise: Gaussian, sigma_n LSB rms per comparison.
"""
import math
import numpy as np

def redundant_steps(n):
    """Sub-binary integer moves s_1..s_{M-1} for M = N + ceil(N/6) comparisons: geometric with LSB move 1 and the
    radix r (about 1.7) that makes the moves sum to exactly 2^(N-1) - 1; rounding error is absorbed by the top moves."""
    k = n - 1 + math.ceil(n / 6)                # number of moves
    target = 2 ** (n - 1) - 1
    lo, hi = 1.0 + 1e-9, 2.0
    for _ in range(200):
        r = (lo + hi) / 2
        (lo, hi) = (r, hi) if (r ** k - 1) / (r - 1) < target else (lo, r)
    moves = [max(1, round(r ** j)) for j in range(k)]   # LSB first
    diff = target - sum(moves)
    j = k - 1
    while diff:
        step = 1 if diff > 0 else -1
        moves[j] += step; diff -= step
        j = j - 1 if j > k // 2 else k - 1
    return moves[::-1], r


STEPS = {n: redundant_steps(n)[0] for n in (6, 8, 10, 12)}


def binary_steps(n):
    return [2 ** (n - 1 - i) for i in range(1, n)]


def check_steps(n, steps):
    total = sum(steps)
    R = [1 + sum(steps[i + 1:]) - s for i, s in enumerate(steps)]
    return total >= 2 ** (n - 1) - 1, min(R), R


def convert(x, n, steps, eps=0.0, sigma_n=0.0, dev=None, rng=None, trace=False):
    """One conversion. dev[i] = relative mismatch of move i. Returns code (and the per-comparison record)."""
    m = len(steps) + 1
    t = 2 ** (n - 1)            # digital (nominal) threshold
    a = float(t)                 # analog threshold actually built by the capacitors
    a_prev = a
    rec = []
    b = 0
    for i in range(m):
        seen = a - eps * (a - a_prev)                  # incomplete settling of the last move
        noise = rng.standard_normal() * sigma_n if (rng is not None and sigma_n) else 0.0
        b = 1 if x + noise >= seen else 0
        if trace:
            rec.append(dict(t=t, a=a, seen=seen, b=b, ideal=1 if x >= t else 0))
        if i == m - 1:
            break
        s = steps[i]
        a_prev = a
        a = a + (2 * b - 1) * s * (1 + (dev[i] if dev is not None else 0.0))
        t = t + (2 * b - 1) * s
    code = min(max(t + b - 1, 0), 2 ** n - 1)
    return (code, rec) if trace else code


def sine_test(n, steps, eps, sigma_n, sigma_u, n_fft=4096, cycles=409, seed=3, amp_dbfs=-0.5):
    rng = np.random.default_rng(seed)
    dev = np.array([rng.standard_normal() * sigma_u / math.sqrt(2 * s) for s in steps])
    amp = 2 ** (n - 1) * 10 ** (amp_dbfs / 20)
    k = np.arange(n_fft)
    x = 2 ** (n - 1) + amp * np.sin(2 * math.pi * cycles * k / n_fft)
    codes = np.array([convert(v, n, steps, eps, sigma_n, dev, rng) for v in x], dtype=float)
    y = codes + 0.5 - 2 ** (n - 1)
    X = np.fft.rfft(y) / (n_fft / 2)
    P = np.abs(X) ** 2
    P[0] = 0
    sig = P[cycles]
    noise = P.sum() - sig
    spur = np.max(np.delete(P[1:], cycles - 1))
    fs_amp2 = (2 ** (n - 1)) ** 2
    return dict(sndr=10 * math.log10(sig / noise), sfdr=10 * math.log10(sig / spur), enob=(10 * math.log10(sig / noise) - 1.76) / 6.02,
                sig_dbfs=10 * math.log10(sig / fs_amp2), floor_dbfs=10 * math.log10(noise / (n_fft / 2) / fs_amp2),
                max_err=float(np.max(np.abs(codes - np.clip(np.floor(x), 0, 2 ** n - 1)))))


if __name__ == "__main__":
    for n, st in STEPS.items():
        ok, rmin, R = check_steps(n, st)
        print(f"N={n:2d}: redundant M={len(st)+1} moves={st} sum={sum(st)} (need >= {2**(n-1)-1}) covers={ok} min R={rmin} R={R}")
        okb, rminb, _ = check_steps(n, binary_steps(n))
        assert ok and rmin >= 0 and okb and rminb == 0
    # exhaustive ideal check: both architectures give floor(x) for every input on a fine grid
    for n in (6, 8, 10):
        grid = np.arange(0, 2 ** n, 0.0625)
        for name, st in (("binary", binary_steps(n)), ("redundant", STEPS[n])):
            err = max(abs(convert(v, n, st) - math.floor(v)) for v in grid)
            print(f"ideal N={n:2d} {name:9s}: max |code - floor(x)| over {len(grid)} inputs = {err}")
    print(f"{'N':>2s} {'eps':>5s} {'noise':>5s} {'mism':>5s} | {'binary SNDR/ENOB/SFDR/maxerr':>32s} | {'redundant SNDR/ENOB/SFDR/maxerr':>32s}")
    for n in (8, 10):
        for eps, sn, su in ((0, 0, 0), (0.04, 0, 0), (0.10, 0, 0), (0, 0.3, 0), (0.04, 0.25, 0.005), (0, 0, 0.02)):
            rb = sine_test(n, binary_steps(n), eps, sn, su); rr = sine_test(n, STEPS[n], eps, sn, su)
            fmt = lambda r: f"{r['sndr']:5.1f} {r['enob']:5.2f} {r['sfdr']:5.1f} {r['max_err']:5.1f}"
            print(f"{n:2d} {eps:5.2f} {sn:5.2f} {su*100:4.1f}% | {fmt(rb):>32s} | {fmt(rr):>32s}")
