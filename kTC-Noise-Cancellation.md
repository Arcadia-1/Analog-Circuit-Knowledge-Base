# kT/C Noise Cancellation

<!--
Input: Internet research, technical papers on thermal noise in switched-capacitor circuits
Output: Formulas and techniques for kT/C noise reduction and cancellation
Position: Fundamental noise reduction technique for high-precision analog circuits
⚠️ After any change, update this comment AND .PROJECT.md
-->

## Overview

**kT/C noise cancellation** achieves up to **70% noise power reduction** using auxiliary capacitors to sample and subtract thermal noise.

---

## Noise Cancellation Techniques

### 1. Basic kT/C Cancellation

**Three-phase operation:**

**Phase 1: Reset**
- Reset feedback capacitor $C_F$

**Phase 2: Noise Sampling**
- Sample kT/C noise on auxiliary capacitor $C_{\mathrm{aux}}$
- Store: $V_{\mathrm{noise}} = V_{kT/C}$

**Phase 3: Signal + Cancellation**
- Process signal while subtracting stored noise
- Output: $V_{\mathrm{out}} = A \cdot V_{\mathrm{in}} - V_{\mathrm{noise}}$

**Noise reduction:**

$$\boxed{\mathrm{Noise\ Power\ Reduction} = \frac{V_{n,\mathrm{cancelled}}^2}{V_{n,\mathrm{conventional}}^2} \approx 0.3}$$

**Demonstrated**: Up to **70% noise power reduction**

### 2. Presampling kT/C Cancellation (2024)

**Innovation**: Presampling capacitor decouples sampling speed from noise.

**Key components:**
- $C_{\mathrm{pre}}$: Presampling capacitor
- $C_{\mathrm{DAC}}$: Main sampling capacitor
- Additional noise storage cap

**Benefits:**
- **>5× sampling rate** improvement vs. previous techniques
- Breaks trade-off between noise, bandwidth, and linearity

**Noise with cancellation:**

$$\boxed{V_{n,\mathrm{eff}}^2 = \frac{kT}{C_{\mathrm{DAC}}} \cdot (1 - \beta^2)}$$

where $\beta$ is noise correlation coefficient ($\beta \to 1$ for ideal cancellation).

### 3. Auto-Zero Cancellation

**For low-frequency applications** (neural interfaces, instrumentation):

**Noise suppression:**

$$\boxed{V_{n,\mathrm{AZ}}^2 = \frac{kT}{C_{\mathrm{AZ}}} + \frac{kT}{C_{\mathrm{in}}} \cdot \frac{1}{A^2}}$$

Second term negligible for high gain $A$.

### 4. Active RC Sampling

**Use active circuit** instead of passive RC to charge capacitor.

**Effective noise:**

$$\boxed{V_{n,\mathrm{active}}^2 = \frac{kT}{C_{\mathrm{eff}}} \cdot \gamma}$$

where $\gamma < 1$ is noise reduction factor (achievable: $\gamma \approx 0.3$).

---

## Design Equations

### Required Capacitance

**Without cancellation:**

$$\boxed{C_{\mathrm{min}} = \frac{kT}{V_{\mathrm{signal}}^2} \cdot 10^{\mathrm{SNR}/10}}$$

**With cancellation:**

$$\boxed{C_{\mathrm{min,NC}} = \frac{kT}{V_{\mathrm{signal}}^2} \cdot 10^{\mathrm{SNR}/10} \cdot (1 - \eta)}$$

where $\eta$ = cancellation efficiency (0.5-0.7 practical).

**For $\eta = 0.7$:** Capacitor can be **3.3× smaller** for same SNR.

### Cancellation Efficiency

$$\boxed{\eta = 1 - \frac{V_{n,\mathrm{cancelled}}^2}{V_{n,\mathrm{uncancelled}}^2}}$$

**Practical values:**
- Basic: $\eta = 0.5$ (50%)
- Advanced: $\eta = 0.7$ (70%)
- With calibration: $\eta > 0.8$ (80%)

### Mismatch-Limited Performance

$$\boxed{V_{n,\mathrm{residual}}^2 = \frac{kT}{C} \cdot \left(\frac{\Delta C}{C}\right)^2}$$

**Design guideline**: Match capacitors to <0.5% for effective cancellation.

### Multi-Step Cancellation

Cascade $N$ stages:

$$\boxed{V_{n,\mathrm{multi}}^2 = \frac{kT}{C} \cdot \prod_{i=1}^{N} (1 - \eta_i)}$$

For $N=2$ with $\eta_1 = \eta_2 = 0.7$: **91% total reduction**

---

## Practical Implementation

### SC Amplifier with kT/C Cancellation

**Phase 1 ($\phi_1 = 1$): Reset + Noise Sampling**
- Reset $C_F$
- Sample noise on $C_{\mathrm{aux}}$: $V_{\mathrm{aux}} = V_{kT/C,1}$

**Phase 2 ($\phi_2 = 1$): Signal + Cancellation**
- Sample signal + noise on $C_{\mathrm{in}}$: $V_{\mathrm{in}} + V_{kT/C,2}$
- Transfer with $C_{\mathrm{aux}}$ compensation
- Output: $V_{\mathrm{out}} = \frac{C_{\mathrm{in}}}{C_F} \cdot V_{\mathrm{in}} - \frac{C_{\mathrm{aux}}}{C_F} \cdot V_{kT/C,1}$

**Optimal cancellation when** $V_{kT/C,1} \approx V_{kT/C,2}$

### Capacitor Sizing

$$C_{\mathrm{aux}} \approx C_{\mathrm{in}} \quad \text{(optimal)}$$

$$C_F = \frac{C_{\mathrm{in}}}{A_{\mathrm{closed-loop}}}$$

### Layout Considerations

1. **Common-centroid** for $C_{\mathrm{in}}$ and $C_{\mathrm{aux}}$
2. **Same unit capacitor** size
3. **Minimize parasitics**: Bottom-plate sampling
4. **Thermal gradients**: Place matched components close

---

## Limitations

### 1. Capacitor Mismatch

**Residual noise:**

$$V_{n,\mathrm{residual}} = V_{kT/C} \cdot \frac{\Delta C}{C}$$

**Mitigation:** Careful layout, digital calibration

### 2. Timing Skew

Phase mismatch samples different noise realizations → poor cancellation.

**Solution:** Precise clock generation, low-skew distribution

### 3. Finite Correlation Time

**Correlation time:**

$$\tau_{\mathrm{corr}} \approx \frac{1}{BW}$$

**Design rule:** $\Delta t < \tau_{\mathrm{corr}}$ for effective cancellation

### 4. Circuit Complexity

**Trade-offs:**
- Extra capacitors → larger area
- More switches → more parasitics
- Additional clock phases → complex timing

---

## Applications

### 1. High-Resolution SAR ADCs

**Target:** 13-16 bit, sub-μW to mW power

**Benefits:**
- Reduce $C_{\mathrm{DAC}}$ by 2-3×
- Lower power, faster conversion
- **Example**: 13-bit SAR with kT/C cancellation

### 2. Delta-Sigma Modulators

**Application:** Audio codecs (>100 dB SNR), precision instrumentation

**Location:** First integrator input (most critical)

**Benefits:** Reduced in-band noise, lower OSR or smaller caps

### 3. Neural Interface Amplifiers

**Requirements:** <5 μVrms noise, <10 μW power

**kT/C cancellation provides:**
- Lower noise without large caps
- Combined with chopping for 1/f rejection
- Area-efficient multi-channel design

### 4. SC Filters and PGAs

**Benefits:**
- Smaller capacitor arrays
- Better gain accuracy
- Lower power

---

## Performance Metrics

### State-of-the-Art Examples

**High-Speed SAR ADC with Presampling (2024):**
- **>5× speed** vs. previous kT/C-cancelled ADCs
- Maintained noise reduction
- Competitive FoM

**Measured noise reduction:**
- **70% noise power reduction**
- **45% RMS voltage noise reduction**
- Enables 3× smaller capacitors

---

## Comparison with Other Techniques

| Technique | Noise Reduction | Complexity | Power Cost | Best For |
|-----------|----------------|------------|------------|----------|
| **kT/C Cancellation** | 50-70% | Medium | Low | Thermal noise |
| **Chopping** | 1/f noise | Low | Very Low | 1/f noise |
| **Auto-Zero** | Offset + 1/f | Medium | Low | DC offset |
| **CDS** | Reset + 1/f | Low | None | Reset noise |
| **Larger Caps** | 1/√C | None | High | All thermal |

**Best approach**: Combine techniques (e.g., kT/C cancellation + chopping)

---

## Key Formulas Summary

### Basic Noise

$$V_n^2 = \frac{kT}{C}, \quad Q_n^2 = kTC$$

### With Cancellation

$$V_{n,\mathrm{eff}}^2 = \frac{kT}{C} \cdot (1 - \eta)$$

where $\eta$ = 0.5-0.7 (typical)

### Required Capacitance

$$C_{\mathrm{min}} = \frac{kT \cdot 10^{\mathrm{SNR}/10}}{V_{\mathrm{signal}}^2} \cdot (1-\eta)$$

### Mismatch Limit

$$V_{n,\mathrm{residual}}^2 = \frac{kT}{C} \cdot \left(\frac{\Delta C}{C}\right)^2$$

