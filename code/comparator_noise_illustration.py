"""
Generate illustration plots for comparator noise calculation
"""
import numpy as np
import matplotlib.pyplot as plt
from scipy import stats

# Set style
plt.rcParams['font.size'] = 11
plt.rcParams['axes.labelsize'] = 12
plt.rcParams['axes.titlesize'] = 13
plt.rcParams['figure.dpi'] = 150

def plot_gaussian_cdf():
    """Plot Gaussian PDF and CDF with threshold illustration"""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4.5))

    # Parameters
    mu = 0
    sigma = 600e-6  # 600 uV
    x = np.linspace(-1500e-6, 1800e-6, 1000)

    # PDF
    pdf = stats.norm.pdf(x, mu, sigma)
    ax1.plot(x*1e6, pdf*1e6, 'b-', linewidth=2.5, label='PDF')
    ax1.fill_between(x*1e6, 0, pdf*1e6, alpha=0.3)
    ax1.axvline(0, color='k', linestyle='--', linewidth=1.5, alpha=0.5)
    ax1.set_xlabel('Noise Voltage (μV)', fontsize=12)
    ax1.set_ylabel('Probability Density (1/μV)', fontsize=12)
    ax1.set_title('Gaussian Distribution PDF\n(μ=0, σ=600μV)', fontsize=13, fontweight='bold')
    ax1.grid(True, alpha=0.3)
    ax1.legend(fontsize=10)
    ax1.tick_params(labelsize=10)

    # CDF with threshold
    cdf = stats.norm.cdf(x, mu, sigma)
    ax2.plot(x*1e6, cdf, 'b-', linewidth=2.5, label='CDF: Φ(x/σ)')

    # Mark specific points - cleaner set
    thresholds = [-900, -600, -300, 0, 300, 600, 900]
    marker_color = 'green'  # Use single color for all markers

    # Text positioning strategy: place boxes on the curve, with special positioning for extremes
    for idx, v_th in enumerate(thresholds):
        prob = stats.norm.cdf(v_th*1e-6, mu, sigma)
        ax2.plot(v_th, prob, 'o', color=marker_color, markersize=7, zorder=3)
        ax2.axvline(v_th, color=marker_color, linestyle='--', linewidth=0.8, alpha=0.4)
        ax2.axhline(prob, color=marker_color, linestyle='--', linewidth=0.8, alpha=0.4)


        y_offset = 0
        va = 'center'

        ax2.text(v_th, prob + y_offset, f'{v_th}μV\n{prob:.1%}',
                fontsize=7, color=marker_color, ha='center', va=va,
                bbox=dict(boxstyle='round,pad=0.3', facecolor='white',
                         alpha=0.9, edgecolor=marker_color, linewidth=1.2))

    ax2.set_xlabel('Threshold Voltage (μV)', fontsize=12)
    ax2.set_ylabel('Cumulative Probability', fontsize=12)
    ax2.set_title('Cumulative Distribution Function\n(μ=0, σ=600μV)', fontsize=13, fontweight='bold')
    ax2.grid(True, alpha=0.3)
    ax2.legend(fontsize=10)
    ax2.set_ylim([0, 1])
    ax2.tick_params(labelsize=10)

    plt.tight_layout()
    plt.savefig('../figures/gaussian_distribution.png', bbox_inches='tight')
    print("Saved: gaussian_distribution.png")
    plt.close()

def plot_gaussian_different_mu():
    """Plot Gaussian PDFs and CDFs with different mean values"""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4.5))

    # Parameters
    sigma = 600e-6  # 600 uV - constant
    mu_values = [-1000e-6, 0, 1000e-6]  # Different means: -1mV, 0, +1mV
    colors = ['blue', 'green', 'red']
    x = np.linspace(-2500e-6, 2500e-6, 2000)

    # Plot PDFs
    for mu, color in zip(mu_values, colors):
        pdf = stats.norm.pdf(x, mu, sigma)
        ax1.plot(x*1e6, pdf*1e6, linewidth=2.5, color=color,
                label=f'μ={mu*1e6:.0f}μV')
        ax1.axvline(mu*1e6, color=color, linestyle='--', linewidth=1, alpha=0.5)

    ax1.set_xlabel('Voltage (μV)', fontsize=12)
    ax1.set_ylabel('Probability Density (1/μV)', fontsize=12)
    ax1.set_title('Gaussian PDF with Different Mean (μ)\nσ = 600μV (constant)',
                 fontsize=13, fontweight='bold')
    ax1.legend(fontsize=10)
    ax1.grid(True, alpha=0.3)
    ax1.set_xlim([-2500, 2500])
    ax1.tick_params(labelsize=10)

    # Plot CDFs
    for mu, color in zip(mu_values, colors):
        cdf = stats.norm.cdf(x, mu, sigma)
        ax2.plot(x*1e6, cdf, linewidth=2.5, color=color,
                label=f'μ={mu*1e6:.0f}μV')
        ax2.axvline(mu*1e6, color=color, linestyle='--', linewidth=1, alpha=0.5)
        # Mark 50% point (at mean)
        ax2.plot(mu*1e6, 0.5, 'o', color=color, markersize=8)

    ax2.axhline(0.5, color='black', linestyle=':', linewidth=1.5, alpha=0.5, label='50% probability')
    ax2.set_xlabel('Voltage (μV)', fontsize=12)
    ax2.set_ylabel('Cumulative Probability', fontsize=12)
    ax2.set_title('Gaussian CDF with Different Mean (μ)\nσ = 600μV (constant)',
                 fontsize=13, fontweight='bold')
    ax2.legend(fontsize=10)
    ax2.grid(True, alpha=0.3)
    ax2.set_xlim([-2500, 2500])
    ax2.set_ylim([0, 1])
    ax2.tick_params(labelsize=10)

    plt.tight_layout()
    plt.savefig('../figures/gaussian_different_mu.png', bbox_inches='tight')
    print("Saved: gaussian_different_mu.png")
    plt.close()

def plot_comparator_scenarios():
    """Plot comparator output probability for different input voltages"""
    fig, axes = plt.subplots(2, 3, figsize=(15, 8))
    axes = axes.flatten()

    sigma = 600e-6  # 600 uV
    v_inputs = [0, 300e-6, 600e-6, 900e-6, 1200e-6, 1500e-6]

    for idx, v_in in enumerate(v_inputs):
        ax = axes[idx]

        # Plot Gaussian centered at v_in
        x = np.linspace(-3*sigma, 3*sigma, 1000)
        pdf = stats.norm.pdf(x, 0, sigma)

        # Shade area where output would be 0 (x < v_in - x_noise)
        # For comparator: output = 1 if (V_in + V_noise) > 0
        # P(output = 0) = P(V_noise < -V_in)
        x_fill = x[x < v_in]
        pdf_fill = stats.norm.pdf(x_fill, 0, sigma)

        ax.plot(x*1e6, pdf*1e6, 'b-', linewidth=2)
        ax.fill_between(x_fill*1e6, 0, pdf_fill*1e6, color='red', alpha=0.4, label='Output = 0')
        ax.fill_between(x[x >= v_in]*1e6, 0, stats.norm.pdf(x[x >= v_in], 0, sigma)*1e6,
                       color='green', alpha=0.4, label='Output = 1')

        # Mark input voltage
        ax.axvline(v_in*1e6, color='black', linestyle='--', linewidth=2, label=f'V_in={v_in*1e6:.0f}μV')

        # Calculate probabilities
        p_zero = stats.norm.cdf(v_in, 0, sigma)
        p_one = 1 - p_zero

        ax.set_xlabel('Noise (μV)')
        ax.set_ylabel('Probability Density (1/μV)')
        ax.set_title(f'V_in = {v_in*1e6:.0f}μV (σ = 600μV)\nP(out=0) = {p_zero:.1%}, P(out=1) = {p_one:.1%}')
        ax.grid(True, alpha=0.3)
        ax.legend(fontsize=9)
        ax.set_xlim([-2000, 2000])

    plt.tight_layout()
    plt.savefig('../figures/comparator_scenarios.png', bbox_inches='tight')
    print("Saved: comparator_scenarios.png")
    plt.close()

def plot_sigma_extraction():
    """Plot how sigma is extracted from probability measurement"""
    fig, ax = plt.subplots(figsize=(8, 5))

    # Show measurement concept
    sigma = 600e-6
    v_in = 550e-6
    x = np.linspace(-3*sigma, 3*sigma, 1000)
    pdf = stats.norm.pdf(x, 0, sigma)

    p_one = 1 - stats.norm.cdf(v_in, 0, sigma)

    ax.plot(x*1e6, pdf*1e6, 'b-', linewidth=2.5, label='Noise PDF')
    ax.fill_between(x[x >= v_in]*1e6, 0, stats.norm.pdf(x[x >= v_in], 0, sigma)*1e6,
                    color='green', alpha=0.4, label=f'P(out=1) = {p_one:.1%}')
    ax.fill_between(x[x < v_in]*1e6, 0, stats.norm.pdf(x[x < v_in], 0, sigma)*1e6,
                    color='red', alpha=0.3, label=f'P(out=0) = {1-p_one:.1%}')
    ax.axvline(v_in*1e6, color='black', linestyle='--', linewidth=2.5, label=f'V_in = {v_in*1e6:.0f}μV')

    ax.set_xlabel('Noise Voltage (μV)', fontsize=12)
    ax.set_ylabel('Probability Density (1/μV)', fontsize=12)
    ax.set_title('Noise Extraction from Probability Measurement', fontsize=13, fontweight='bold')
    ax.legend(fontsize=10, loc='upper right')
    ax.grid(True, alpha=0.3)

    # Add annotation
    ax.annotate(f'Measured:\n  V_in = {v_in*1e6:.0f}μV\n  P(out=1) = {p_one:.1%}\n\nCalculated:\n  σ = V_in/Φ⁻¹(P)\n  σ = {sigma*1e6:.0f}μV',
                xy=(v_in*1e6, stats.norm.pdf(v_in, 0, sigma)*1e6),
                xytext=(900, 1.0e-3),
                fontsize=11,
                bbox=dict(boxstyle='round', facecolor='yellow', alpha=0.8, edgecolor='black', linewidth=1.5),
                arrowprops=dict(arrowstyle='->', lw=2, connectionstyle='arc3,rad=0.3'))

    plt.tight_layout()
    plt.savefig('../figures/sigma_extraction.png', bbox_inches='tight')
    print("Saved: sigma_extraction.png")
    plt.close()

def plot_probability_vs_input():
    """Plot probability vs input voltage for different sigma values"""
    fig, ax = plt.subplots(figsize=(10, 6))

    v_inputs = np.linspace(-2000e-6, 2000e-6, 1000)
    sigmas = [300e-6, 600e-6, 900e-6]
    colors = ['blue', 'green', 'red']

    for sigma, color in zip(sigmas, colors):
        probabilities = 1 - stats.norm.cdf(v_inputs, 0, sigma)
        ax.plot(v_inputs*1e6, probabilities*100, color=color, linewidth=2,
               label=f'σ = {sigma*1e6:.0f}μV')

    # Mark key probability levels
    for p_level, p_label in [(50, '50%'), (84.13, '84.13% (1σ)'), (97.72, '97.72% (2σ)')]:
        ax.axhline(p_level, color='gray', linestyle='--', linewidth=1, alpha=0.5)
        ax.text(1800, p_level+2, p_label, fontsize=9, color='gray')

    ax.set_xlabel('Input Voltage (μV)')
    ax.set_ylabel('P(output = 1) [%]')
    ax.set_title('Comparator Output Probability vs Input Voltage')
    ax.legend()
    ax.grid(True, alpha=0.3)
    ax.set_xlim([-2000, 2000])
    ax.set_ylim([0, 100])

    plt.tight_layout()
    plt.savefig('../figures/probability_vs_input.png', bbox_inches='tight')
    print("Saved: probability_vs_input.png")
    plt.close()

if __name__ == '__main__':
    print("Generating comparator noise illustration plots...")
    plot_gaussian_cdf()
    plot_gaussian_different_mu()
    plot_comparator_scenarios()
    plot_sigma_extraction()
    plot_probability_vs_input()
    print("All plots generated successfully!")
