"""
Phase Noise to Amplitude Noise Conversion - Parameter Sweep
Sweeps phase noise L and shows Sv[dB] for multiple slew rates
"""

import numpy as np
import matplotlib.pyplot as plt
import os

# Constants
f0 = 500e6  # Operating frequency: 500 MHz [Hz]

# Slew rate values [V/s]
SR_values = [1e9, 10e9, 100e9]  # 1 GV/s, 10 GV/s, 100 GV/s
SR_labels = ['1 GV/s', '10 GV/s', '100 GV/s']

# Phase noise sweep range [dBc/Hz]
L_dBc = np.linspace(-200, -100, 1000)

# Calculate Sv[dB] for each SR
plt.figure(figsize=(12, 10))

for SR, label in zip(SR_values, SR_labels):
    # Convert phase noise from dBc/Hz to linear
    L_linear = 10**(L_dBc / 10)

    # Calculate voltage noise PSD using the formula:
    # Sv(f) = 2 × 10^(L(f)/10) × (SR / (2π f0))^2
    Sv = 2 * L_linear * (SR / (2 * np.pi * f0))**2

    # Convert Sv to dB
    Sv_dB = 10 * np.log10(Sv)

    # Plot
    plt.plot(L_dBc, Sv_dB, linewidth=2, label=f'SR = {label}')

# Add vertical reference lines
reference_lines = [-180, -160, -140]
for L_ref in reference_lines:
    plt.axvline(x=L_ref, color='gray', linestyle='--', linewidth=1, alpha=0.5)
    plt.text(L_ref-3, plt.ylim()[-1] - 5, f'{L_ref} dBc/Hz',
             rotation=90, verticalalignment='top', fontsize=18, color='gray')

# Formatting
plt.xlabel('Phase Noise L [dBc/Hz]', fontsize=18)
plt.ylabel('Voltage Noise PSD Sv [dB (V²/Hz)]', fontsize=18)
plt.title('Phase Noise to Amplitude Noise Conversion\n(f₀ = 500 MHz)', fontsize=18, fontweight='bold')
plt.tick_params(axis='both', which='major', labelsize=18)

# Set grid to show every 10 dB
from matplotlib.ticker import MultipleLocator
ax = plt.gca()
ax.xaxis.set_major_locator(MultipleLocator(10))
ax.yaxis.set_major_locator(MultipleLocator(10))
plt.grid(True, alpha=0.3)

plt.legend(fontsize=18, loc='lower right')
plt.tight_layout()

# Save figure to script directory
script_dir = os.path.dirname(os.path.abspath(__file__))
output_path = os.path.join(script_dir, 'phase_noise_sweep.png')
plt.savefig(output_path, dpi=300, bbox_inches='tight')
print(f"Figure saved to: {output_path}")
plt.close()

# Print some example values
print("\nExample calculations:")
print(f"Operating frequency: {f0/1e6:.0f} MHz\n")

for SR, label in zip(SR_values, SR_labels):
    print(f"SR = {label}:")
    for L_val in [-180, -160, -140]:
        L_linear = 10**(L_val / 10)
        Sv = 2 * L_linear * (SR / (2 * np.pi * f0))**2
        Sv_dB = 10 * np.log10(Sv)
        v_rms = np.sqrt(Sv)
        print(f"  L = {L_val} dBc/Hz -> Sv = {Sv:.2e} V^2/Hz -> Sv[dB] = {Sv_dB:.1f} dB -> v_rms = {v_rms*1e9:.1f} nV/sqrt(Hz)")
    print()
