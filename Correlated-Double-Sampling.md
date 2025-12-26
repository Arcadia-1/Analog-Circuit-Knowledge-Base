# Correlated Double Sampling (CDS)

<!--
Input: Internet research, technical papers on CDS for noise reduction
Output: Formulas and techniques for correlated double sampling
Position: Fundamental noise reduction technique for reset noise and low-frequency noise
⚠️ After any change, update this comment AND .PROJECT.md
-->

## Overview

**Correlated Double Sampling (CDS)** removes offset, reset noise, and 1/f noise by subtracting two correlated samples.

$$\boxed{V_{\mathrm{out}} = V_{\mathrm{signal}} - V_{\mathrm{reset}}}$$

---

## Frequency Response & Noise Shaping

$$\boxed{H_{\mathrm{CDS}}(f) = 2j \sin(\pi f T_s) \cdot e^{-j\pi f T_s}}$$

$$\boxed{|H_{\mathrm{CDS}}(f)| = 2 \left|\sin(\pi f T_s)\right|}$$

$$\boxed{|H_{\mathrm{CDS}}(f)|^2 = 4\sin^2(\pi f T_s)}$$

Zero at DC → offset and 1/f noise rejection. 1/f suppression: $\approx 1/(2\pi f_c T_s)$.

---

## Reset Noise Cancellation

CDS eliminates correlated kT/C reset noise by subtraction: $V_{\mathrm{CDS}} = V_{\mathrm{signal}} - V_{\mathrm{reset}} = \Delta V_{\mathrm{signal}}$.

$$\boxed{V_{n,\mathrm{residual}}^2 = \frac{kT}{C} \cdot \epsilon}$$

where $\epsilon$ = 0.01-0.1 (residual factor due to incomplete correlation).

---

## Implementation

### Switched-Capacitor CDS

$$\boxed{V_{\mathrm{out}} = \frac{C_s}{C_F} \cdot (V_{\mathrm{signal}} - V_{\mathrm{reset}})}$$

$$V_{n,\mathrm{total}}^2 = \frac{kT}{C_s} + \frac{kT}{C_F} + V_{n,\mathrm{amp}}^2$$

### Digital CDS

$$D_{\mathrm{out}} = D_2 - D_1$$

---

## Correlated Multiple Sampling (CMS)

$$\boxed{V_{\mathrm{CMS}} = \frac{1}{N} \sum_{i=1}^{N} V_{\mathrm{signal}}(i) - \frac{1}{N} \sum_{i=1}^{N} V_{\mathrm{reset}}(i)}$$

$$\boxed{\sigma_{n,\mathrm{CMS}} = \frac{\sigma_{n,\mathrm{single}}}{\sqrt{N}}}$$

---

## Noise Analysis

$$\boxed{\sigma_{n,\mathrm{total}}^2 = 2 \cdot \frac{kT}{C} + K_{1/f} \cdot f_c \cdot T_s + 2 \cdot V_{n,\mathrm{amp}}^2}$$

$$\boxed{BW_{\mathrm{noise,CDS}} = \frac{1}{2T_s}}$$

---

## Design Equations

### Capacitor Sizing

$$\boxed{C_{\mathrm{CDS}} = \frac{2kT \cdot 10^{\mathrm{SNR}/10}}{V_{\mathrm{signal}}^2}}$$

### Sampling Time

$$\boxed{T_s \ll \frac{1}{f_c}}$$

where $f_c$ is the 1/f corner frequency.

### Amplifier Bandwidth

$$\boxed{BW_{\mathrm{amp}} \geq \frac{n}{2\pi T_s}}$$

where $n$ = 5-7 time constants for settling.

---

## Applications

- **CMOS Image Sensors:** Removes reset noise, fixed pattern noise, 1/f noise
- **CCD Readout:** Ultra-low noise (3-10 e⁻ RMS with CDS, <1 e⁻ with CMS)
- **SAR ADC Comparators:** Offset and 1/f noise reduction
- **SC Circuits:** Auto-zero for amplifiers, filters, integrators
- **Sensor Interfaces:** Removes DC offset and drift

---

## Comparison with Other Techniques

| Technique | Offset | 1/f Noise | White Noise | Reset Noise | Complexity |
|-----------|--------|-----------|-------------|-------------|------------|
| **CDS** | Excellent | Excellent | Doubles | Excellent | Low |
| **Auto-Zero** | Excellent | Good | Doubles | Good | Low |
| **Chopping** | Excellent | Excellent | No change | No effect | Medium |
| **kT/C Cancellation** | No effect | No effect | Reduces | Excellent | Medium |
| **CMS** | Excellent | Excellent | Reduces 1/√N | Excellent | Medium |

