# Floating Charge Transfer (FCT) Amplifier

<!--
Input: FCT.pdf, A_Filter-Embedded_Pipe-SAR_ADC_With_Progressive_Conversion_and_Floating_Charge_Transfer_Amplifier.pdf
Output: Comprehensive analysis of FCT amplifier topology with key formulas and design insights
Position: Advanced amplifier topology for high-speed ADCs
⚠️ After any change, update this comment AND .PROJECT.md
-->

## Overview

**Floating Charge Transfer (FCT)** is a novel dynamic open-loop residue amplifier topology introduced at ISSCC 2025. It is believed to be comparable to other advanced amplifiers like SPA, Ringamp, and FIA, offering a unique combination of:

- **High linearity** (open-loop charge transfer)
- **PVT robustness** (capacitor-ratio-based gain)
- **High efficiency** (open-loop, dynamic operation)
- **Low complexity** (4 transistors + SC biasing)

FCT is particularly well-suited for **high-speed pipeline ADCs** and **filter-embedded ADC architectures**.

---

## Motivation

### Limitations of Existing Residue Amplifiers

| Amplifier Type | Advantages | Disadvantages |
|---------------|-----------|---------------|
| **Closed-loop SC amp** (Op-amp, Ringamp, FIA) | ✅ High linearity<br>✅ PVT robust | ❌ High power<br>❌ High complexity<br>❌ Scaling unfriendly |
| **Open-loop transconductor** (gm-R, gm-C) | ✅ High efficiency<br>✅ Low complexity | ❌ Low linearity<br>❌ PVT sensitive<br>❌ Requires calibration |

### Key Insight

**The advantages of closed-loop SC amplifiers come from the charge transfer principle, NOT the closed-loop topology itself.**

- Charge conservation → Relies on capacitor matching (most precise thing in IC design)
- Any circuit that facilitates precise charge transfer can inherit the same merits
- **FCT achieves this in an open-loop configuration**

---

## Working Principle

### Fundamental Charge Transfer Equation

```
Q_in = Q_out
Q = CV
C_in × ΔV_in = C_out × ΔV_out

         ΔV_out   C_in
    A = -------- = -----
         ΔV_in    C_out
```

**Precise gain relying only on capacitor ratio!**

### Naive Open-Loop Charge Transfer

A simple common-gate (CG) transistor can transfer charge from input capacitor C_S to output capacitor C_L:

- **Problem**: Insufficient speed and gain due to limited g_m and R_out
- **Solution**: Evolution to FCT architecture

---

## FCT Architecture Evolution

### Evolution #1: Complementary Structure

- Use both **nMOS and pMOS** in CG configuration
- **G_m doubled** with same power consumption
- Lower input impedance → faster settling

### Evolution #2: Folded Cascode

- Add folded-cascode transistors to recombine output currents
- **Boost output impedance** Z_OUT
- Suppress gain error from channel-length modulation

### Evolution #3: Floating Supply (KEY Innovation)

**Problem**: Bias noise contributes over 80% of total output noise

**Solution**: Floating power supply (reservoir capacitor C_RES)

**Benefits**:
1. **Bias noise is eliminated** - noise circulates inside loop, doesn't affect output
2. **Excellent PSRR** - floating supply isolated from power rails
3. **kT/C noise from C_RES** is also isolated from output

### Evolution #4: Cross-Coupled Capacitor Biasing (C³B)

**Problem**: CG amplifiers have no common-mode (CM) rejection

**Solution**: Cross-coupled capacitor biasing

- Gate of each CG transistor cross-connected to source of differential counterpart
- **CM mode**: Gate-source voltages bootstrapped → high CMRR
- **Differential mode**: Effective g_m further doubled
- **ΔV_gs = 0** → Theoretically infinite CMRR

---

## Key Formulas

### 1. DC Gain and Gain Error

FCT gain is equivalent to a closed-loop amplifier with open-loop gain of **(g_m·r_o)²**:

```
         C_S              G
Gain = ------ = ---------------
         C_L      1 + G·β

where:
    G = (g_m / g_ds)²   (equivalent open-loop gain)
    β = C_L / C_S       (feedback factor)
```

**Detailed gain error analysis**:

```
         C_S/C_L                    C_S
Gain = -------------- ≈ -------------------------------
        1 + (C_S/C_L)·(g_ds/g_m)²   C_L·[1 + (g_ds/g_m)²]
```

**Typical performance** (28nm CMOS):
- Intrinsic gain (g_m/g_ds) ≈ 30 dB
- Gain error ≈ **0.1%** for unity gain FCT
- PVT variation of 16× FCT: **within ±1%**

### 2. Input-Referred Noise

```
       kTγ      kTγ
V²_ni = ---- = ------
        C_S     A·C_L

where:
    γ = thermal noise coefficient (≈2/3 for long channel)
    A = C_S/C_L (gain)
```

**Key insight**: FCT's noise efficiency is **comparable to gm-R amplifiers**, offering higher noise-power efficiency than most closed-loop amplifiers.

**Noise contributors**:
1. ✅ Input CG transistors: kTγ/C_S
2. ✅ C³B capacitors: kT/C_B (designed to be negligible)
3. ❌ Floating supply noise: **isolated from output**
4. ❌ Folded-cascode transistors: **suppressed by input transistors**

### 3. Linearity

When FCT settles, input voltage converges to:

```
V_in,settled = V_in · (C_S/C_L) · (g_ds/g_m)²
```

Since **(g_ds/g_m)²** is a small constant, the input transistor processes only a **small signal**, minimizing nonlinear effects (similar to closed-loop amplifiers).

**Measured performance**:
- THD < **-65 dB** for up to 90 mV peak-to-peak differential input
- **9 dB improvement** over Gm-R amplifier at 60 mV input
- **17 dB improvement** over Gm-R with FVF at 60 mV input

### 4. Settling Bandwidth

```
        g_m
BW ≈ -------  (does NOT depend on β factor!)
       2πC_S
```

**Advantages over closed-loop amplifiers**:
- No stability concerns
- High slew rate (complementary push-pull)
- Faster settling for same bias current

### 5. Equivalence to Closed-Loop Amplifier

```
Common-Gate Amplifier                Closed-Loop Amplifier

     C_S/C_L                  G              g_m
Gain = ----------  ⟺  Gain = -----   where G = ----
      1 + C_S·g_ds              1+G·β          g_ds
         ----
         C_L·g_m                            C_L
                                        β = ----
                                            C_S
```

---

## Performance Summary

### Comparison with Other Amplifier Techniques

| Criterion | FCT | Closed-loop SC amp | Ringamp | FIA | gm-R | gm-C |
|-----------|-----|-------------------|---------|-----|------|------|
| **Gain error** | Low | Low | Low | Med | High | High |
| **Speed/Power** | High | Low | Med | High | High | High |
| **Noise/Power** | Low | High | Med | Med | Low | Low |
| **Linearity** | High | High | High | Med | Low | Low |
| **Design complexity** | Low | High | High | Med | Low | Low |
| **PVT robustness** | High | High | High | Med | Low | Low |

### Measured Performance (28nm CMOS, 16× gain)

| Parameter | Value |
|-----------|-------|
| **PVT Variation** | |
| - Gain variation | +0.8% to -1.0% (process)<br>+0.4% to -0.2% (supply)<br>+0.5% to -0.2% (temp) |
| - THD (worst case) | -62.2 dB to -66.2 dB |
| **Linearity** | |
| - THD @ 60mV pp | < -65 dB |
| - THD @ 90mV pp | < -63 dB |
| **Settling** | Faster than closed-loop counterpart |
| **CMRR** | < 0 dB (with layout optimization) |

---

## Practical Implementation Details

### Circuit Components

1. **4 main transistors**: 2 nMOS + 2 pMOS in complementary CG configuration
2. **2 folded-cascode transistors**: For output impedance boosting
3. **Reservoir capacitor (C_RES)**: Floating power supply
4. **4 biasing capacitors (C_B1-4)**: Cross-coupled capacitor biasing (C³B)
5. **Bootstrapped input switches**: Minimize settling bandwidth loss

### Critical Design Considerations

#### 1. Parasitic Capacitors
- Parasitic caps on output node **directly change gain**
- Must carefully minimize and control parasitics

#### 2. CMRR Degradation
**Problems**:
- Parasitic capacitors C_p1,2 undermine bootstrapping
- Body effect of input transistors

**Solutions**:
- Use **sandwich structure capacitors** in C³B to reduce C_p
- Connect **bulk to source** for all transistors (eliminate body effect)

#### 3. Capacitor Sizing (example from prototype)
- C_RES = 4 pF (minimize voltage drop during amplification)
- C_B1,2 = 980 fF (noise and leakage requirements)
- C_B3,4 = 350 fF
- C_DAC1 = 2 pF (first stage)
- C_DAC2 = 125 fF (second stage, 16× inter-stage gain)

#### 4. Bias Voltage Generation
- Use **replica circuit** to generate bias voltages on C³B
- Ensures robustness against PVT variations
- Maintains defined DC operating point

---

## Application: Filter-Embedded Pipe-SAR ADC

### Progressive Conversion Technique

**Problem**: Traditional filter-embedded SAR ADCs have limited bandwidth because filtering and SAR conversion are sequential.

**Solution**: **Progressive conversion** - parallelize filtering and SAR quantization phases

**Key idea**:
- Sampling capacitors merge into CDAC progressively
- Each merge performs partial FIR filtering AND one SAR bit resolution
- **Conversion cycle reduction ratio**: η_Nconv = (m-n)/⌈R_SAR⌉

### Filter-Embedded Pipe-SAR Architecture

```
Filter Structure:
┌─────────────┬──────────────┬──────────┐
│ 3rd-order   │ 8th-order    │ 5b SAR + │
│ IIR filter  │ FIR filter   │ FCT 16×  │ → 10b SAR → Digital Output
│             │ (decimation) │          │
└─────────────┴──────────────┴──────────┘
   2.8 GS/s        8× decim      350 MS/s

Filter response: 80 MHz BW, >30 dB out-of-band suppression
```

### Measured Results (28nm CMOS, 1V supply)

| Metric | Value |
|--------|-------|
| **Technology** | 28nm CMOS |
| **Supply** | 1.0V (analog), 1.2V (switch driver) |
| **Sampling rate** | 2.8 GS/s (filter), 350 MS/s (ADC) |
| **Bandwidth** | 80 MHz |
| **SNDR** | 70.1 dB @ 10 MHz input |
| **SFDR** | 83.4 dB |
| **IMD3** | -74.4 dBc (two-tone @ 70 MHz) |
| **Dynamic Range** | 72 dB |
| **Power** | 4.87 mW (total ADC)<br>0.55 mW (FCT only) |
| **Area** | 0.036 mm² |
| **Schreier FoM** | **172.2 dB** |
| **Out-of-band suppression** | > 30 dB |
| **Blocker rejection** | 40 dB @ 400 MHz full-scale blocker |
| **Clock scalability** | > 5× without degradation |

**Schreier FoM calculation**:
```
FoM_S = SNDR + 10log₁₀(BW/Power)
      = 70.1 + 10log₁₀(80×10⁶/4.87×10⁻³)
      = 172.2 dB
```

---

## Key Insights and Advantages

### 1. **Open-Loop Charge Transfer = Closed-Loop Precision**
FCT achieves closed-loop-like precision through **charge conservation** and **capacitor matching**, not feedback loops.

### 2. **Floating Supply Eliminates Bias Noise**
The reservoir capacitor creates a **-83.85% noise reduction** compared to tail-supply topology.

### 3. **G_m Boosting (×2×2)**
- Complementary structure: ×2
- C³B cross-coupling: ×2 (differential mode)
- **Total effective G_m**: ×4 compared to single transistor

### 4. **No Stability Concerns**
Open-loop operation → no feedback stability issues → easier to design for high speed

### 5. **PVT Robustness Without Calibration**
Gain defined by capacitor ratio → inherently robust (±1% over PVT)

### 6. **Bandwidth Wall Breaking**
FCT enables filter-embedded ADCs to reach **40× higher bandwidth** than prior art, competing with CT-ΔΣM while offering:
- Better PVT robustness (no RC tuning needed)
- Better power efficiency (>10 dB FoM improvement)
- Scalable bandwidth without calibration

---

## Design Guidelines

### 1. Transistor Sizing
```
Target: (g_m/g_ds)² ≥ 100 (for <1% gain error)
- Use moderate-to-long channel lengths
- Size for target settling bandwidth: BW ≈ g_m/(2πC_S)
- Match nMOS and pMOS for symmetry
```

### 2. Capacitor Selection
```
C_RES: Large enough to minimize voltage drop (typically 4-10 pF)
C_B:   kT/C_B << kTγ/C_S (make C_B noise negligible)
C_S:   Set by kT/C noise requirement
C_L:   C_S/A (where A is desired gain)
```

### 3. Layout Considerations
- Use **sandwich capacitors** for C³B to minimize parasitics
- **Minimize parasitic capacitance** on output node (affects gain)
- Connect all transistor **bulks to sources**
- Careful routing to maintain symmetry

### 4. Bias Generation
- Use **replica circuit** with same transistor dimensions
- Pre-charge C³B before amplification phase
- Ensure bias voltages track PVT through replica

---

## Comparison: CT-ΔΣM vs Filter-Embedded Pipe-SAR with FCT

| Aspect | CT-ΔΣM | FCT-based Pipe-SAR |
|--------|--------|-------------------|
| **Bandwidth** | "Bandwidth wall" @ hundreds of MHz | 80 MHz demonstrated, scalable |
| **Power efficiency** | Decreases sharply with BW | 172 dB FoM (>10 dB better) |
| **PVT robustness** | Requires RC tuning | Capacitor-based, no tuning needed |
| **Clock scalability** | Requires reconfiguration | >5× scalability demonstrated |
| **Blocker immunity** | Loop filter can saturate | 40 dB suppression for full-scale blocker |
| **Design complexity** | High (closed-loop stability) | Lower (open-loop) |

---

## References

- [ISSCC 2025] **S. Huang et al.**, "A 70dB SNDR 80MHz BW Filter-Embedded Pipeline-SAR ADC Achieving 172dB FoMs with Progressive Conversion and Floating-Charge-Transfer Amplifier"
- [JSSC] **S. Huang et al.**, "A Filter-Embedded Pipe-SAR ADC With Progressive Conversion and Floating Charge Transfer Amplifier," *IEEE Journal of Solid-State Circuits*

---

## Related Topics

See also:
- [5T-Differential-Amplifier-Analysis.md](5T-Differential-Amplifier-Analysis.md) - Traditional differential amplifiers
- [Single-Transistor-Amplifier-Configurations.md](Single-Transistor-Amplifier-Configurations.md) - CG, CS, CD configurations
- [Amplifier-Bandwidth-Calculations.md](Amplifier-Bandwidth-Calculations.md) - GBW analysis
