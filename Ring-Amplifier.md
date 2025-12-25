# Ring Amplifier

<!--
Input: Internet research, ISSCC/JSSC publications
Output: Basic formulas and design insights for ring amplifier topology
Position: Advanced amplifier for switched-capacitor circuits
⚠️ After any change, update this comment AND .PROJECT.md
-->

## Overview

**Ring Amplifier** (Ringamp) is a novel amplification technique introduced at ISSCC 2012 by B. Hershberg, S. Weaver, and U.-K. Moon from Oregon State University. It achieves efficient amplification in nanoscale CMOS by using a cascade of **dynamically stabilized inverter stages**.

### Key Advantages

- ✅ **Process scalable**: Leverages benefits of technology scaling
- ✅ **High bandwidth**: Excellent speed performance
- ✅ **Good power efficiency**: Suitable for low-power applications
- ✅ **Flat open-loop gain**: Better linearity than traditional amplifiers
- ✅ **Low-voltage compatible**: Works well in nanoscale processes

---

## Working Principle

### Basic Structure

A ring amplifier is fundamentally a **ring oscillator that has been split into two signal paths**, with different offsets embedded in each path. This creates an input-referred **"dead-zone"** for which neither output transistor will conduct.

```
Ring Oscillator → Split into 2 paths → Add offset (dead-zone) → Ring Amplifier
```

**Key concept**: Any value for V_IN within the dead-zone region is a viable steady-state solution. The input-referred value of the dead-zone determines the **overall accuracy** of the amplifier.

### Dead-Zone Embedding

The dead-zone is embedded **prior to the second stage inverters** by storing a voltage offset across capacitors. This offset determines:
1. **Stability** of the amplification
2. **Accuracy** of the output
3. **Linearity** characteristics

---

## Key Formulas

### 1. Basic Voltage Gain

For a simple ring amplifier configuration:

$$\boxed{A_V \approx g_m \cdot R_{\mathrm{out}}}$$

where:
- $g_m$ = transconductance of inverter stage
- $R_{\mathrm{out}}$ = output impedance

### 2. Dead-Zone Width

The dead-zone width ($\Delta V_{\mathrm{DZ}}$) determines amplifier accuracy:

$$\boxed{\mathrm{Accuracy} \approx \frac{1}{1 + A_{\mathrm{OL}}}}$$

where:
- $A_{\mathrm{OL}}$ = open-loop gain related to dead-zone width

**Smaller dead-zone → Higher accuracy**

### 3. Bandwidth

Ring amplifiers provide high bandwidth due to the inverter-based topology:

$$\boxed{BW \propto \frac{1}{\tau_{\mathrm{inv}} \cdot N}}$$

where:
- $\tau_{\mathrm{inv}}$ = inverter delay
- $N$ = number of stages in the ring

### 4. Power Efficiency

The power consumption scales with:

$$\boxed{P_{\mathrm{total}} = N \cdot I_{\mathrm{bias}} \cdot V_{\mathrm{DD}}}$$

where:
- $N$ = number of inverter stages
- $I_{\mathrm{bias}}$ = bias current per stage
- $V_{\mathrm{DD}}$ = supply voltage

**Advantage**: Efficient use of bias current through multiple stages

### 5. Settling Time

The settling behavior is governed by:

$$\boxed{t_{\mathrm{settle}} \approx N \cdot \tau_{\mathrm{inv}} \cdot \ln\left(\frac{1}{\varepsilon}\right)}$$

where:
- $\varepsilon$ = required settling accuracy
- $N$ = number of stages
- $\tau_{\mathrm{inv}}$ = propagation delay per inverter

---

## Advanced Techniques

### 1. Dead-Zone Degeneration (DZD)

**Purpose**: Extend linearity limits

**Method**: Dynamically adjust the dead-zone width based on signal conditions

**Benefit**: Improved THD and SFDR performance

### 2. Second-Stage Bias Enhancement

**Purpose**: Increase speed limits

**Method**: Enhance biasing in second stage of inverter chain

**Benefit**: Higher bandwidth without proportional power increase

### 3. Multi-Stage Configuration

For higher gain applications:

$$\boxed{A_{\mathrm{total}} = A_1 \times A_2 \times \ldots \times A_N}$$

Typical: 2-3 stage ringamp for SC circuits

---

## Performance Characteristics

### Gain vs. Frequency

Unlike traditional op-amps, ringamps exhibit:
- **Flat open-loop gain** vs. output voltage
- **High bandwidth** at low voltage
- **Better linearity** in deep nanoscale processes

### Open-Loop Gain Behavior

$$A_{\mathrm{OL}}(V_{\mathrm{out}}) \approx \mathrm{constant}\ \mathrm{(relatively\ flat)}$$

Typical value: 20-40 dB (depending on design)

This flat characteristic is a **key advantage** for linearity.

---

## Design Guidelines

### 1. Number of Stages

Typical: $N = 3$-$5$ stages

**Trade-off:**
- More stages → Higher gain, more power
- Fewer stages → Lower gain, less power, faster

### 2. Inverter Sizing

$$\frac{W_p}{W_n} \approx 2\text{-}3\ \text{(for balanced rise/fall times)}$$

**Larger devices:**
- + Lower noise
- + Higher speed
- - More power
- - Larger area

### 3. Dead-Zone Capacitor Sizing

$$C_{\mathrm{DZ}} \gg C_{\mathrm{parasitic}}$$

Typical: $C_{\mathrm{DZ}} = 50$-$200$ fF (28nm process)

**Larger $C_{\mathrm{DZ}}$:**
- + Better noise immunity
- + More accurate offset
- - Larger area

### 4. Reservoir Capacitor

For dynamic operation:

$$\boxed{C_{\mathrm{RES}} \geq 10 \times C_{\mathrm{load}}}$$

Ensures minimal voltage droop during amplification

---

## Application Example: Pipelined ADC

### State-of-the-Art Performance (2021)

A 4-GS/s ADC in 16nm CMOS using **36 ringamps**:

| Metric | Value |
|--------|-------|
| **Sampling Rate** | 4 GS/s |
| **SNDR** | 62 dB |
| **SFDR** | 75 dB |
| **Power** | 75 mW (including input buffer) |
| **Walden FoM** | 18 fJ/conversion-step |
| **Schreier FoM** | 166 dB |
| **Technology** | 16nm CMOS |

**Key insight**: 36 amplifiers operating efficiently in parallel

---

## Comparison with Other Amplifiers

| Criterion | Ring Amp | Op-Amp | FIA | FCT |
|-----------|----------|---------|-----|-----|
| **Gain** | Medium (20-40 dB) | High (60-100 dB) | Low-High | Medium |
| **Bandwidth** | High | Low-Med | High | High |
| **Power Efficiency** | Good | Poor-Med | Excellent | Excellent |
| **Linearity** | Good (flat OL gain) | Excellent | Good | Excellent |
| **Complexity** | Medium | High | Low | Low |
| **Scalability** | Excellent | Poor | Good | Good |
| **Stability** | Good (no feedback) | Challenging | Excellent | Excellent |

---

## Key Design Equations Summary

### Inverter Stage Design

1. $$\boxed{g_m = \mu C_{\mathrm{ox}} \frac{W}{L} (V_{\mathrm{GS}} - V_{\mathrm{TH}})}$$

2. $$\boxed{R_{\mathrm{out}} \approx \frac{1}{g_{\mathrm{ds},n} + g_{\mathrm{ds},p}}}$$

3. $$\boxed{f_{\mathrm{unity}} \approx \frac{g_m}{2\pi C_L}}$$

4. $$\boxed{V_{n,\mathrm{inv}}^2 \approx \frac{16kT}{3g_m} \times \gamma}$$

### Ring Amplifier Specific

5. $$\boxed{\Delta V_{\mathrm{DZ}} = \frac{Q_{\mathrm{stored}}}{C_{\mathrm{DZ}}}}$$

6. $$\boxed{\varepsilon_{\mathrm{gain}} \approx \frac{\Delta V_{\mathrm{DZ}}}{V_{\mathrm{signal}}}}$$

7. $$\boxed{\tau_{\mathrm{total}} = N \times \tau_{\mathrm{inv}}}$$

8. $$\boxed{P = I_{\mathrm{avg}} \times V_{\mathrm{DD}} \times N}$$

---

## Practical Implementation Tips

### 1. Layout Considerations

- **Symmetry is critical**: Match both signal paths precisely
- **Minimize parasitic capacitance**: Affects dead-zone accuracy
- **Guard rings**: Isolate from substrate noise
- **Compact layout**: Reduce routing parasitic

### 2. Biasing Strategy

**Typical biasing:**
- Self-biased inverters (simple)
- External bias for better control
- Adaptive biasing for PVT robustness

### 3. Reset and Amplification Phases

For SC applications:

**Phase 1 (Reset):**
- Charge reservoir capacitor
- Reset output to CM voltage
- Establish dead-zone offset

**Phase 2 (Amplification):**
- Disconnect from supplies
- Allow ring to settle within dead-zone

### 4. Common-Mode Stability

Ring amplifiers can exhibit CM instability. Solutions:
- **CM feedback circuit**
- **Differential architecture** with proper biasing
- **Careful dead-zone design**

---

## Noise Analysis

### Total Input-Referred Noise

$$V_{n,\mathrm{total}}^2 = V_{n,1\mathrm{st\_stage}}^2 + \frac{V_{n,2\mathrm{nd\_stage}}^2}{A_1^2} + \ldots$$

Dominated by first stage inverter noise:

$$\boxed{V_{n,\mathrm{in}}^2 \approx \frac{16kT\gamma}{3g_{m,1}}}$$

where:
- $\gamma \approx 2/3$ for long-channel
- $g_{m,1}$ = transconductance of first stage

### Noise Efficiency Factor (NEF)

$$\boxed{NEF = V_{n,\mathrm{rms}} \times \sqrt{\frac{2I_{\mathrm{total}}}{\pi U_T \times 4kT \times BW}}}$$

Good ringamp: $NEF < 3$

---

## Limitations and Challenges

### 1. Limited DC Gain

- Open-loop gain typically **20-40 dB**
- Not suitable for very high precision (>12-bit without calibration)

### 2. Dead-Zone Sensitivity

- Requires careful design and calibration
- PVT variations affect dead-zone width

### 3. Common-Mode Range

- Limited by inverter switching threshold
- Typically 0.3V_DD to 0.7V_DD

### 4. Offset and Mismatch

- Device mismatch creates offset
- Requires **foreground or background calibration**

---

## Evolution and Variants

### Type 1: Basic Ring Amplifier
- Single ring with dead-zone
- Simple, but limited performance

### Type 2: Enhanced Ring Amplifier
- Dead-zone degeneration (DZD)
- Second-stage bias enhancement
- Improved linearity and speed

### Type 3: Multi-Stage Ring Amplifier
- Cascade of ring stages
- Higher gain for specific applications
- Used in some delta-sigma modulators

---

## Typical Specifications (28nm CMOS)

| Parameter | Typical Value |
|-----------|---------------|
| **DC Gain** | 25-35 dB |
| **Unity-Gain BW** | 500 MHz - 2 GHz |
| **Settling Time (0.1%)** | 0.5 - 2 ns |
| **Input-Referred Noise** | 50 - 200 μV_rms |
| **Power** | 0.5 - 2 mW |
| **THD** | -60 to -75 dB |
| **Supply Voltage** | 0.9 - 1.2 V |
| **Dead-Zone Width** | 50 - 200 mV |

---

## Applications

### 1. Pipelined ADCs
- Inter-stage residue amplification
- High-speed, medium resolution (8-12 bit)

### 2. Switched-Capacitor Circuits
- SC filters
- SC gain stages
- Sample-and-hold circuits

### 3. Delta-Sigma Modulators
- Loop filter integrators (with modifications)
- High-speed DTDSM

### 4. Time-Interleaved ADCs
- Per-channel amplification
- Reduced mismatch sensitivity

---

## References and Sources

- [Ring Amplifiers for Switched Capacitor Circuits - B. Hershberg](https://www.benjamin.hershberg.com/wp-content/papercite-data/slides/2012-isscc-ringamp.pdf) - ISSCC 2012 original paper
- [The Ring Amplifier: Scalable Amplification with Ring Oscillators](https://link.springer.com/chapter/10.1007/978-3-319-07938-7_18) - SpringerLink chapter
- [THE RING AMPLIFIER: SCALABLE AMPLIFICATION WITH RING OSCILLATORS](https://www.benjamin.hershberg.com/wp-content/papercite-data/papers/2015-aacdchapter-ringamp.pdf) - AACD Chapter 2015
- [Benjamin Hershberg Publications](https://www.benjamin.hershberg.com/publications/)
- [A 4-GS/s 10-ENOB 75-mW ringamp ADC in 16-nm CMOS](https://www.benjamin.hershberg.com/wp-content/papercite-data/papers/2021-jssc-type1-direct-rf-ringamp.pdf) - JSSC 2021

---

## Related Topics

See also:
- [Floating-Charge-Transfer-Amplifier.md](Floating-Charge-Transfer-Amplifier.md) - FCT amplifier
- [Floating-Inverter-Amplifier.md](Floating-Inverter-Amplifier.md) - FIA topology
- [5T-Differential-Amplifier-Analysis.md](5T-Differential-Amplifier-Analysis.md) - Traditional differential amplifiers
- [Amplifier-Bandwidth-Calculations.md](Amplifier-Bandwidth-Calculations.md) - GBW analysis
