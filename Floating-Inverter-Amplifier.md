# Floating Inverter Amplifier (FIA)

<!--
Input: Internet research, technical papers on FIA topology
Output: Basic formulas and design insights for floating inverter amplifier
Position: Energy-efficient amplifier for dynamic applications
⚠️ After any change, update this comment AND .PROJECT.md
-->

## Overview

**Floating Inverter Amplifier (FIA)** is a dynamic amplifier topology that uses CMOS inverters powered by a **reservoir capacitor (C_RES)** instead of a fixed power supply. It was initially proposed as a preamplifier for comparators and has found rapid application in integrators of discrete-time delta-sigma modulators (DTDSMs).

### Key Advantages

- ✅ **Extremely energy efficient**: Self-quenching, capacitor-powered mechanism
- ✅ **No pre-bias current required**: Dynamic operation only
- ✅ **Input CM insensitive**: Floating nature isolates CM variations
- ✅ **Output CM stable**: Current loop ensures CM voltage preservation
- ✅ **Simple structure**: Based on standard CMOS inverters
- ✅ **Low voltage compatible**: Suitable for advanced processes

---

## Working Principle

### Two-Phase Operation

#### Phase 1: Reset Phase
- Reservoir capacitor **C_RES is charged** to V_DD
- Output capacitors are **reset to desired CM voltage**
- Amplifier is prepared for next amplification cycle

#### Phase 2: Amplification Phase
- Amplifier is **powered by C_RES** (disconnected from V_DD)
- Stored charge in C_RES develops differential output
- **Self-quenching**: Amplification stops when equilibrium reached

### Floating Supply Principle

**Critical characteristic**: Current exiting the positive terminal of C_RES **must return** to the negative terminal.

**Consequence**: Output common-mode voltage **cannot change** (provided parasitic capacitances are negligible)

```
I_out,positive = I_out,negative  (current loop)
    ↓
V_CM,out = constant (preserved)
```

---

## Key Formulas

### 1. Basic Voltage Gain (Simple FIA)

For a basic FIA structure:

```
A_V = g_m · R_o

where:
    g_m = transconductance of CMOS inverter
    R_o = output resistance
```

**Typical value**: For minimum-length devices in **28nm CMOS**:
```
A_V ≈ 10 (≈ 20 dB)
```

### 2. Enhanced FIA Gain

With gain enhancement techniques (body biasing, cascoding):

```
A_V > 90 dB (for 28nm CMOS @ 1V supply)
```

Enhancement methods:
- **Cross-coupled body biasing**: Increases effective g_m
- **Cascode stages**: Boosts R_out
- **Multi-stage configuration**: Cascades multiple inverters

### 3. Transconductance of CMOS Inverter

```
g_m,total = g_m,n + g_m,p

g_m,n = μ_n C_ox (W/L)_n (V_GS,n - V_TH,n)

g_m,p = μ_p C_ox (W/L)_p (|V_SG,p| - |V_TH,p|)
```

For balanced switching point: **(W/L)_p ≈ 2.5 × (W/L)_n**

### 4. Output Resistance

```
R_o = r_o,n || r_o,p = 1/(g_ds,n + g_ds,p)

where:
    r_o,n = output resistance of NMOS
    r_o,p = output resistance of PMOS
```

### 5. Reservoir Capacitor Voltage Droop

During amplification, C_RES voltage drops:

```
ΔV_RES = Q_transferred / C_RES = (C_L × ΔV_out) / C_RES

To minimize droop: C_RES >> C_L

Typical: C_RES ≥ 10 × C_L
```

### 6. Energy Efficiency

Energy per conversion:

```
E = C_RES × V²_DD × η

where:
    η = charge transfer efficiency (typically 0.7-0.9)
```

FIA's efficiency comes from:
- **No static bias current**
- **Charge recycling** through C_RES
- **Self-quenching** operation

### 7. Settling Time

```
t_settle ≈ (C_L / g_m) × ln(1/ε)

where:
    ε = required settling accuracy
    C_L = load capacitance
```

**Faster settling requires**:
- Higher g_m (larger transistors)
- Lower C_L

---

## Enhanced FIA Topologies

### 1. Cross-Coupled Body Biasing (CCBB)

**Technique**: Connect body terminals of transistors to opposite output

**Benefits**:
- Increases effective g_m through **body effect modulation**
- Enhances voltage gain by **20-30 dB**
- Improves linearity

**Gain enhancement**:

```
g_m,eff = g_m + g_mb

where:
    g_mb = body-effect transconductance
    g_mb ≈ χ × g_m (χ ≈ 0.2-0.3)

Total enhancement: 20-30% increase in g_m
```

### 2. Cascode FIA

Adding cascode devices:

```
R_out,cascode = g_m,cascode × r_o,cascode × r_o,main

Gain enhancement: 20-40 dB additional
```

### 3. Multi-Stage FIA

Cascade multiple FIA stages:

```
A_total = A_1 × A_2 × ... × A_N

Example: 3-stage FIA
    A_total = 10 × 10 × 10 = 1000 (60 dB)

    With enhancements:
    A_total > 90 dB
```

---

## Common-Mode Characteristics

### CM Rejection

**Key advantage**: Input CM variations do **not affect** output CM

```
∂V_CM,out / ∂V_CM,in ≈ 0

Reason: Floating power supply + current loop constraint
```

### CM Stability

Output CM voltage is determined by:

```
V_CM,out = V_reset (set during reset phase)

Independent of:
    - Input CM level
    - Process variations (to first order)
    - Temperature
```

---

## Noise Analysis

### Input-Referred Noise

Dominated by inverter thermal noise:

```
V²_n,in = 16kTγ / (3g_m,total)

where:
    γ ≈ 2/3 for long-channel devices
    g_m,total = g_m,n + g_m,p
```

### Noise from Reservoir Capacitor

The kT/C noise from C_RES during reset:

```
V²_n,RES = kT / C_RES

This noise is:
    - Present on power supply nodes (SP, SN)
    - Does NOT directly couple to output (floating supply)
    - Can affect through finite isolation
```

**Design guideline**: Make C_RES large enough that this noise is negligible

### Total Noise Budget

For SC integrator application:

```
V²_n,total ≈ kT/C_s + V²_n,FIA/A²

where:
    C_s = sampling capacitor
    A = gain of previous stage
```

---

## Switched-Capacitor Application

### SC Amplifier Configuration

FIA can be incorporated into SC amplifiers:

```
Phase 1 (Sampling):
    - Input samples on C_S
    - C_RES charges to V_DD
    - Output resets to V_CM

Phase 2 (Amplification):
    - C_S connects to FIA input
    - FIA amplifies: V_out = V_in × (C_S/C_F)
    - Charge conserved through floating supply
```

### Charge Transfer Equation

```
Q_in = Q_out (charge conservation)

C_S × V_in = C_F × V_out

V_out / V_in = C_S / C_F  (ideal)

Actual: V_out / V_in = (C_S/C_F) / (1 + 1/A_FIA)
```

---

## Design Equations

### 1. Inverter Sizing for Balanced Operation

For symmetric switching point (V_M = V_DD/2):

```
(W/L)_p / (W/L)_n = μ_n / μ_p ≈ 2.5-3

Typical sizing (28nm):
    (W/L)_n = 2-10
    (W/L)_p = 5-25
```

### 2. Reservoir Capacitor Sizing

```
C_RES ≥ 10 × C_L,max

For 1% voltage droop:
    C_RES ≥ 100 × Q_total / V_DD
```

### 3. Gain-Bandwidth Product

```
GBW = A_V × BW = g_m / (2π C_L)

For high GBW:
    - Increase g_m (larger W)
    - Reduce C_L (careful layout)
```

### 4. Power Consumption

Average power (dynamic):

```
P_avg = f_clk × C_RES × V²_DD × η

where:
    f_clk = clock frequency
    η = duty cycle of amplification
```

**Key insight**: Power scales with speed, but no static power!

---

## Performance Comparison

### FIA vs. Traditional Op-Amp

| Parameter | FIA | Op-Amp |
|-----------|-----|---------|
| **DC Gain** | 20 dB (basic)<br>90 dB (enhanced) | 60-120 dB |
| **Power** | Very Low (dynamic only) | Medium-High (static bias) |
| **Speed** | High | Medium |
| **Noise** | Medium | Low-Medium |
| **Complexity** | Low | High |
| **CM Sensitivity** | Excellent (insensitive) | Medium (CMRR = 60-90 dB) |
| **Area** | Small | Medium-Large |

### FIA vs. Other Dynamic Amplifiers

| Criterion | FIA | Ring Amp | FCT |
|-----------|-----|----------|-----|
| **Gain** | Low-High | Medium | Medium-High |
| **Efficiency** | Excellent | Good | Excellent |
| **CM Insensitivity** | Excellent | Medium | Excellent |
| **Linearity** | Good | Good | Excellent |
| **Complexity** | Low | Medium | Low |
| **Maturity** | Mature | Mature | New (2025) |

---

## State-of-the-Art Performance

### Example: DTDSM with FIA (Recent Work)

| Metric | Value |
|--------|-------|
| **Architecture** | DTDSM with FIA-assisted OTA |
| **SNDR** | 94.5 dB |
| **DR** | 96.5 dB |
| **Bandwidth** | Not specified in abstract |
| **Technology** | Advanced CMOS |
| **Key Feature** | FIA + FIR DAC feedback |

---

## Practical Implementation Tips

### 1. Layout Considerations

**Critical aspects**:
- **Symmetric layout**: Match NMOS and PMOS paths
- **Minimize parasitic capacitance** on output nodes
- **Guard C_RES** from substrate noise
- **Compact inverter layout**: Reduce gate capacitance

### 2. Reservoir Capacitor Design

```
C_RES selection criteria:
    1. Voltage droop: C_RES ≥ 100 × C_L
    2. Noise: V_n,RES = √(kT/C_RES) << V_n,required
    3. Area: Balance with chip area budget

Typical: C_RES = 1-10 pF (28nm process)
```

### 3. Reset Phase Timing

```
t_reset ≥ 5 × τ_charge

where:
    τ_charge = R_switch × C_RES

Ensure complete charging of C_RES
```

### 4. PVT Robustness

FIA gain varies with PVT. **Mitigation strategies**:

- **Calibration**: Adjust C_S/C_F ratio
- **Reference generation**: Track process variations
- **Body biasing**: Compensate g_m variations

---

## Limitations and Challenges

### 1. Limited Gain (Basic FIA)

- Simple FIA: Only **~20 dB** gain
- Requires enhancement techniques for high precision

### 2. Voltage Droop

- C_RES voltage drops during amplification
- Affects gain accuracy and linearity
- **Solution**: Large C_RES (area cost)

### 3. PVT Sensitivity

- Inverter g_m and threshold vary with PVT
- Gain changes accordingly
- **Solution**: Calibration or compensation

### 4. Finite Isolation

- Parasitic coupling from C_RES to output
- Degrades PSRR and noise isolation
- **Solution**: Careful layout, large C_RES

---

## Applications

### 1. Comparator Preamplifier
- Original FIA application
- High-speed, low-power
- Example: Flash ADC comparators

### 2. DTDSM Integrators
- Most common modern application
- Excellent energy efficiency
- High-order loop filters

### 3. SC Amplifiers
- Gain stages in SC circuits
- Sample-and-hold amplifiers
- PGA (Programmable Gain Amplifier)

### 4. Delta-Sigma Modulators
- FIA-assisted OTA in loop filters
- Achieves 90+ dB SNDR
- Low power consumption

### 5. SAR ADC Comparators
- Dynamic preamplification
- Noise shaping SAR ADCs
- PVT-robust designs

---

## Design Example (28nm CMOS)

### Specifications
```
Technology: 28nm CMOS
Supply: 1.0V
Target gain: 60 dB (×1000)
Load capacitance: 100 fF
Settling accuracy: 0.1%
```

### Design Choices

#### 1. Topology
- **3-stage FIA** with CCBB and cascode

#### 2. Transistor Sizing
```
Stage 1:
    (W/L)_n = 10/0.03 = 333
    (W/L)_p = 25/0.03 = 833

Stage 2:
    (W/L)_n = 5/0.03 = 167
    (W/L)_p = 12/0.03 = 400

Stage 3:
    (W/L)_n = 2/0.03 = 67
    (W/L)_p = 5/0.03 = 167
```

#### 3. Capacitor Values
```
C_RES = 5 pF (minimize droop to <1%)
C_L = 100 fF (given)
```

#### 4. Performance Estimate
```
Each stage gain: 20 dB (basic)
CCBB enhancement: +6 dB per stage
Cascode: +15 dB per stage

Total: 3 × (20 + 6 + 15) = 123 dB (exceeds target)

Can reduce for power savings
```

---

## Recent Innovations

### 1. PVT-Robust FIA (2023)
- Improved body biasing scheme
- Self-adjusting bias generation
- Reduced gain variation to **±2%** over PVT

### 2. FIA with FIR DAC Feedback (2024)
- Combined FIA with FIR DAC
- Achieved **94.5 dB SNDR**
- For high-performance DTDSM

### 3. Enhanced Gain FIA
- Cross-coupled body biasing
- **>90 dB gain** in single stage
- Suitable for open-loop applications

---

## Key Takeaways

1. **FIA is fundamentally a dynamic amplifier** - no static power
2. **Floating supply provides excellent CM insensitivity** - unique advantage
3. **Basic gain is limited (~20 dB)** - but can be enhanced to >90 dB
4. **Extremely energy efficient** - ideal for battery-powered applications
5. **Simple structure** - easy to design and implement
6. **Widely used in DTDSM** - proven track record

---

## References and Sources

- [Floating Inverter Amplifiers with Enhanced Voltage Gains](https://jsstec.org/xml/39438/39438.pdf) - Enhanced FIA design
- [An Energy-Efficient Comparator with Dynamic Floating Inverter Amplifier](https://www.xtang.me/pubs/files/2019_VLSI_Tang.pdf) - X. Tang et al., VLSI 2019
- [Floating Inverter Amplifiers with Cross-Coupled Body Biasing](https://jsstec.org/_PR/view/?aidx=39438&bidx=3549) - CCBB technique
- [US Patent: Floating Inverter Amplifier Device](https://patents.google.com/patent/US20210384874A1/en) - Patent description
- [A 94.5-dB SNDR 96.5-dB DR DTDSM using FIA assisted OTA](https://www.sciencedirect.com/science/article/abs/pii/S0026269224001903) - Recent application
- [An improved PVT-Robust FIA for SAR ADCs](https://www.sciencedirect.com/science/article/abs/pii/S1434841123002790) - PVT robustness

---

## Related Topics

See also:
- [Ring-Amplifier.md](Ring-Amplifier.md) - Ring amplifier topology
- [Floating-Charge-Transfer-Amplifier.md](Floating-Charge-Transfer-Amplifier.md) - FCT amplifier
- [5T-Differential-Amplifier-Analysis.md](5T-Differential-Amplifier-Analysis.md) - Traditional differential amplifiers
- [Amplifier-Bandwidth-Calculations.md](Amplifier-Bandwidth-Calculations.md) - GBW analysis
