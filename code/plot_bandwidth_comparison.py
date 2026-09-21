import numpy as np
import matplotlib.pyplot as plt
from pathlib import Path

def plot_case(ax, A0, f_OL, beta, case_label, ylim_max):
    """Plot a single bandwidth comparison case."""
    # Calculate key parameters
    GBW = A0 * f_OL
    L0 = beta * A0
    f_CL = f_OL * (1 + L0)
    A_CL_DC = A0 / (1 + L0)
    f_u = f_OL * np.sqrt(A0**2 - 1) if A0 > 1 else None
    f_c = f_OL * np.sqrt(L0**2 - 1) if L0 > 1 else None

    # Frequency vector
    f = np.logspace(0, 6, 1000)

    # Transfer functions
    A_OL = A0 / (1 + 1j * f / f_OL)
    L = beta * A_OL
    A_CL = A_OL / (1 + beta * A_OL)

    # Convert to dB
    A_OL_dB = 20 * np.log10(np.abs(A_OL))
    A_CL_dB = 20 * np.log10(np.abs(A_CL))
    L_dB = 20 * np.log10(np.abs(L))
    # Check the complex transfer function at its analytical -3 dB frequency.
    A_at_bw = A0 / (1 + 1j * f_CL / f_OL)
    assert np.isclose(abs(A_at_bw / (1 + beta * A_at_bw)), A_CL_DC / np.sqrt(2))

    # Plot transfer functions
    ax.semilogx(f, A_OL_dB, 'b-', linewidth=2, label='Open-Loop Gain $A_{OL}(f)$')
    ax.semilogx(f, A_CL_dB, 'r-', linewidth=2, label='Closed-Loop Gain $A_{CL}(f)$')
    ax.semilogx(f, L_dB, 'g-', linewidth=2, label='Loop Gain $L(f) = \\beta A_{OL}(f)$')

    # Mark DC gains
    ax.plot(f[0], 20*np.log10(A0), 'bs', markersize=8)
    ax.text(f[0]*2, 20*np.log10(A0)+3, f'$A_0$ = {20*np.log10(A0):.0f} dB', fontsize=9, color='b')

    ax.plot(f[0], 20*np.log10(A_CL_DC), 'rs', markersize=8)
    ax.text(f[0]*2, 20*np.log10(A_CL_DC)-5, f'$A_{{CL}}$ = {20*np.log10(A_CL_DC):.3f} dB', fontsize=9, color='r')

    ax.plot(f[0], 20*np.log10(L0), 'gs', markersize=8)
    ax.text(f[0]*2, 20*np.log10(L0)+3, f'$L_0$ = {20*np.log10(L0):.0f} dB', fontsize=9, color='g')

    # Mark -3dB points
    ax.plot(f_OL, 20*np.log10(A0/np.sqrt(2)), 'bo', markersize=8)
    ax.axvline(x=f_OL, color='b', linestyle='--', alpha=0.5, linewidth=1)
    ax.text(f_OL*1.5, 20*np.log10(A0/np.sqrt(2))+3, f'$f_{{OL}}$ = {f_OL:.0f} Hz', fontsize=9, color='b')

    A_CL_3dB = 20*np.log10(A_CL_DC/np.sqrt(2))
    ax.plot(f_CL, A_CL_3dB, 'ro', markersize=8)
    ax.axvline(x=f_CL, color='r', linestyle='--', alpha=0.5, linewidth=1)
    ax.text(f_CL*1.5, A_CL_3dB-3, f'$f_{{CL}}$ = {f_CL:.0f} Hz', fontsize=9, color='r')

    if f_u is not None:
        ax.plot(f_u, 0, 'bo', markersize=8, markerfacecolor='white')
        ax.axvline(x=f_u, color='b', linestyle=':', alpha=0.5, linewidth=1)
        ax.text(f_u*1.3, 5, f'$f_u$ = {f_u:.1f} Hz', fontsize=9, color='b')
    if f_c is not None:
        ax.plot(f_c, 0, 'go', markersize=8, markerfacecolor='white')
        ax.text(f_c*1.3, -9, f'$f_c$ = {f_c:.1f} Hz', fontsize=9, color='g')

    # Formatting
    ax.axhline(y=0, color='k', linestyle=':', alpha=0.3, linewidth=1)
    ax.set_xlabel('Frequency (Hz)', fontsize=11)
    ax.set_ylabel('Gain (dB)', fontsize=11)
    ax.set_title(f'{case_label}: $A_0$ = {20*np.log10(A0):.0f} dB', fontsize=13, fontweight='bold')
    ax.grid(True, which='both', alpha=0.3)
    ax.legend(loc='lower left', fontsize=10)
    ax.set_xlim([1, 1e6])
    ax.set_ylim([-40, ylim_max])

    # Parameter text box
    param_text = f'$A_0$ = {20*np.log10(A0):.0f} dB\n$f_{{OL}}$ = {f_OL} Hz\nGBW = {GBW:.0f} Hz'
    ax.text(0.98, 0.98, param_text, transform=ax.transAxes,
            fontsize=9, verticalalignment='top', horizontalalignment='right',
            bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))

    return GBW, L0, f_CL, A_CL_DC

# Create figure with two vertically stacked subplots
fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10, 12))

# Case 1: A0 = 60 dB
GBW_1, L0_1, f_CL_1, A_CL_DC_1 = plot_case(ax1, A0=1000, f_OL=100, beta=0.1,
                                            case_label='Case 1', ylim_max=80)

# Case 2: A0 = 80 dB
GBW_2, L0_2, f_CL_2, A_CL_DC_2 = plot_case(ax2, A0=10000, f_OL=10, beta=0.1,
                                            case_label='Case 2', ylim_max=100)

# Overall title
fig.suptitle('Comparison: Same GBW, Different Open-Loop Gain', fontsize=15, fontweight='bold')

# Save figure
plt.tight_layout()
output_path = Path(__file__).parent.parent / 'figures' / 'bandwidth_comparison.png'
output_path.parent.mkdir(parents=True, exist_ok=True)
plt.savefig(output_path, dpi=300, bbox_inches='tight')
print(f"Figure saved to: {output_path}")

# Print comparison
print(f"\n{'='*60}")
print(f"Case 1 (A0 = 60 dB):")
print(f"  Closed-loop bandwidth: f_CL = {f_CL_1:.0f} Hz")
print(f"  Loop gain: L0 = {20*np.log10(L0_1):.0f} dB")
print(f"  GBW = {GBW_1:.0f} Hz")

print(f"\nCase 2 (A0 = 80 dB):")
print(f"  Closed-loop bandwidth: f_CL = {f_CL_2:.0f} Hz")
print(f"  Loop gain: L0 = {20*np.log10(L0_2):.0f} dB")
print(f"  GBW = {GBW_2:.0f} Hz")

print(f"\n{'='*60}")
print(f"Key Insight: Both cases have the same GBW = {GBW_1:.0f} Hz")
print("Higher A0 improves DC gain accuracy at fixed beta; closed-loop bandwidth approaches beta * GBW.")
print("Single-pole, linear negative-feedback model; PSRR and distortion require additional models.")
