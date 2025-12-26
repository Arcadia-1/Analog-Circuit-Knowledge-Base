# Miller Compensated Two-Stage Amplifier

<!--
Input: Classical analog circuit design theory
Output: Mathematical reference for Miller-compensated two-stage OTA
Position: Fundamental operational amplifier topology
-->

## Overview

Miller compensated two-stage amplifier is the **most widely used operational amplifier topology** for general-purpose applications. It consists of a **differential input stage** (high gain, low output impedance) and a **common-source output stage** (high gain, high output impedance), with **Miller compensation capacitor** $C_C$ creating a dominant pole for stability.

---

## Circuit Topology

**Stage 1:** Differential pair with active load (5T or folded-cascode)
- Input transconductance: $g_{m1}$
- Output resistance: $R_1 = r_{o1} \| r_{o3}$
- Voltage gain: $A_{v1} = g_{m1} R_1$

**Stage 2:** Common-source amplifier with current source load
- Input transconductance: $g_{m2}$
- Output resistance: $R_2 = r_{o2} \| r_{o4}$
- Voltage gain: $A_{v2} = g_{m2} R_2$

**Compensation:** Miller capacitor $C_C$ between output and stage 1 output

---

## DC Gain

$$\boxed{A_0 = A_{v1} \times A_{v2} = (g_{m1} R_1)(g_{m2} R_2)}$$

**Expanded form:**

$$\boxed{A_0 = g_{m1}(r_{o1} \| r_{o3}) \cdot g_{m2}(r_{o2} \| r_{o4})}$$

**Typical values:**
- Long-channel: 80-120 dB
- Short-channel (28nm): 40-60 dB (due to low $r_o$)

---

## Poles and Zeros

### Dominant Pole (Miller Effect)

$$\boxed{p_1 = -\frac{1}{R_1 C_C A_{v2}} \approx -\frac{1}{R_1 C_C g_{m2} R_2}}$$

**Miller multiplication:** $C_C$ appears as $(1 + A_{v2})C_C$ at stage 1 output.

### Non-Dominant Pole

**At output node:**

$$\boxed{p_2 \approx -\frac{1}{R_2(C_L + C_{\mathrm{out,par}})}}$$

where $R_2 = r_{o2} \| r_{o4}$, $C_{\mathrm{out,par}}$ = parasitic capacitance at output.

**When $C_L \gg C_{\mathrm{out,par}}$:**

$$\boxed{p_2 \approx -\frac{1}{R_2 C_L}}$$

### Right-Half-Plane Zero

Miller capacitor creates a **feedforward path** that causes RHP zero:

$$\boxed{z = \frac{g_{m2}}{C_C}}$$

**Problem:** RHP zero adds negative phase (phase lag), degrading phase margin.

**At high frequency:** Output current from $C_C$ opposes output current from $g_{m2}$.

---

## Gain-Bandwidth Product (GBW)

**Definition:** Frequency where open-loop gain = 1 (0 dB)

$$\boxed{GBW = |A_0 \times p_1| = \frac{g_{m1}}{C_C}}$$

**Key insight:** GBW is **independent of second stage**, only depends on $g_{m1}$ and $C_C$.

**Unity-gain frequency:**

$$\boxed{f_u = \frac{GBW}{2\pi} = \frac{g_{m1}}{2\pi C_C}}$$

---

## Phase Margin

**Definition:** Phase at $f = f_u$ minus -180°

$$\boxed{PM = 180° - \left|90° + \arctan\left(\frac{f_u}{f_{p2}}\right) - \arctan\left(\frac{f_u}{f_z}\right)\right|}$$

**Simplified approximation (assuming RHP zero is compensated or far from $f_u$):**

$$\boxed{PM \approx 90° - \arctan\left(\frac{f_u}{f_{p2}}\right)}$$

**For good stability (PM > 60°):**

$$\boxed{f_{p2} > 2.2 \times f_u}$$

**Design guideline (when using nulling resistor $R_z = 1/g_{m2}$ to cancel RHP zero):**

$$\boxed{g_{m2} \geq 2.2 \times g_{m1}}$$

**Note:** Without zero compensation, additional margin needed due to RHP zero phase lag.

---

## Miller Capacitor Sizing

**From GBW specification:**

$$\boxed{C_C = \frac{g_{m1}}{2\pi \times GBW}}$$

**Verify phase margin:** Check that $f_{p2} = \frac{1}{2\pi R_2 C_L} > 2.2 \times GBW$ for PM ≥ 60°.

**Practical sizing:** Choose $C_C$ from GBW requirement, then size $g_{m2}$ to ensure adequate $f_{p2}$ separation.

---

## Load Capacitance Effect

**Non-dominant pole with load:**

$$\boxed{p_2 = -\frac{1}{R_2 C_L}}$$

(assuming $C_L \gg C_{\mathrm{out,par}}$)

**Phase margin degradation:** Larger $C_L$ pushes $p_2$ lower → worse PM.

**Design approach:**
- Determine $C_C$ from GBW requirement: $C_C = g_{m1}/(2\pi \times GBW)$
- Verify $f_{p2} = 1/(2\pi R_2 C_L) > 2.2 \times GBW$
- If inadequate, increase $R_2$ (use cascodes) or reduce $C_L$

**Typical range:** $C_C \approx 0.1$-$0.5 \times C_L$ (not necessarily $C_C \gg C_L$)

---

## Slew Rate

**Limited by compensation capacitor charging:**

$$\boxed{SR = \frac{I_{\mathrm{bias,1}}}{C_C}}$$

where $I_{\mathrm{bias,1}}$ = tail current of first stage differential pair.

**Large signal behavior:** When input overdrive saturates differential pair, all tail current charges/discharges $C_C$.

**SR/GBW ratio:**

$$\boxed{\frac{SR}{GBW} = \frac{I_{\mathrm{bias,1}}/C_C}{g_{m1}/C_C} = \frac{I_{\mathrm{bias,1}}}{g_{m1}}}$$

For differential pair in strong inversion: $g_{m1} = I_{\mathrm{bias,1}}/V_{OV}$

$$\boxed{\frac{SR}{GBW} \approx V_{OV} = V_{GS} - V_T}$$

**Typical values:** For $V_{OV} \approx 200$-$300$ mV, SR/GBW ≈ 0.2-0.3 V

---

## Settling Time

**Small signal (exponential settling):**

$$\boxed{t_{\mathrm{settle}} = \frac{\ln(1/\varepsilon)}{2\pi \times GBW}}$$

where $\varepsilon$ = settling accuracy (e.g., 0.001 for 0.1%)

**Large signal (slew-limited):**

$$\boxed{t_{\mathrm{slew}} = \frac{\Delta V}{SR} = \frac{\Delta V \cdot C_C}{I_{\mathrm{bias,1}}}}$$

**Total settling time:**

$$\boxed{t_{\mathrm{total}} \approx t_{\mathrm{slew}} + t_{\mathrm{settle}}}$$

---

## Noise

### Input-Referred Thermal Noise

**From first stage (M1, M2) - approximate:**

$$\overline{v_{n,\mathrm{in,1}}^2} \approx 8kT\gamma \frac{1}{g_{m1}} \Delta f$$

**From first stage load (M3, M4):**

$$\overline{v_{n,\mathrm{in,3}}^2} \approx 8kT\gamma \frac{g_{m3}}{g_{m1}^2} \Delta f$$

**From second stage (M6):**

$$\overline{v_{n,\mathrm{in,6}}^2} \approx 4kT\gamma \frac{1}{g_{m6}} \cdot \frac{1}{A_{v1}^2} \Delta f$$

**Total thermal noise (order-of-magnitude estimate):**

$$\boxed{\overline{v_{n,\mathrm{th}}^2} \approx \frac{8kT\gamma}{g_{m1}}\left(1 + \frac{g_{m3}}{g_{m1}} + \frac{g_{m1}}{2g_{m6} A_{v1}^2}\right) \Delta f}$$

**When $A_{v1} \gg 1$, second stage contribution negligible:**

$$\boxed{\overline{v_{n,\mathrm{th}}^2} \approx \frac{8kT\gamma}{g_{m1}}\left(1 + \frac{g_{m3}}{g_{m1}}\right) \Delta f}$$

**Note:** Coefficients vary with detailed device models; above uses typical long-channel approximations.

**Dominant term:** First stage differential pair (minimize by maximizing $g_{m1}$)

### Flicker Noise (1/f)

$$\boxed{\overline{v_{n,\mathrm{flicker}}^2} = \frac{2K_n}{W_1 L_1 C_{\mathrm{ox}} f} \Delta f}$$

**Mitigation:**
- Use PMOS input (lower K_p than K_n)
- Increase $W_1 L_1$ area
- Apply chopper stabilization or CDS

---

## Output Swing

**Maximum output voltage:**

$$\boxed{V_{\mathrm{out,max}} = V_{DD} - V_{DS,\mathrm{sat},4}}$$

**Minimum output voltage:**

$$\boxed{V_{\mathrm{out,min}} = V_{DS,\mathrm{sat},6}}$$

**Total swing:**

$$\boxed{V_{\mathrm{swing}} = V_{DD} - V_{DS,\mathrm{sat},4} - V_{DS,\mathrm{sat},6}}$$

**Typical:** 0.8-1.0 × $V_{DD}$ for single-stage loads

---

## Common-Mode Rejection Ratio (CMRR)

**First stage dominates (approximate):**

$$\boxed{CMRR \approx 2 g_{m1} r_{o,\mathrm{tail}} \times A_{v2}}$$

**Interpretation:** Second stage multiplies first stage CMRR by $A_{v2}$.

**Note:** Exact expression depends on circuit topology (cascode tail, CMFB, etc.). Above is order-of-magnitude estimate.

**Typical values:** 80-120 dB (DC)

---

## Power Supply Rejection Ratio (PSRR)

### Positive Supply (V_DD)

**Coupling through load transistors (approximate):**

$$\boxed{PSRR^+ \approx \frac{A_0}{1 + g_{m3} r_{o3}}}$$

**Typical:** 40-80 dB (poor) - direct coupling through current mirror

**Note:** Exact value depends on current mirror topology and CMFB implementation.

### Negative Supply (V_SS)

**Coupling through tail current (approximate):**

$$\boxed{PSRR^- \approx 2 g_{m1} r_{o,\mathrm{tail}} \times A_{v2}}$$

**Typical:** 80-120 dB (good) - similar mechanism as CMRR

**Note:** Above assumes simple tail current source. Cascode tail improves PSRR^-.

**Improvement:** Use cascode current mirrors and regulated cascode tail.

---

## Power Consumption

**First stage:**

$$P_1 = I_{\mathrm{bias,1}} \times V_{DD}$$

**Second stage:**

$$P_2 = I_{\mathrm{bias,2}} \times V_{DD}$$

**Total:**

$$\boxed{P_{\mathrm{total}} = (I_{\mathrm{bias,1}} + I_{\mathrm{bias,2}}) V_{DD}}$$

**Current allocation:** Typically $I_{\mathrm{bias,2}} = (2-5) \times I_{\mathrm{bias,1}}$

**Figure of Merit:**

$$\boxed{FOM = \frac{C_L \times GBW}{P_{\mathrm{total}}}}$$

Unit: pF·MHz/mW

---

## Design Procedure

### Step 1: Specifications

- DC gain: $A_0$
- GBW: $f_u$
- Phase margin: PM
- Load capacitance: $C_L$
- Slew rate: SR
- Power budget: $P_{\mathrm{max}}$

### Step 2: First Stage Design

**From SR and GBW:**

$$\boxed{I_{\mathrm{bias,1}} = SR \times C_C = SR \times \frac{g_{m1}}{2\pi \times GBW}}$$

Solving for $g_{m1}$:

$$\boxed{g_{m1} = \frac{2\pi \times GBW \times SR}{\frac{SR}{I_{\mathrm{bias,1}}}}}$$

**Practical approach:** Choose $I_{\mathrm{bias,1}}$ based on power budget, then:

$$\boxed{g_{m1} = 2\pi \times GBW \times C_C}$$

$$\boxed{C_C = \frac{I_{\mathrm{bias,1}}}{SR}}$$

**Size M1, M2:** For given $g_{m1}$ and $I_{\mathrm{bias,1}}$:

$$\boxed{\frac{W}{L}\bigg|_{M1} = \frac{g_{m1}^2}{2\mu_n C_{\mathrm{ox}} I_{\mathrm{bias,1}}}}$$

### Step 3: Second Stage Design

**From phase margin constraint (with RHP zero compensation):**

$$\boxed{g_{m2} \geq 2.2 \times g_{m1}}$$

For PM = 60°. Use larger ratio (3-5×) for more margin.

**Alternative:** Size $g_{m2}$ and $R_2$ to ensure $f_{p2} = \frac{1}{2\pi R_2 C_L} > 2.2 \times GBW$

**From DC gain:**

$$\boxed{g_{m2} R_2 = \frac{A_0}{g_{m1} R_1}}$$

**Size M6:** For given $g_{m2}$ and $I_{\mathrm{bias,2}}$:

$$\boxed{\frac{W}{L}\bigg|_{M6} = \frac{g_{m2}^2}{2\mu_n C_{\mathrm{ox}} I_{\mathrm{bias,2}}}}$$

### Step 4: Compensation Capacitor

$$\boxed{C_C = \frac{g_{m1}}{2\pi \times GBW}}$$

**Note:** Typically $C_C \approx 0.1$-$0.5 \times C_L$, not $C_C \gg C_L$.

### Step 5: Verify Specs

- Check: $f_{p2} = \frac{1}{2\pi R_2 C_L} > 2.2 \times GBW$
- Check: $A_0 = g_{m1} R_1 \times g_{m2} R_2$ meets spec
- Check: $SR = \frac{I_{\mathrm{bias,1}}}{C_C}$ meets spec
- Simulate: Verify PM, stability, noise

---

## Advantages vs Disadvantages

### Advantages

- Simple topology, well-understood
- High DC gain (two stages)
- Single compensation capacitor
- Moderate power consumption
- Good CMRR and PSRR^-

### Disadvantages

- Limited slew rate (SR and GBW both scale with 1/$C_C$, creating trade-off)
- Poor PSRR^+ (supply coupling through loads)
- RHP zero can limit phase margin (requires compensation)
- Non-dominant pole $p_2$ depends on load $C_L$ (PM degrades with heavy loads)
- Not suitable for low-voltage (need headroom for cascodes)

---

## Improvements and Variants

### RHP Zero Cancellation

**Add nulling resistor $R_z$ in series with $C_C$:**

$$\boxed{R_z = \frac{1}{g_{m2}}}$$

Creates LHP zero that cancels RHP zero.

### Cascode Loads

Replace simple current mirrors with cascode → increase $R_1$, $R_2$ → higher gain.

**Trade-off:** Reduced output swing, requires higher $V_{DD}$.

### Folded-Cascode First Stage

Higher output impedance → higher $A_{v1}$ → smaller $C_C$ for same GBW.

### Split-Length Compensation

Use two capacitors with different connections to optimize pole-zero placement.

---

## Comparison with Other Topologies

| Criterion | Miller 2-Stage | Ring Amp | Folded-Cascode | Telescopic |
|-----------|---------------|----------|----------------|------------|
| **Gain** | 60-120 dB | 65-75 dB | 40-80 dB | 40-80 dB |
| **GBW** | Medium | High | Medium-High | High |
| **Power** | Medium | Low-Med | Medium | Low |
| **Slew Rate** | Low-Med | Very High | Medium | Medium-High |
| **Supply** | >1.5V | >1.0V | >1.5V | >1.8V |
| **Swing** | Good | Excellent | Poor | Very Poor |
| **Stability** | Good | Good | Excellent | Excellent |
| **Complexity** | Low | Medium | Medium | Low |

---

## Key Design Equations

**DC Gain:**
$$\boxed{A_0 = g_{m1} R_1 \cdot g_{m2} R_2}$$

**GBW:**
$$\boxed{GBW = \frac{g_{m1}}{C_C}}$$

**Poles:**
$$\boxed{p_1 = -\frac{1}{R_1 C_C A_{v2}}, \quad p_2 \approx -\frac{1}{R_2 C_L}}$$

**RHP Zero:**
$$\boxed{z = \frac{g_{m2}}{C_C}}$$

**Phase Margin (with zero compensation):**
$$\boxed{PM \approx 90° - \arctan\left(\frac{GBW}{f_{p2}}\right)}$$

**Slew Rate:**
$$\boxed{SR = \frac{I_{\mathrm{bias,1}}}{C_C}}$$

**SR/GBW:**
$$\boxed{\frac{SR}{GBW} \approx V_{OV}}$$

**Noise (approximate, when $A_{v1} \gg 1$):**
$$\boxed{\overline{v_{n}^2} \approx \frac{8kT\gamma}{g_{m1}}\left(1 + \frac{g_{m3}}{g_{m1}}\right) \Delta f}$$

**CMRR (approximate):**
$$\boxed{CMRR \approx 2 g_{m1} r_{o,\mathrm{tail}} \times A_{v2}}$$

**Design Constraint (with zero compensation):**
$$\boxed{g_{m2} \geq 2.2 \times g_{m1}}$$
