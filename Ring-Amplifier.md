# Ring Amplifier

<!--
Input: reference/笔记_RingAmp_20230611.pdf, reference/詹明韬Design Report.pdf, reference/ringamp/
Output: Ring amplifier working principle and design equations
Position: Dynamic amplifier for switched-capacitor circuits
⚠️ Updated: Complete rewrite based on dead-zone stabilization mechanism
-->

## Overview

**Split ring oscillator with dead-zone stabilization** for switched-capacitor circuits. Achieves 70+ dB effective gain with excellent power efficiency by locking output stage OFF in steady state.

---

## Working Principle - Three Phases

### Phase 1: Slewing

First two stages act as **comparators** controlling output stage gates. Large input → output NMOS/PMOS fully on/off → maximum current charges $C_L$.

$$\boxed{SR = \frac{I_{\mathrm{out,p}} + I_{\mathrm{out,n}}}{C_L}}$$

### Phase 2: Stabilization

Input voltage **oscillates around dead-zone** until settling within bounds. Larger dead-zone → fewer oscillations.

### Phase 3: Steady State (Dead-Zone Lock)

Input voltage locks into dead-zone range:

$$\boxed{V_{\mathrm{in}} \in \left[-\frac{V_{\mathrm{os}}}{A_1}, \frac{V_{\mathrm{os}}}{A_1}\right]}$$

where $V_{\mathrm{os}}$ = embedded offset voltage, $A_1$ = first stage gain.

**At steady state:** $V_{BP} = 1$, $V_{BN} = 0$, output PMOS/NMOS both **OFF**, output voltage **frozen** on $C_L$ → **equivalent DC gain → ∞**.

---

## Dead-Zone Embedding

Inject offset voltage $\pm V_{\mathrm{os}}$ **before second-stage inverters** using: (1) switched capacitors, (2) capacitive level shifting, or (3) resistor/current biasing.

$$\boxed{V_{\mathrm{DZ,in}} = \frac{\pm V_{\mathrm{os}}}{A_1}}$$

**Trade-off:** Smaller dead-zone → higher accuracy, less stable. Larger dead-zone → more stable, requires higher $A_1$.

---

## Effective Gain

$$\boxed{A_{\mathrm{eff}} = \frac{V_{\mathrm{signal}}}{V_{\mathrm{residual}}} \approx A_1 \times \frac{1}{\Delta V_{\mathrm{DZ,in}}}}$$

**Typical values:**
- Class-B with dead-zone: 50-70 dB
- Class-AB with Monticelli cell: 70+ dB

**Gain mechanism:** Dead-zone locking (output stage OFF), NOT linear $g_m \cdot R_o$ amplification.

---

## Bandwidth (GBW)

$$\boxed{GBW = \frac{A_{v1} A_{v2} g_{m3}}{2\pi C_L}}$$

**Expanded form:**

$$\boxed{GBW = \frac{g_{m1} r_{o1} \cdot g_{m2} r_{o2} \cdot g_{m3}}{2\pi C_L}}$$

where:
- $A_{v1} = g_{m1} r_{o1}$ = gain of first stage
- $A_{v2} = g_{m2} r_{o2}$ = gain of second stage
- $g_{m3}$ = transconductance of output stage
- $C_L$ = load capacitance

**Relation:** $GBW = A_{v1} \cdot A_{v2} \cdot UGB_3$ where $UGB_3 = \frac{g_{m3}}{2\pi C_L}$

**Dynamic bandwidth:** During settling, instantaneous GBW increases → can use 3-4× lower initial GBW vs static OTA.

Typical: 50-120 MHz

---

## Poles

**Dominant pole:** At output node

$$\boxed{p_{\mathrm{dom}} = \frac{1}{R_{\mathrm{out}} C_L} = \frac{g_{m3}}{A_{v3} C_L}}$$

where $A_{v3}$ = output stage gain, $R_{\mathrm{out}} = r_{o3,p} \| r_{o3,n}$

**Non-dominant poles:** At internal nodes (stages 1 and 2)

$$\boxed{p_1 = \frac{g_{m2}}{C_1}, \quad p_2 = \frac{g_{m3}}{C_2}}$$

**Approximate relation:**

$$\boxed{p_1 \approx p_2 \approx \frac{f_T}{A_v}}$$

where $f_T$ = transistor intrinsic cutoff frequency, $A_v$ = per-stage gain.

**Stability criterion:**

$$\boxed{f_T \gg GBW \cdot A_v}$$

$$PM \propto \frac{1}{\sqrt{1 + \left(\frac{p_1}{GBW}\right)^2}}$$

---

## Settling Time

$$\boxed{t_{\mathrm{settle}} \approx N \cdot \tau_{\mathrm{inv}} \cdot \ln\left(\frac{1}{\varepsilon}\right)}$$

where $N$ = number of stages, $\tau_{\mathrm{inv}}$ = inverter delay, $\varepsilon$ = accuracy.

Typical: 10-15 ns for 0.1% accuracy (40nm @ 1.1V)

---

## Slew Rate

$$\boxed{SR = \frac{I_{\mathrm{out,p}} + I_{\mathrm{out,n}}}{C_L}}$$

**SR/GBW ratio:**

$$\boxed{\frac{SR}{GBW} = \frac{4\pi}{A_{v1} A_{v2} g_{m3}/I_{\mathrm{on}}}}$$

Much higher SR/GBW than Miller OTA due to $A_{v1} A_{v2}$ denominator.

**Enhancement:** Combine LVT (static bias) + HVT (doubles slewing current) devices.

---

## Power Efficiency vs Miller OTA

### Output Stage $g_m$ Requirement

**Miller OTA:**
$$g_{m2,\mathrm{Miller}} = 6\pi C_L \times GBW$$

**Ring Amplifier:**
$$g_{m3,\mathrm{ringamp}} = \frac{2\pi}{A_{v1}A_{v2}} C_L \times GBW$$

**Ratio:**
$$\boxed{r = \frac{g_{m2,\mathrm{Miller}}}{g_{m3,\mathrm{ringamp}}} = 3A_{v1}A_{v2}}$$

**Power saving:** Proportional to $(A_v)^2$

Even with intrinsic gain = 6 (advanced process): **>100× output stage power reduction**

### Input Stage Power Saving

Ringamp noise formula (same as Miller OTA):

$$\overline{v_{no}^2} \approx \frac{2\pi\gamma kT}{\beta^2} \frac{GBW}{g_{m1}}$$

**But** ringamp has dynamic bandwidth → final GBW is higher → can use **3-4× lower initial GBW** → **3-4× input stage power reduction**

**Total power saving: typically 5-10×** vs Miller OTA for same specs.

---

## Noise

$$\boxed{\overline{v_{no}^2} \approx \frac{\gamma kT}{\beta C_{L,\mathrm{tot}}} A_{v2} g_{m3} r_{o1}}$$

$$\boxed{\overline{v_{no}^2} \approx \frac{2\pi\gamma kT}{\beta^2} \frac{GBW}{g_{m1}}}$$

**Reduce noise:** Increase $\beta C_{L,\mathrm{tot}}$, reduce 2nd stage gain $A_{v2}$ or current.

---

## Circuit Topology

### Why 3 Stages?

**3 stages** is optimal. Even number of stages causes CM latch-up (positive CM feedback).

### Stage Biasing

**Stage 1:** Fully differential, Class-A (40 μA typical)

**Stage 2:** Pseudo-differential, Class-A (20 μA typical)

**Stage 3:** Pseudo-differential, Class-AB with **Monticelli cell** (<1 μA static, >100 μA slewing)

### Common-Mode Feedback

**Multiple CMFB loops** critical for stability:

1. **Stage 1:** Direct connection to tail transistors
2. **Stage 2/3:** Switched-capacitor CMFB with auxiliary amplifier
3. **Local CMFB:** Tail transistors prevent CM ringing

---

## CMRR

$$\boxed{CMRR = \frac{A_{\mathrm{dm}}}{A_{\mathrm{cm}}} \approx g_{m1} \cdot r_{o,\mathrm{tail}}}$$

$$\boxed{CMRR_{\mathrm{total}} = CMRR_1 \times \left(1 + \frac{A_{v2} A_{v3}}{CMRR_2}\right)}$$

DC CMRR: >100 dB (40nm), >95 dB (28nm)

---

## Class-AB vs Class-B

**Class-B:** Output PMOS/NMOS both OFF in static state. Accuracy limited by dead-zone width.

**Class-AB (Recommended):** Output transistors weakly ON in static state. Accuracy determined by DC gain and UGB. **Monticelli cell** provides well-defined static current.

---

## Typical Specifications

| Parameter | Value (40nm, 1.1V) | Value (28nm, 1.0V) |
|-----------|-------------------|-------------------|
| **Effective Gain** | 70+ dB | 65-75 dB |
| **UGB** | 50-120 MHz | 100-150 MHz |
| **Phase Margin** | 60-80° | 60-75° |
| **Settling (0.1%)** | 10-15 ns | 8-12 ns |
| **Slew Rate** | High (class-AB) | Very High |
| **Power** | 80-100 μW | 60-80 μW |
| **Noise (RMS)** | 100-120 μV | 80-100 μV |
| **CMRR (DC)** | >100 dB | >95 dB |
| **PSRR (DC)** | >110 dB | >100 dB |
| **Output Swing** | 0.13-0.95 V | 0.15-0.85 V |
| **Input CM Range** | 0.35-0.62 V | 0.3-0.6 V |

---

## Design Guidelines

### Stage Gain Allocation

**Example (40nm):**
- Stage 1: ×16 (24 dB), UGB = 7.8 GHz
- Stage 2: ×5 (14 dB), UGB = 4 GHz
- Stage 3: ×40 (32 dB), UGB = 1.5 MHz
- **Total: 70 dB, 120 MHz**

### Number of Stages

**3 stages** (standard). Cannot use >5 stages (too many internal poles).

### Dead-Zone Sizing

$$C_{\mathrm{DZ}} \gg C_{\mathrm{parasitic}}$$

Typical: $C_{\mathrm{DZ}} = 50$-$200$ fF (28nm)

### Reservoir Capacitor

$$C_{\mathrm{RES}} \geq 10 \times C_{\mathrm{load}}$$

---

## PVT Robustness

**Challenge:** Intrinsic gain $g_m r_o$ varies with PVT when using current biasing.

### Voltage Headroom in Advanced Nodes

$$\boxed{V_{DZ2} = I_2 \cdot R}$$

where $R \propto \frac{1}{g_m}$.

**PVT variation:** $V_{DZ2}$ varies ~10× across corners (FS to SS).

**Design tension:**
- Smaller $I_2$ → higher $A_v$
- Larger $I_2$ → smaller $V_{DZ2}$ variation, more headroom for $I_3$

**Optimal allocation:** $V_{DZ2,\mathrm{nom}} \approx 0.15$-$0.25$ V (28nm @ 1.0V), reserve 100-150 mV for PVT margin.

### Solutions

1. **Adaptive biasing:** Sense process corner, adjust $I_2$, $I_3$ dynamically

2. **Combine LVT/HVT devices:** LVT for input (high $g_m$), HVT for output (lower leakage)

3. **Multiple CMFB loops:** Maintain dead-zone alignment across PVT

4. **Digital calibration:** Capacitor DAC at input or dead-zone injection

5. **Process-tracking resistor biasing:** Replace diode MOS with poly resistors (reduces variation from ~10× to ~2-3×)

### Achieved Performance

**40nm CMOS:**
- Gain variation: 53-70 dB over 30 corners
- Phase margin: >60° yield = 99.2%
- Offset: 2.5 mV (1σ), <100 μV after auto-zero

**28nm CMOS:**
- Effective gain: 65-75 dB, Power: <100 μW
- Supply variation: $\pm 10\%$
- Temperature: -40°C to 125°C

---

## Comparison with Other Amplifiers

| Criterion | Ring Amp | Miller OTA | FIA |
|-----------|----------|------------|-----|
| **Effective Gain** | 65-75 dB | 60-100 dB | 20-90 dB |
| **Power Efficiency** | Excellent | Poor-Med | Excellent |
| **Scalability** | Excellent | Poor | Good |
| **Slew Rate** | Very High | Low-Med | High |
| **Stability** | Good (output dom.) | Challenging | Excellent |
| **Noise** | Medium | Low-Med | Medium |
| **Suitable for** | 50-90dB, 15MS/s-4GS/s | High-res, low-speed | DTDSM |

---

## Applications

- Pipelined ADC residue amplifier (15 MS/s - 4 GS/s)
- SAR ADC with gain stage
- High-speed switched-capacitor circuits
- Target: 50-90 dB gain, >10-bit precision

---

## Key Design Equations

**Gain-Bandwidth Product:**

$$\boxed{GBW = \frac{A_{v1} A_{v2} g_{m3}}{2\pi C_L} = \frac{g_{m1} r_{o1} \cdot g_{m2} r_{o2} \cdot g_{m3}}{2\pi C_L}}$$

**Dead-Zone:**

$$\boxed{V_{\mathrm{DZ,in}} = \left[-\frac{V_{\mathrm{os}}}{A_1}, \frac{V_{\mathrm{os}}}{A_1}\right]}$$

**Poles:**

$$\boxed{p_{\mathrm{dom}} = \frac{g_{m3}}{A_{v3} C_L}, \quad p_{\mathrm{internal}} \approx \frac{f_T}{A_v}}$$

**Noise:**

$$\boxed{\overline{v_{no}^2} \approx \frac{\gamma kT}{\beta C_L} A_{v2} g_{m3} r_{o1} \approx \frac{2\pi\gamma kT}{\beta^2} \frac{GBW}{g_{m1}}}$$

**Power Efficiency vs Miller OTA:**

$$\boxed{\frac{g_{m,\mathrm{Miller}}}{g_{m,\mathrm{ringamp}}} = 3A_{v1}A_{v2}}$$

**Slew Rate:**

$$\boxed{SR = \frac{I_{\mathrm{out,p}} + I_{\mathrm{out,n}}}{C_L}}$$

**CMRR:**

$$\boxed{CMRR \approx g_{m1} \cdot r_{o,\mathrm{tail}}}$$

**Stability:**

$$\boxed{f_T \gg GBW \cdot A_v}$$
