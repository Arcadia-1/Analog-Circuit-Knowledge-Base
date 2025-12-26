# Current Integration Sampling

<!--
Input: Internet research, technical papers, reference/积分采样JItter问题.pdf
Output: Formulas and techniques for current integration sampling, jitter analysis
Position: Current-mode signal processing, integrating ADCs, jitter performance
⚠️ Updated: Added jitter performance analysis comparing voltage vs current integration sampling
-->

## Overview

**Current Integration Sampling** converts current signals to voltage by integrating on a capacitor, enabling high-precision measurement of small currents from sensors (photodiodes, current-mode circuits) and forming the basis for integrating ADCs.

$$\boxed{V_{\mathrm{out}}(t) = \frac{1}{C} \int_0^t I_{\mathrm{in}}(\tau) \, d\tau + V_0}$$

---

## Fundamental Equations

### Capacitor Current-Voltage Relationship

$$\boxed{Q = CV}$$

$$\boxed{I = C \frac{dV}{dt}}$$

**Integral form:**

$$\boxed{V(t) = \frac{1}{C} \int_{t_0}^{t} I(\tau) \, d\tau + V(t_0)}$$

### Constant Current Integration

For constant input current $I_{\mathrm{in}}$:

$$\boxed{V_{\mathrm{out}}(t) = V_0 + \frac{I_{\mathrm{in}}}{C} \cdot t}$$

**Voltage ramp slope:**

$$\boxed{\frac{dV}{dt} = \frac{I_{\mathrm{in}}}{C}}$$

### Integration Gain

$$\boxed{G_{\mathrm{int}} = \frac{V_{\mathrm{out}}}{Q_{\mathrm{in}}} = \frac{1}{C}}$$

where $Q_{\mathrm{in}} = \int I_{\mathrm{in}} \, dt$ is the integrated charge.

---

## Integrating ADC Architectures

### 1. Dual-Slope ADC

**Phase 1: Integration (fixed time $T_{\mathrm{int}}$)**

Integrate input voltage $V_{\mathrm{in}}$:

$$V_{\mathrm{int}}(T_{\mathrm{int}}) = -\frac{1}{RC} \int_0^{T_{\mathrm{int}}} V_{\mathrm{in}} \, dt = -\frac{V_{\mathrm{in}} \cdot T_{\mathrm{int}}}{RC}$$

**Phase 2: De-integration (measured time $T_{\mathrm{deint}}$)**

Integrate reference voltage $-V_{\mathrm{ref}}$ until output returns to zero:

$$V_{\mathrm{int}}(T_{\mathrm{int}}) + \frac{V_{\mathrm{ref}} \cdot T_{\mathrm{deint}}}{RC} = 0$$

**Digital output:**

$$\boxed{\frac{V_{\mathrm{in}}}{V_{\mathrm{ref}}} = \frac{T_{\mathrm{deint}}}{T_{\mathrm{int}}}}$$

**Key advantage:** Independent of $R$ and $C$ values.

### 2. Incremental Delta-Sigma ADC

**First-order modulator:**

$$\boxed{y[n] = y[n-1] + x[n] - \mathrm{DAC}[n-1]}$$

where:
- $x[n]$ = input sample
- $y[n]$ = integrator output
- $\mathrm{DAC}[n]$ = feedback (1-bit DAC output)

**Digital output (after $N$ samples):**

$$\boxed{D_{\mathrm{out}} = \frac{1}{N} \sum_{n=0}^{N-1} \mathrm{DAC}[n]}$$

**Resolution:**

$$\boxed{\mathrm{ENOB} = \log_2(N) + \frac{L+1}{2} \cdot \log_2(\mathrm{OSR})}$$

where:
- $L$ = modulator order
- $\mathrm{OSR}$ = oversampling ratio
- $N$ = number of samples per conversion

### 3. Multi-Slope ADC

Extension of dual-slope using multiple reference levels for faster conversion:

$$\boxed{V_{\mathrm{in}} = \sum_{i} \alpha_i \cdot V_{\mathrm{ref,i}}}$$

where $\alpha_i$ are digitally determined coefficients.

---

## Current-Mode Sensor Interfaces

### Photodiode Integrator

**Transimpedance integrator:**

$$\boxed{V_{\mathrm{out}}(t) = -\frac{1}{C_{\mathrm{int}}} \int_0^{T_{\mathrm{int}}} I_{\mathrm{PD}}(t) \, dt}$$

where:
- $I_{\mathrm{PD}}$ = photodiode current
- $C_{\mathrm{int}}$ = integration capacitor
- $T_{\mathrm{int}}$ = integration time

**Total integrated charge:**

$$\boxed{Q_{\mathrm{total}} = \int_0^{T_{\mathrm{int}}} I_{\mathrm{PD}}(t) \, dt = C_{\mathrm{int}} \cdot V_{\mathrm{out}}}$$

**Sensitivity:**

$$\boxed{S = \frac{V_{\mathrm{out}}}{Q_{\mathrm{total}}} = \frac{1}{C_{\mathrm{int}}}}$$

### Switched Integrator

**IVC102-type architecture:**

**Integration phase ($\phi_1 = 1$):**

$$V_{\mathrm{out}}(t) = V_{\mathrm{reset}} - \frac{1}{C_{\mathrm{int}}} \int_0^t I_{\mathrm{in}}(\tau) \, d\tau$$

**Hold phase ($\phi_2 = 1$):**

$$V_{\mathrm{hold}} = V_{\mathrm{out}}(T_{\mathrm{int}})$$

**Full-scale voltage:**

$$\boxed{V_{\mathrm{FS}} = \frac{I_{\mathrm{max}} \cdot T_{\mathrm{int}}}{C_{\mathrm{int}}}}$$

---

## Noise Analysis

### Thermal Noise (kT/C)

**Reset noise on integration capacitor:**

$$\boxed{V_{n,\mathrm{reset}}^2 = \frac{kT}{C_{\mathrm{int}}}}$$

**After integration over time $T$:**

$$\boxed{V_{n,\mathrm{int}}^2 = \frac{kT}{C_{\mathrm{int}}} + \frac{e_n^2 \cdot T}{C_{\mathrm{int}}^2}}$$

where $e_n$ is amplifier input voltage noise density.

### Charge Noise

$$\boxed{Q_n^2 = kTC_{\mathrm{int}}}$$

$$\boxed{Q_{n,\mathrm{rms}} = \sqrt{kTC_{\mathrm{int}}}}$$

At room temperature ($T = 300$ K):

| $C_{\mathrm{int}}$ | $Q_{n,\mathrm{rms}}$ |
|---|---|
| 1 pF | 64 e⁻ |
| 10 pF | 203 e⁻ |
| 100 pF | 642 e⁻ |

### Shot Noise

For photodiode current:

$$\boxed{i_n^2 = 2qI_{\mathrm{PD}} \Delta f}$$

**Integrated shot noise charge:**

$$\boxed{Q_{n,\mathrm{shot}}^2 = 2qI_{\mathrm{PD}} \cdot T_{\mathrm{int}}}$$

### Total Noise (RMS)

$$\boxed{Q_{n,\mathrm{total}} = \sqrt{kTC_{\mathrm{int}} + 2qI_{\mathrm{PD}} \cdot T_{\mathrm{int}} + e_n^2 C_{\mathrm{int}}^2 / T_{\mathrm{int}}}}$$

---

## Jitter Performance

### Voltage Sampling vs. Current Integration Sampling

**Voltage sampling jitter sensitivity:**

$$\boxed{\mathrm{SNR}_{\mathrm{voltage}} = \left(\frac{1}{2\pi f}\right)^2 \cdot \frac{1}{\sigma^2}}$$

where $\sigma$ is the timing jitter RMS.

**Current integration sampling:**

The effective sampling time is the **average of two sampling edges**:

$$\boxed{t_{\mathrm{eff}} = \frac{t_2 + t_1}{2}}$$

This averaging reduces jitter sensitivity compared to single-edge voltage sampling.

### SNR Improvement Ratio

$$\boxed{\frac{\mathrm{SNR}_{\mathrm{inte}}}{\mathrm{SNR}_{\mathrm{voltage}}} = 2\sin^2\left(\pi f T_{\mathrm{int}}\right) \cdot \frac{\sigma^2}{\sigma^2 - \rho\sigma_1\sigma_2\cos(2\pi f T_{\mathrm{int}})}}$$

where:
- $T_{\mathrm{int}}$ = integration time
- $\rho$ = correlation coefficient between edge jitters ($-1 \leq \rho \leq 1$)
- $\sigma_1, \sigma_2$ = jitter RMS of each edge

### Correlation Factor Effects

**Case 1: Uncorrelated edges ($\rho = 0$)**

$$\boxed{\frac{\mathrm{SNR}_{\mathrm{inte}}}{\mathrm{SNR}_{\mathrm{voltage}}} = 2\sin^2\left(\pi f T_{\mathrm{int}}\right)}$$

**Maximum improvement:** 3 dB at $f \cdot T_{\mathrm{int}} = 1/2$

**Case 2: Fully correlated edges ($\rho = 1$)**

No jitter advantage; integration sampling performs same as voltage sampling.

**Case 3: Anti-correlated edges ($\rho = -1$)**

Maximum jitter rejection; best case for integration sampling.

### Practical Example

**High-speed ADC (128 GS/s, $T_{\mathrm{int}} = 8$ ps):**

- Without integration: SNR ≈ 34 dB (limited by jitter)
- With current integration ($\rho = 0$): SNR ≈ 37 dB
- **Improvement:** 3 dB at optimal frequency

### Design Guideline

$$\boxed{f_{\mathrm{optimal}} = \frac{1}{2T_{\mathrm{int}}}}$$

Maximize jitter advantage by operating near this frequency for uncorrelated sampling edges.

---

## Design Equations

### Capacitor Sizing

**For required charge resolution $Q_{\mathrm{min}}$:**

$$\boxed{C_{\mathrm{int}} \leq \frac{kT}{(Q_{\mathrm{min}}/\mathrm{SNR})^2}}$$

**For full-scale range:**

$$\boxed{C_{\mathrm{int}} = \frac{Q_{\mathrm{FS}}}{V_{\mathrm{FS}}}}$$

where:
- $Q_{\mathrm{FS}}$ = full-scale charge
- $V_{\mathrm{FS}}$ = full-scale voltage (limited by supply)

### Integration Time

**For dual-slope ADC with N-bit resolution:**

$$\boxed{T_{\mathrm{int}} = 2^N \cdot T_{\mathrm{clk}}}$$

**For incremental ΔΣ ADC:**

$$\boxed{T_{\mathrm{int}} = N \cdot \mathrm{OSR} \cdot T_s}$$

where $T_s$ is the sample period.

### Dynamic Range

$$\boxed{\mathrm{DR} = \frac{Q_{\mathrm{FS}}}{Q_{n,\mathrm{total}}} = \frac{I_{\mathrm{max}} \cdot T_{\mathrm{int}}}{\sqrt{kTC_{\mathrm{int}} + 2qI_{\mathrm{dark}} \cdot T_{\mathrm{int}}}}}$$

### Amplifier Bandwidth Requirement

For settling accuracy $\epsilon$:

$$\boxed{BW_{\mathrm{amp}} \geq \frac{\ln(1/\epsilon)}{2\pi T_{\mathrm{int}}}}$$

---

## Practical Implementation

### Op-Amp Integrator

**Transfer function:**

$$\boxed{H(s) = -\frac{1}{sRC}}$$

**Time-domain output:**

$$V_{\mathrm{out}}(t) = -\frac{1}{RC} \int_0^t V_{\mathrm{in}}(\tau) \, d\tau$$

### Reset Mechanisms

**1. Switch reset:**
- Simple MOSFET switch in parallel with $C_{\mathrm{int}}$
- kT/C noise: $V_n^2 = kT/C_{\mathrm{int}}$

**2. Resistor reset:**
- High-value resistor for slow reset
- Time constant: $\tau = RC_{\mathrm{int}}$

**3. Active reset:**
- Additional amplifier for precise reset level
- Lower reset noise possible

### Correlated Double Sampling

**Remove reset noise and offset:**

**Sample 1 (reset):** $V_1 = V_{\mathrm{reset}} + V_{n,\mathrm{reset}}$

**Sample 2 (after integration):** $V_2 = V_{\mathrm{out}} + V_{n,\mathrm{reset}}$

**CDS output:**

$$\boxed{V_{\mathrm{CDS}} = V_2 - V_1 = V_{\mathrm{out}}}$$

Reset noise cancelled (see [Correlated-Double-Sampling.md](Correlated-Double-Sampling.md)).

---

## Applications

### 1. Photodiode Readout

**Applications:**
- Optical power meters
- Spectroscopy
- Imaging sensors (CCD/CMOS)
- LIDAR receivers

**Typical specs:**
- $C_{\mathrm{int}}$: 1-100 pF
- $T_{\mathrm{int}}$: 1 μs - 100 ms
- Resolution: 10-20 bits

### 2. Integrating ADCs

**Applications:**
- Digital multimeters (DMM)
- Precision instrumentation
- Temperature measurement
- Weight scales

**Advantages:**
- Excellent noise rejection (50/60 Hz)
- High resolution (>20 bits)
- Low cost

### 3. Charge Measurement

**Applications:**
- Capacitive sensors
- Coulomb counters (battery monitoring)
- Particle detectors
- MEMS sensors

### 4. Current Sensing

**Applications:**
- Power monitoring
- Motor control
- Battery management
- Current shunt measurement

---

## Comparison with Other Techniques

| Technique | Resolution | Speed | Noise | Complexity |
|-----------|-----------|-------|-------|-----------|
| **Current Integration** | High (>16 bit) | Slow-Medium | Low | Low |
| **Transimpedance Amp** | Medium | Fast | Medium | Low |
| **SAR ADC** | Medium (12-16 bit) | Fast | Medium | Medium |
| **ΔΣ ADC** | Very High (>20 bit) | Medium | Very Low | High |

---

## Key Formulas Summary

### Basic Integration

$$V_{\mathrm{out}}(t) = \frac{1}{C} \int_0^t I_{\mathrm{in}}(\tau) \, d\tau + V_0$$

$$\frac{dV}{dt} = \frac{I_{\mathrm{in}}}{C}$$

### Dual-Slope ADC

$$\frac{V_{\mathrm{in}}}{V_{\mathrm{ref}}} = \frac{T_{\mathrm{deint}}}{T_{\mathrm{int}}}$$

### Noise

$$V_{n,\mathrm{reset}}^2 = \frac{kT}{C_{\mathrm{int}}}$$

$$Q_{n,\mathrm{shot}}^2 = 2qI_{\mathrm{PD}} \cdot T_{\mathrm{int}}$$

### Sensitivity

$$S = \frac{V_{\mathrm{out}}}{Q_{\mathrm{total}}} = \frac{1}{C_{\mathrm{int}}}$$

### Dynamic Range

$$\mathrm{DR} = \frac{I_{\mathrm{max}} \cdot T_{\mathrm{int}}}{\sqrt{kTC_{\mathrm{int}} + 2qI_{\mathrm{dark}} \cdot T_{\mathrm{int}}}}$$

