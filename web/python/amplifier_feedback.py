"""Independent complex-arithmetic oracle for the single-pole amplifier lesson.

Evaluate A / (1 + beta*A) directly; do not use the browser's simplified
closed-loop pole formula to obtain the frequency response.
"""
import numpy as np

print('A0_dB GBW_Hz G_dB f_Hz A_dB L_dB T_dB phase_T_deg')
for a0_db, gbw, gain_db in [(60, 1e5, 20), (80, 1e5, 20), (20, 1e3, 60), (100, 1e8, 0), (40, 1e5, 40)]:
    a0 = 10 ** (a0_db / 20)
    beta = 10 ** (-gain_db / 20)
    pole = gbw / a0
    closed_dc = a0 / (1 + beta * a0)
    closed_bw = pole * (1 + beta * a0)
    frequencies = [0, pole, closed_bw, gbw, gbw * 10]
    for f in frequencies:
        a = a0 / (1 + 1j * f / pole)
        loop = beta * a
        closed = a / (1 + loop)
        print(f'{a0_db} {gbw:.4f} {gain_db} {f:.8f} '
              f'{20 * np.log10(abs(a)):.9f} {20 * np.log10(abs(loop)):.9f} '
              f'{20 * np.log10(abs(closed)):.9f} {np.angle(closed, deg=True):.9f}')
        if f == closed_bw:
            assert np.isclose(abs(closed), closed_dc / np.sqrt(2), rtol=1e-12)
            assert np.isclose(np.angle(closed, deg=True), -45)
    assert np.isclose(closed_dc * closed_bw, gbw, rtol=1e-12)
