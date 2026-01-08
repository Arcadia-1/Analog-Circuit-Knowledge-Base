"""
Degenerated Resistor Sizing Calculator
Calculates the relationship between Rs and RL for matched charging time
Based on: RL = 1.44 * (Rs + 1/gm)
"""

import numpy as np
import matplotlib.pyplot as plt
import os

# Design parameters
VDD = 0.8  # V
VTH = 0.26  # V (source degeneration case)
factor = (0.5 / 0.693) * (VDD / (VDD - VTH))  # = 1.07 for VDD=0.8V, VTH=0.26V

print("=" * 60)
print("Degenerated Resistor Sizing Calculator")
print("=" * 60)
print(f"Design Parameters:")
print(f"  VDD = {VDD} V")
print(f"  VTH = {VTH} V")
print(f"  Sizing factor = {factor:.3f}")
print(f"  Relationship: RL = {factor:.3f} * (Rs + 1/gm)")
print("=" * 60)

# Case 1: From Rs to RL
print("\n" + "=" * 60)
print("CASE 1: Given Rs, calculate RL")
print("=" * 60)

# Example calculations
gm_values = [10e-3, 20e-3, 30e-3]  # 10, 20, 30 mS
Rs_fixed = 150  # Ohm

print(f"\nFixed Rs = {Rs_fixed} Ω\n")
print(f"{'gm (mS)':<10} {'1/gm (Ω)':<12} {'Rs+1/gm (Ω)':<15} {'RL (Ω)':<10}")
print("-" * 60)

for gm in gm_values:
    inv_gm = 1 / gm
    sum_term = Rs_fixed + inv_gm
    RL = factor * sum_term
    print(f"{gm*1e3:<10.0f} {inv_gm:<12.0f} {sum_term:<15.0f} {RL:<10.0f}")

# Case 2: From RL to Rs
print("\n" + "=" * 60)
print("CASE 2: Given RL, calculate Rs")
print("=" * 60)

RL_fixed = 200  # Ohm

print(f"\nFixed RL = {RL_fixed} Ω\n")
print(f"{'gm (mS)':<10} {'1/gm (Ω)':<12} {'Req Rs (Ω)':<15} {'Rs+1/gm (Ω)':<15}")
print("-" * 60)

for gm in gm_values:
    inv_gm = 1 / gm
    sum_term = RL_fixed / factor
    Rs_req = sum_term - inv_gm
    print(f"{gm*1e3:<10.0f} {inv_gm:<12.0f} {Rs_req:<15.0f} {sum_term:<15.0f}")

# Visualization
print("\n" + "=" * 60)
print("Generating visualization...")
print("=" * 60)

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))

# Plot 1: Fixed gm, sweep Rs to calculate RL
Rs_sweep = np.linspace(50, 300, 100)  # Sweep Rs from 50 to 300 Ohm
gm_values_plot = [10e-3, 20e-3, 30e-3]  # Different gm values

for gm in gm_values_plot:
    RL_sweep = factor * (Rs_sweep + 1/gm)
    ax1.plot(Rs_sweep, RL_sweep, linewidth=2, label=f'gm = {gm*1e3:.0f} mS')

ax1.set_xlabel('Rs [Ω]', fontsize=14)
ax1.set_ylabel('Required RL [Ω]', fontsize=14)
ax1.set_title('Case 1: Rs → RL\n(Fixed gm, varying Rs)', fontsize=14, fontweight='bold')
ax1.grid(True, alpha=0.3)
ax1.legend(fontsize=12)
ax1.tick_params(axis='both', which='major', labelsize=12)

# Plot 2: Fixed gm, sweep RL to calculate Rs
RL_sweep = np.linspace(100, 400, 100)  # Sweep RL from 100 to 400 Ohm

for gm in gm_values_plot:
    Rs_sweep = RL_sweep / factor - 1/gm
    ax2.plot(RL_sweep, Rs_sweep, linewidth=2, label=f'gm = {gm*1e3:.0f} mS')

ax2.set_xlabel('RL [Ω]', fontsize=14)
ax2.set_ylabel('Required Rs [Ω]', fontsize=14)
ax2.set_title('Case 2: RL → Rs\n(Fixed gm, varying RL)', fontsize=14, fontweight='bold')
ax2.grid(True, alpha=0.3)
ax2.legend(fontsize=12)
ax2.tick_params(axis='both', which='major', labelsize=12)

plt.tight_layout()

# Save figure
script_dir = os.path.dirname(os.path.abspath(__file__))
output_path = os.path.join(script_dir, 'degeneration_resistor_sizing.png')
plt.savefig(output_path, dpi=300, bbox_inches='tight')
print(f"Figure saved to: {output_path}")
plt.close()

# Plot 3: Sweep gm, show RL/Rs ratio
print("\n" + "=" * 60)
print("Generating RL/Rs ratio plot...")
print("=" * 60)

fig, ax3 = plt.subplots(1, 1, figsize=(10, 6))

gm_sweep = np.linspace(5e-3, 50e-3, 100)  # Sweep gm from 5 to 50 mS
Rs_values_ratio = [100, 150, 200, 250]  # Different Rs values

for Rs in Rs_values_ratio:
    # RL = factor * (Rs + 1/gm)
    # RL/Rs = factor * (Rs + 1/gm) / Rs = factor * (1 + 1/(gm*Rs))
    RL_Rs_ratio = factor * (1 + 1/(gm_sweep * Rs))
    ax3.plot(gm_sweep * 1e3, RL_Rs_ratio, linewidth=2, label=f'Rs = {Rs} Ω')

ax3.axhline(y=1, color='red', linestyle='--', linewidth=1, alpha=0.5, label='RL = Rs')

ax3.set_xlabel('gm [mS]', fontsize=14)
ax3.set_ylabel('RL/Rs Ratio', fontsize=14)
ax3.set_title('Resistance Ratio vs Transconductance\n(Fixed Rs, varying gm)', fontsize=14, fontweight='bold')
ax3.grid(True, alpha=0.3)
ax3.legend(fontsize=12, loc='upper right')
ax3.tick_params(axis='both', which='major', labelsize=12)

plt.tight_layout()

# Save figure
output_path_ratio = os.path.join(script_dir, 'degeneration_resistor_ratio.png')
plt.savefig(output_path_ratio, dpi=300, bbox_inches='tight')
print(f"Figure saved to: {output_path_ratio}")
plt.close()

print("\n" + "=" * 60)
print("Calculation complete!")
print("=" * 60)
