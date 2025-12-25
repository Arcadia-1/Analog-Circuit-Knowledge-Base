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

## Transfer Function

$$\boxed{H_{\mathrm{CDS}}(f) = 2j \sin(\pi f T_s) \cdot e^{-j\pi f T_s}}$$

where $T_s$ is the sampling period.

**Magnitude:**

$$\boxed{|H_{\mathrm{CDS}}(f)| = 2 \left|\sin(\pi f T_s)\right|}$$

**Zero at DC** provides offset and 1/f noise rejection.

## Noise Transfer Function

For white noise input:

$$S_{n,\mathrm{out}}(f) = S_{n,\mathrm{in}}(f) \cdot |H_{\mathrm{CDS}}(f)|^2$$

$$\boxed{|H_{\mathrm{CDS}}(f)|^2 = 4\sin^2(\pi f T_s)}$$

**1/f noise suppression:**

$$\mathrm{Suppression} \approx \frac{1}{2\pi f_c T_s}$$

where $f_c$ is the 1/f corner frequency.

---

## Reset Noise Cancellation

$$V_{\mathrm{reset}} = V_{\mathrm{ref}} + \sqrt{\frac{kT}{C}} \cdot n_1$$

$$V_{\mathrm{signal}} = V_{\mathrm{ref}} + \sqrt{\frac{kT}{C}} \cdot n_1 + \Delta V_{\mathrm{signal}}$$

$$\boxed{V_{\mathrm{CDS}} = V_{\mathrm{signal}} - V_{\mathrm{reset}} = \Delta V_{\mathrm{signal}}}$$

**Residual noise:**

$$\boxed{V_{n,\mathrm{residual}}^2 = \frac{kT}{C} \cdot \epsilon}$$

where $\epsilon$ = 0.01-0.1 (residual factor).

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

**White noise penalty:** CDS doubles white noise power.

$$\frac{\sigma_{n,\mathrm{CDS}}^2}{\sigma_{n,\mathrm{single}}^2} = 2$$

**Noise bandwidth:**

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

---

## Key Formulas Summary

### Basic CDS

$$V_{\mathrm{CDS}} = V_{\mathrm{signal}} - V_{\mathrm{reset}}$$

### Transfer Function

$$H_{\mathrm{CDS}}(f) = 2j\sin(\pi f T_s) \cdot e^{-j\pi f T_s}$$

$$|H_{\mathrm{CDS}}(f)| = 2|\sin(\pi f T_s)|$$

### Noise

$$\sigma_{n,\mathrm{white}}^2 = 2 \cdot \frac{kT}{C}$$

$$\sigma_{n,\mathrm{total}}^2 = 2 \cdot \frac{kT}{C} + 2 \cdot V_{n,\mathrm{amp}}^2$$

### CMS

$$\sigma_{n,\mathrm{CMS}} = \frac{\sigma_{n,\mathrm{CDS}}}{\sqrt{N}}$$

---

## References and Sources

- [Correlated double sampling - Wikipedia](https://en.wikipedia.org/wiki/Correlated_double_sampling)
- [Noise transfer characteristics of a correlated double sampling circuit](https://ieeexplore.ieee.org/document/1085840/)
- [Optimal CCD readout by digital correlated double sampling](https://academic.oup.com/mnras/article-pdf/455/2/1443/18513594/stv2410.pdf)
- [Correlated Multiple Sampling Techniques](https://ieeexplore.ieee.org/document/9238159)

---

## Related Topics

See also:
- [kTC-Noise-Cancellation.md](kTC-Noise-Cancellation.md) - Reset noise cancellation
- [Correlated-Level-Shifting.md](Correlated-Level-Shifting.md) - Gain enhancement
- [Floating-Inverter-Amplifier.md](Floating-Inverter-Amplifier.md) - Dynamic amplifiers
