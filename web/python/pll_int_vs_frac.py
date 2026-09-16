#!/usr/bin/env python3
"""Reference implementation of the integer-N vs fractional-N comparison model (the web page mirrors it).

Reference-rate time-domain PLL: reference 25 / 40 / 100 MHz (default 40), type-II PI loop (zeta = 1) with two extra
poles at 6x BW, closed-loop -3 dB bandwidth 1 MHz, linear phase detector, VCO around 5 GHz.
Noise: white reference/PFD timing noise from a normalised floor of -228 dBc/Hz (634 fs rms per edge);
VCO -120 dBc/Hz at 1 MHz (white FM). RMS jitter = std of the output edge-time error, f_ref/32768 .. f_ref/2.
Divider: integer N | first-order accumulator | MASH 1-1-1 (24 bit, LSB set), either with an ideal DTC (+ bow INL).
"""
import math
import numpy as np

F_REF = 40e6; T_REF = 1 / F_REF; W = 24; M = 1 << W
BW = 1e6; POLE_X = 6.0; FOM = -228.0; SIG_REF = 10 ** (FOM / 20) / (2 * math.pi); L_VCO_1M = -120.0

def nf(z, gp, beta):
    gi = gp * gp / 4
    return (gp + gi * z / (z - 1)) * (beta * z / (z - 1 + beta)) ** 2

def closed_loop_mag(f, gp, beta):
    z = np.exp(2j * np.pi * f / F_REF); L = nf(z, gp, beta)
    return np.abs(L / (z - 1 + L))

def loop_gain_for_bw(bw=BW):
    beta = 1 - math.exp(-2 * math.pi * POLE_X * bw / F_REF)
    lo, hi = 1e-4, 1.0
    for _ in range(60):
        mid = 0.5 * (lo + hi)
        if closed_loop_mag(bw, mid, beta) < 1 / math.sqrt(2): lo = mid
        else: hi = mid
    return 0.5 * (lo + hi), beta

def simulate(target_hz, mode, dtc=False, inl_ps=0.0, noise=True, n_warm=8192, n_fft=32768, seed=7, bw=BW, cp_mismatch=0.0):
    if mode == "int":
        n_int, fcw = int(round(target_hz / F_REF)), 0
    else:
        n_int = int(math.floor(target_hz / F_REF)); fcw = int(round((target_hz / F_REF - n_int) * M))
        if mode == "sd" and fcw: fcw |= 1
    alpha = fcw / M; n_avg = n_int + alpha; t_out = T_REF / n_avg
    # phase error the DTC has to cancel: one output period of sawtooth after the accumulator, four after MASH 1-1-1
    top, span = (0.0, 1.0) if mode == "acc" else (2.0, 4.0)
    gp, beta = loop_gain_for_bw(bw); gi = gp * gp / 4; kp, ki = gp / n_avg, gi / n_avg
    sig_vco = (1e6 * t_out) * math.sqrt(10 ** (L_VCO_1M / 10) / F_REF)   # per reference cycle
    rng = np.random.default_rng(seed)
    n = n_warm + n_fft
    nref = rng.standard_normal(n) * (SIG_REF if noise else 0.0)
    nvco = rng.standard_normal(n) * (sig_vco if noise else 0.0)
    x = 0.0; I = p1 = p2 = 0.0; Q = 0
    a1 = a2 = a3 = 0; c2p = c3p = c3pp = 0
    xs = np.empty(n); es = np.empty(n); ns = np.empty(n, dtype=int); qs = np.empty(n)
    for k in range(n):
        q = Q / M
        if dtc:
            u01 = (top - q) / span
            delta = (top - q) * t_out + inl_ps * 1e-12 * 4 * u01 * (1 - u01)
        else:
            delta = 0.0
        e = x + q * t_out + delta + nref[k]
        # charge pump: up and down currents differ, so the gain depends on the sign of the phase error
        pump = e * (1 + (cp_mismatch if e >= 0 else -cp_mismatch) / 2)
        I += ki * pump; pi = kp * pump + I; p1 += beta * (pi - p1); p2 += beta * (p1 - p2); u = -p2
        if mode == "int":
            y = 0
        elif mode == "acc":
            s1 = a1 + fcw; c1 = s1 >> W; a1 = s1 & (M - 1); y = c1
        else:
            s1 = a1 + fcw; c1 = s1 >> W; a1 = s1 & (M - 1)
            s2 = a2 + a1; c2 = s2 >> W; a2 = s2 & (M - 1)
            s3 = a3 + a2; c3 = s3 >> W; a3 = s3 & (M - 1)
            y = c1 + (c2 - c2p) + (c3 - 2 * c3p + c3pp); c2p = c2; c3pp = c3p; c3p = c3
        xs[k], es[k], ns[k], qs[k] = x, e, n_int + y, q
        x += (n_int + y) * u + nvco[k]
        Q += y * M - fcw
    return dict(n_int=n_int, alpha=alpha, n_avg=n_avg, t_out=t_out, f_out=1 / t_out, x=xs[n_warm:], e=es[n_warm:],
                ndiv=ns[n_warm:], q=qs[n_warm:], gp=gp, beta=beta)

def analyze(r, n_fft=32768):
    x = r["x"]; t = np.arange(len(x)); x = x - np.polyval(np.polyfit(t, x, 1), t)
    jitter_fs = float(np.std(x) * 1e15)
    phi = 2 * np.pi * x / r["t_out"]
    w = 0.5 - 0.5 * np.cos(2 * np.pi * np.arange(n_fft) / n_fft); sw2 = float(np.sum(w * w))
    Z = np.fft.fft(np.exp(1j * phi) * w)
    k = np.arange(1, n_fft // 2)
    P = 0.5 * (np.abs(Z[k]) ** 2 + np.abs(Z[n_fft - k]) ** 2)
    f = k * F_REF / n_fft
    L = 10 * np.log10(P / (F_REF * sw2) + 1e-300)
    # floor: median of dB(P) in log bins, spurs >= 12 dB above floor and local max
    dbp = 10 * np.log10(P + 1e-300)
    edges = np.unique(np.round(np.logspace(0, np.log10(len(k)), 60)).astype(int))
    floor = np.empty(len(k))
    for a, b in zip(edges[:-1], edges[1:]):
        seg = dbp[a - 1:b]; floor[a - 1:b] = np.median(seg)
    spurs = []
    for i in range(2, len(k) - 2):
        if f[i] < 1e4: continue
        if dbp[i] >= floor[i] + 18 and dbp[i] == dbp[i - 2:i + 3].max():
            pw = P[i - 2:i + 3].sum() / (n_fft * sw2)
            spurs.append((f[i], 10 * np.log10(pw)))
    return dict(jitter_fs=jitter_fs, f=f, L=L, spurs=sorted(spurs, key=lambda s: -s[1]))

if __name__ == "__main__":
    gp, beta = loop_gain_for_bw()
    beta_poly = beta; gi = gp * gp / 4
    # closed-loop poles: (z-1)^2 (z-1+b)^2 + (gp(z-1)+gi z) b^2 z^2 = 0
    p1 = np.polymul(np.polymul([1, -1], [1, -1]), np.polymul([1, -1 + beta], [1, -1 + beta]))
    p2 = np.polymul(np.polyadd(np.multiply(gp, [1, -1]), [gi, 0]), np.multiply(beta * beta, [1, 0, 0]))
    roots = np.roots(np.polyadd(p1, p2))
    fs = np.logspace(4, np.log10(5e7), 400); H = closed_loop_mag(fs, gp, beta)
    print(f"loop: g_p = {gp:.5f}, beta = {beta:.4f}, max |pole| = {np.max(np.abs(roots)):.5f}, peaking = {20*np.log10(H.max()):.2f} dB, "
          f"|H(1 MHz)| = {20*np.log10(closed_loop_mag(1e6, gp, beta)):.2f} dB, |H(5 MHz)| = {20*np.log10(closed_loop_mag(5e6, gp, beta)):.2f} dB")
    import time
    for mode, dtc, inl in (("int", False, 0), ("acc", False, 0), ("sd", False, 0), ("sd", True, 0), ("sd", True, 1.0)):
        t0 = time.time(); r = simulate(5.005e9, mode, dtc, inl); a = analyze(r)
        band = (a["f"] > 2e5) & (a["f"] < 6e5); hump = a["L"][(a["f"] > 5e6) & (a["f"] < 1e7)]
        top = ", ".join(f"{s[1]:.1f} dBc @ {s[0]/1e6:.3f} MHz" for s in a["spurs"][:3]) or "none"
        print(f"{mode:3s}{'+dtc' if dtc else '    '} INL {inl:3.1f} ps: N_avg {r['n_avg']:.6f} f_out {r['f_out']/1e9:.6f} GHz | jitter {a['jitter_fs']:8.1f} fs | "
              f"L(200-600k) {np.median(a['L'][band]):7.1f} dBc/Hz | L(5-10 MHz) med {np.median(hump):7.1f} | e range [{r['e'].min()*1e12:7.1f}, {r['e'].max()*1e12:7.1f}] ps | "
              f"ndiv {r['ndiv'].min()}..{r['ndiv'].max()} | spurs: {top}   ({time.time()-t0:.1f}s)")
    r = simulate(5.005e9, "acc", noise=False); a = analyze(r)
    print("acc, noise off: " + ", ".join(f"{s[1]:.2f} dBc @ {s[0]/1e6:.3f} MHz" for s in a["spurs"][:4]))
    Hs = closed_loop_mag(5e6, gp, beta); print(f"linear prediction for the 5 MHz fundamental: 20log10(2|H|/2) = {20*np.log10(Hs):.2f} dBc")
    print()
    print("charge-pump mismatch at a near-integer channel (5.0005 GHz, 0.5 MHz offset):")
    for mode, dtc, inl in (("acc", False, 0.0), ("sd", False, 0.0), ("sd", True, 0.0), ("sd", True, 3.0)):
        for cp in (0.0, 0.05):
            a = analyze(simulate(5.0005e9, mode, dtc, inl, bw=BW, cp_mismatch=cp))
            spur = ", ".join(f"{s[1]:.2f} dBc @ {s[0]/1e6:.3f} MHz" for s in a["spurs"][:2]) or "none"
            print(f"  {mode:3s}{'+dtc' if dtc else '    '} INL {inl:3.1f} ps, CP mismatch {cp*100:4.1f}%: jitter {a['jitter_fs']:8.1f} fs | {spur}")
    print()
    print()
    print("DTC INL at a near-integer channel (5.0005 GHz, alpha = 1/80, no charge-pump mismatch):")
    for mode in ("acc", "sd"):
        for inl in (0.0, 0.5, 1.0, 2.0, 5.0):
            a = analyze(simulate(5.0005e9, mode, True, inl))
            spur = ", ".join(f"{s[1]:.2f} dBc @ {s[0]/1e6:.3f} MHz" for s in a["spurs"][:3]) or "none"
            print(f"  {mode}+dtc INL {inl:3.1f} ps: jitter {a['jitter_fs']:7.1f} fs | {spur}")
    print()
    a = analyze(simulate(5.0004e9, "acc", noise=True))
    print("acc near-integer 5.0004 GHz: " + ", ".join(f"{s[1]:.1f} dBc @ {s[0]/1e6:.3f} MHz" for s in a["spurs"][:3]) + f", jitter {a['jitter_fs']:.0f} fs")
