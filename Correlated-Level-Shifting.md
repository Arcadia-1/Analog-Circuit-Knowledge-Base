# Correlated Level Shifting (CLS)

<!--
Input: Internet research, IEEE papers on CLS technique
Output: Formulas and techniques for correlated level shifting in SC circuits
Position: Advanced gain enhancement technique for low-gain amplifiers
⚠️ After any change, update this comment AND .PROJECT.md
-->

## Overview

**Correlated Level Shifting (CLS)** is a switched-capacitor technique that achieves high-accuracy signal processing with low-gain amplifiers. By correlating the finite-gain errors across multiple signal processing stages, CLS can provide true **rail-to-rail performance** and **>60 dB effective gain** using amplifiers with only 30-40 dB open-loop gain.

### Key Advantages

- ✅ **High effective gain**: >60 dB performance from 30 dB opamps
- ✅ **Simple amplifiers**: Single-stage opamps sufficient
- ✅ **Lower power**: Simple amplifiers consume less power
- ✅ **Better scalability**: Works well in nanoscale CMOS
- ✅ **Rail-to-rail capability**: True rail-to-rail swing even with finite gain
- ✅ **Minimal noise penalty**: Negligible additive noise

---

## Fundamental Principle

### Finite Gain Error Problem

In switched-capacitor circuits, **finite amplifier gain** causes errors:

$$V_{\mathrm{out,ideal}} = -\frac{C_S}{C_F} V_{\mathrm{in}}$$

$$\boxed{V_{\mathrm{out,actual}} = -\frac{C_S}{C_F} V_{\mathrm{in}} \cdot \frac{A}{1 + A(1 + C_S/C_F)}}$$

For large open-loop gain $A$:

$$V_{\mathrm{out,actual}} \approx -\frac{C_S}{C_F} V_{\mathrm{in}} \cdot \left(1 - \frac{1 + C_S/C_F}{A}\right)$$

**Gain error:**

$$\boxed{\epsilon_{\mathrm{gain}} = \frac{1 + C_S/C_F}{A}}$$

**Problem:** For 0.1% accuracy (10-bit), need $A > 1000$ (60 dB)
- Requires multi-stage opamps
- High power consumption
- Difficult in low-voltage processes

### CLS Solution

**CLS correlates the finite-gain errors** across two phases:

1. **Phase 1:** Process with error $\epsilon_1$
2. **Phase 2:** Process with error $\epsilon_2$
3. **Correlation:** Errors are related, enabling cancellation

**Result:** Effective gain error:

$$\boxed{\epsilon_{\mathrm{eff}} = \epsilon_1 \cdot \epsilon_2 \approx \frac{1}{A^2}}$$

**Second-order error!** For $A = 30$ dB (31.6×):

- Without CLS: $\epsilon = 3.2\%$ (4-5 bit accuracy)
- With CLS: $\epsilon = 0.1\%$ (10-bit accuracy)

**30× improvement in accuracy!**

---

## Basic CLS Operation

### Two-Phase CLS Circuit

**Phase 1: Level Shifting**

- Input $V_{\mathrm{in}}$ connects through $C_{\mathrm{LS}}$ (level-shifting cap)
- Opamp settles to $V_1$ with finite-gain error
- $V_1 = \alpha_1 \cdot V_{\mathrm{desired}}$

**Phase 2: Signal Processing with Compensation**

- Level-shifted voltage from Phase 1 used to cancel error in Phase 2
- Final output compensates for both finite-gain errors
- $V_{\mathrm{out}} \approx V_{\mathrm{desired}}$ (error $\sim 1/A^2$)

### Mathematical Description

**Phase 1 output:**

$$V_1 = \frac{A}{1 + A\beta_1} V_{\mathrm{in}} \approx \left(1 - \frac{\beta_1}{A}\right) V_{\mathrm{in}}$$

**Phase 2 output (using V₁):**

$$V_2 = \frac{A}{1 + A\beta_2} \cdot f(V_1) \approx \left(1 - \frac{\beta_2}{A}\right) \cdot f(V_1)$$

Substituting $V_1$:

$$V_2 \approx \left(1 - \frac{\beta_2}{A}\right) \left(1 - \frac{\beta_1}{A}\right) V_{\mathrm{desired}}$$

$$\boxed{V_2 \approx \left(1 - \frac{\beta_1 + \beta_2}{A} + \frac{\beta_1\beta_2}{A^2}\right) V_{\mathrm{desired}}}$$

**For $\beta_1 = \beta_2 = 1$:**

$$V_2 \approx \left(1 - \frac{2}{A} + \frac{1}{A^2}\right) V_{\mathrm{desired}}$$

**Dominant error:** $-2/A$ (first-order)

**But with proper CLS design:** First-order term cancels!

$$\boxed{V_2 \approx \left(1 - \frac{1}{A^2}\right) V_{\mathrm{desired}}}$$

---

## CLS Topologies

### 1. Basic CLS (Single-Stage)

**Simplest implementation:**

- **Level-shifting capacitor** $C_{\mathrm{LS}}$ stores intermediate result
- **Two phases:** Level shift, then process
- **Gain enhancement:** ~20 dB (factor of 10×)

**Effective DC gain improvement:**

$$A_{\mathrm{eff}} \approx A^2$$

**Example:**
- Opamp gain: 30 dB (31.6×)
- Effective gain: **60 dB (1000×)**

### 2. Sequential CLS (SCLS)

**Multi-stage CLS** for even higher accuracy:

**Principle:** Cascade multiple CLS stages

**Effective gain:**

$$\boxed{A_{\mathrm{eff}} = A^N}$$

where $N$ is the number of CLS stages.

**For N = 3 with A = 30 dB:**

$$A_{\mathrm{eff}} = (31.6)^3 \approx 31,600 = 90\ \mathrm{dB}$$

**Trade-off:**
- Higher accuracy
- More capacitors (area)
- More clock phases (complexity)
- Longer settling time

**Typical:** N = 2-3 stages for high-precision applications

### 3. Charge-Compensated CLS

**Innovation:** Add charge compensation to reduce noise penalty

**Standard CLS noise penalty:**

$$V_{n,\mathrm{CLS}}^2 = V_{n,\mathrm{opamp}}^2 \cdot \left(1 + \frac{C_{\mathrm{LS}}}{C_S}\right)$$

**With charge compensation:**

$$\boxed{V_{n,\mathrm{CC-CLS}}^2 = V_{n,\mathrm{opamp}}^2 \cdot \left(1 + \frac{C_{\mathrm{LS}}}{C_S + C_{\mathrm{comp}}}\right)}$$

**Reduced noise** for same CLS performance!

**Published result:** Enables true rail-to-rail input range with charge-compensated CLS

### 4. Ping-Pong CLS

**For inverter-based OTAs:**

**Concept:** Two inverter-based amplifiers operate in **ping-pong** fashion
- While one amplifies, the other performs CLS
- Alternate every half cycle
- **Continuous operation** without dead time

**DC gain improvement:**

- Inverter gain (basic): ~30-40 dB
- With CLS: **>70 dB**

**Advantages:**
- Simple inverter-based OTA (low power)
- High effective gain
- Suitable for low-voltage operation

---

## Design Equations

### 1. Effective Gain Formula

For single-stage CLS:

$$\boxed{A_{\mathrm{eff}} = \frac{A^2}{k}}$$

where:
- $A$ = open-loop gain of opamp
- $k$ = configuration constant (typically 1-2)

**Gain error:**

$$\boxed{\epsilon_{\mathrm{gain,CLS}} = \frac{k}{A^2}}$$

### 2. Required Opamp Gain

For target accuracy $\epsilon_{\mathrm{target}}$:

**Without CLS:**

$$A_{\mathrm{required}} = \frac{1 + C_S/C_F}{\epsilon_{\mathrm{target}}}$$

**With CLS:**

$$\boxed{A_{\mathrm{required}} = \sqrt{\frac{k}{\epsilon_{\mathrm{target}}}}}$$

**Example:** For 0.1% accuracy (10-bit):

- Without CLS: $A > 1000$ (60 dB)
- With CLS (k=1): $A > 31.6$ (30 dB)

**>30 dB relaxation!**

### 3. Level-Shifting Capacitor Sizing

**Trade-off:**

$$\boxed{C_{\mathrm{LS}} = \alpha \cdot C_S}$$

where $\alpha$ is the sizing ratio (typically 0.5-2).

**Considerations:**

| $C_{\mathrm{LS}}$ | Gain Accuracy | Noise | Area |
|---|---|---|---|
| Large | Better | Worse | Larger |
| Small | Worse | Better | Smaller |

**Optimal:** $C_{\mathrm{LS}} \approx C_S$ (balanced trade-off)

**Published result:** Size of level-shifting capacitor only **weakly influences** noise performance

### 4. Noise Analysis

**Total output noise:**

$$V_{n,\mathrm{out}}^2 = V_{n,\mathrm{thermal}}^2 + V_{n,\mathrm{opamp}}^2 \cdot G_{\mathrm{noise}}$$

**CLS noise gain factor:**

$$\boxed{G_{\mathrm{noise}} = 1 + \frac{C_{\mathrm{LS}}}{C_S}}$$

**Typical:** $G_{\mathrm{noise}} = 1.5$ to 2 (modest increase)

**With charge compensation:** $G_{\mathrm{noise}}$ can be reduced closer to 1

---

## Applications

### 1. Pipelined SAR ADCs

**Challenge:** Residue amplifier needs high gain for accuracy

**Traditional:** Multi-stage opamp (high power)

**With CLS:**
- Single-stage opamp sufficient
- 30 dB opamp → 60 dB effective gain
- **Lower power, faster settling**

**Published work:** "Look Ahead CLS in Pipelined SAR ADCs"
- Relaxes residue amplifier design
- Enables lower power operation
- Maintains linearity and accuracy

**Benefits:**
- Reduced power by 30-50%
- Faster conversion time
- Better FoM

### 2. Switched-Capacitor Amplifiers

**High-accuracy SC gain stages:**

**Closed-loop gain:**

$$A_{\mathrm{CL}} = -\frac{C_S}{C_F}$$

**Accuracy with CLS:**

$$\boxed{A_{\mathrm{CL,actual}} = -\frac{C_S}{C_F} \cdot \left(1 - \frac{k}{A_{\mathrm{opamp}}^2}\right)}$$

**For 14-bit accuracy (0.006% error):**

- Without CLS: Need 80+ dB opamp
- With CLS: Need 40+ dB opamp

**Use case:** High-resolution data acquisition systems

### 3. SC Integrators

**Delta-sigma modulators, filters:**

**Integrator transfer function:**

$$H(z) = \frac{z^{-1}}{1 - z^{-1}} \cdot \frac{C_S}{C_F}$$

**Finite-gain error causes:**
- Integrator leakage
- Reduced loop gain
- Degraded noise shaping

**CLS benefits:**
- Improved loop gain
- Better noise shaping
- Lower quantization noise in-band

**Example:** Audio delta-sigma ADC
- Target: >100 dB SNR
- Integrator accuracy: <0.01%
- CLS enables simple opamp design

### 4. Comparator-Based Integrators

**Highly efficient for delta-sigma:**

**Problem:** Comparator-based switched-capacitor (CBSC) integrators have limited gain

**CLS solution:**
- Improves effective gain of CBSC
- Maintains energy efficiency
- Enables high-resolution CBSC delta-sigma

**Published:** "The Correlated Level Shifting as a Gain Enhancement Technique for Comparator Based Integrators"

**Results:**
- Gain improvement from 39 dB to **71 dB**
- Power cost: Only **17% increase**
- Area overhead: Modest

### 5. Single-Stage Opamp Designs

**For rail-to-rail operation:**

**Challenge:** Single-stage opamps have limited gain (30-40 dB)

**CLS enables:**
- **>60 dB true rail-to-rail performance**
- Using opamp with only 30 dB loop gain
- No gain boosting or cascoding needed

**Applications:**
- Low-voltage circuits (<1V)
- Nanoscale CMOS (where high intrinsic gain difficult)
- Energy-efficient analog processing

---

## Practical Implementation

### Circuit Example: SC Amplifier with CLS

**Phase 1: Sampling + Level Shifting**

When $\phi_1 = 1$:
- Sample input on $C_S$
- Perform first amplification with error $\epsilon_1$
- Store result on $C_{\mathrm{LS}}$

**Phase 2: Output + Error Cancellation**

When $\phi_2 = 1$:
- Transfer charge from $C_{\mathrm{LS}}$ to $C_F$
- Second amplification with error $\epsilon_2$
- Errors correlate, yielding effective error $\epsilon_1 \cdot \epsilon_2$

**Switch Requirements:**
- Bottom-plate sampling to reduce charge injection
- Non-overlapping clocks (avoid charge sharing)
- Properly sized for fast settling

### Clock Timing

**Critical timing parameters:**

1. **Phase 1 duration:**
   $$T_{\phi1} \geq 7\tau_1$$
   where $\tau_1 = 1/(A_0 \omega_u)$ is the opamp settling time constant

2. **Phase 2 duration:**
   $$T_{\phi2} \geq 7\tau_2$$

3. **Non-overlap time:**
   $$T_{\mathrm{non-overlap}} = 1-2$ ns (typical)

4. **Total clock period:**
   $$T_{\mathrm{clk}} = T_{\phi1} + T_{\phi2} + 2T_{\mathrm{non-overlap}}$$

**Trade-off:** More CLS stages → higher accuracy but longer settling time

### Capacitor Layout

**Best practices:**

1. **Common-centroid** for $C_S$, $C_{\mathrm{LS}}$, $C_F$
2. **Same unit capacitor** size for good matching
3. **Metal-insulator-metal (MIM)** caps for low voltage coefficient
4. **Dummy capacitors** around periphery
5. **Shield layers** above and below

**Matching requirement:**

$$\boxed{\frac{\Delta C}{C} < \frac{\epsilon_{\mathrm{target}}}{10}}$$

For 0.1% target accuracy: Need <0.01% capacitor matching

**Achievable with careful layout and large unit caps**

---

## Noise Considerations

### Noise Mechanisms

**1. Thermal noise (kT/C):**

Each sampling operation adds kT/C noise:

$$V_{n,\mathrm{kT/C}}^2 = \frac{kT}{C_S}$$

**2. Opamp noise:**

Opamp input-referred noise appears at output scaled by noise gain:

$$V_{n,\mathrm{opamp,out}}^2 = V_{n,\mathrm{opamp,in}}^2 \cdot \left(1 + \frac{C_S + C_{\mathrm{LS}}}{C_F}\right)^2$$

**3. CLS additional noise:**

Level-shifting adds noise from extra sampling:

$$V_{n,\mathrm{CLS}}^2 = \frac{kT}{C_{\mathrm{LS}}}$$

### Total Noise Formula

$$\boxed{V_{n,\mathrm{total}}^2 = \frac{kT}{C_S} + \frac{kT}{C_{\mathrm{LS}}} + V_{n,\mathrm{opamp}}^2 \cdot G_{\mathrm{noise}}}$$

**For $C_{\mathrm{LS}} = C_S$:**

$$V_{n,\mathrm{total}}^2 = \frac{2kT}{C_S} + V_{n,\mathrm{opamp}}^2 \cdot G_{\mathrm{noise}}$$

**Noise penalty:** ~2× in thermal noise, modest in opamp noise

**Trade-off accepted** because:
- Simpler opamp → lower opamp noise possible
- Smaller power → can afford larger $C_S$ for same power budget
- Net result: Often **lower total noise**

### Noise Optimization

**To minimize noise:**

1. **Optimize $C_{\mathrm{LS}}/C_S$ ratio:**
   - Too small: Poor CLS performance
   - Too large: Excessive noise
   - **Optimal:** $C_{\mathrm{LS}} = (0.5-1) \times C_S$

2. **Use charge compensation:**
   - Reduces noise gain factor
   - Minimal impact on CLS accuracy

3. **Low-noise opamp design:**
   - Larger input devices
   - Optimized bias current
   - Since gain relaxed, can focus on noise

---

## Performance Comparison

### Opamp Gain Requirements

| Target Accuracy | Without CLS | With CLS (N=1) | With SCLS (N=2) |
|----------------|-------------|----------------|-----------------|
| 8-bit (0.4%) | 40 dB | 20 dB | 13 dB |
| 10-bit (0.1%) | 60 dB | 30 dB | 20 dB |
| 12-bit (0.024%) | 72 dB | 36 dB | 24 dB |
| 14-bit (0.006%) | 84 dB | 42 dB | 28 dB |
| 16-bit (0.0015%) | 96 dB | 48 dB | 32 dB |

**Typical relaxation: 30 dB (10×) for single CLS**

### Power Comparison

**Example:** 12-bit SC amplifier

**Multi-stage opamp (no CLS):**
- Required gain: 72 dB
- Opamp: 3-stage + Miller compensation
- Power: 1 mW
- Area: Large (compensation caps)

**Single-stage opamp + CLS:**
- Required gain: 36 dB
- Opamp: Single telescopic or folded-cascode
- Power: **0.3 mW** (3× reduction)
- Area: Smaller (no compensation caps, but +CLS caps)

**Net benefit:** Lower power, comparable or smaller area

### Speed Comparison

**Settling time** for same accuracy:

**Multi-stage opamp:**

$$t_{\mathrm{settle}} = \frac{7}{2\pi f_{\mathrm{unity}}}$$

Limited by unity-gain frequency and compensation.

**Single-stage + CLS:**

$$t_{\mathrm{settle,CLS}} = N \times \frac{7}{2\pi f_{\mathrm{unity,1st}}}$$

where $N$ is number of CLS stages (typically 2).

**First-stage opamp** can have higher $f_{\mathrm{unity}}$ (no compensation needed)

**Net result:** **Comparable or faster** settling despite multiple phases

---

## Advanced Techniques

### 1. Look-Ahead CLS

**For pipelined SAR ADCs:**

**Innovation:** Start CLS operation **before** current conversion completes

**Benefit:**
- Overlapped timing
- Reduced conversion time
- Maintained accuracy

**Implementation:**
- Predict residue polarity
- Pre-charge CLS capacitors
- Correct if prediction wrong

**Result:** Near-zero time penalty for CLS!

### 2. Adaptive CLS

**Adjust CLS parameters** based on operating conditions:

**Variables to adapt:**
- Level-shifting capacitor ratio
- Number of CLS stages
- Clock phase durations

**Based on:**
- Input signal amplitude
- Required accuracy (dynamic)
- PVT variations

**Benefit:** Optimize power vs. accuracy trade-off dynamically

### 3. Digital-Assisted CLS

**Combine with digital calibration:**

1. **Measure residual gain error** (after CLS)
2. **Store calibration coefficients**
3. **Digital correction** in back-end

**Achieves:**
- >80 dB effective gain from 30 dB opamp
- Compensates PVT variations
- Minimal analog overhead

### 4. CLS + Other Techniques

**Powerful combinations:**

**CLS + Chopping:**
- CLS → Accuracy/gain
- Chopping → 1/f noise, offset
- **Complete solution** for precision SC circuits

**CLS + kT/C Cancellation:**
- CLS → Gain accuracy
- kT/C cancellation → Thermal noise
- **High SNR + high accuracy**

**CLS + Gain Boosting:**
- CLS → First-order gain enhancement
- Gain boosting → Further refinement
- **Ultra-high accuracy** (>16 bit)

---

## Limitations and Challenges

### 1. Settling Time

**CLS requires multiple phases:**
- Phase 1: Level shifting
- Phase 2: Final processing
- **2× clock cycles** per operation

**Impact:**
- Reduced throughput
- Higher power (at given speed)

**Mitigation:**
- Pipelined/look-ahead techniques
- Optimize each phase separately
- Use only where needed (first stages)

### 2. Capacitor Matching

**CLS effectiveness depends on matching:**

$$\epsilon_{\mathrm{residual}} \propto \frac{\Delta C}{C}$$

**For >60 dB effective gain:** Need $\Delta C / C < 0.1\%$

**Solutions:**
- Large unit capacitors (better matching)
- Common-centroid layout
- Digital trim/calibration

### 3. Noise Penalty

**Inherent noise increase:**
- Extra sampling operations
- Larger noise gain
- More capacitors

**Typical:** 1.5-2× noise increase

**Acceptable because:**
- Can use larger caps (power savings)
- Simpler opamp may have lower noise
- Net noise often comparable

### 4. Clock Complexity

**More clock phases needed:**
- Standard SC: 2 phases (φ1, φ2)
- With CLS: 4+ phases
- With SCLS: Even more

**Challenges:**
- Clock distribution
- Skew management
- Power in clock drivers

**Solution:** Local clock generation, careful routing

---

## State-of-the-Art Examples

### Rail-to-Rail SC Amplifier (JSSC)

**Publication:** "An Over-60 dB True Rail-to-Rail Performance Using Correlated Level Shifting and an Opamp With Only 30 dB Loop Gain"

**Achievements:**
- **>60 dB effective gain**
- Using only **30 dB opamp**
- **True rail-to-rail** input and output
- Low power consumption

**Key innovation:** Optimized CLS with charge balancing

### Pipelined SAR ADC (A-SSCC)

**Publication:** "Look Ahead CLS in Pipelined SAR ADCs"

**Results:**
- Relaxed residue amplifier requirements
- **Single-stage opamp** sufficient
- High linearity maintained
- Competitive FoM

**Technique:** Look-ahead CLS for minimal latency penalty

### Inverter-Based OTA (ISCAS)

**Publication:** "Ping-Pong Operated Inverter-based OTA using CLS"

**Performance:**
- Inverter gain: ~35 dB (basic)
- **With CLS: >70 dB**
- Ultra-low power (inverter-based)
- Suitable for IoT/wearables

**Architecture:** Ping-pong operation for continuous output

---

## Design Guidelines Summary

### When to Use CLS

✅ **Use CLS when:**
- High accuracy required (>10 bits)
- Low-voltage operation (<1.2V)
- Power constrained
- Simple opamp preferred
- Moderate speed (settling time acceptable)

❌ **Don't use CLS when:**
- Ultra-high speed required (>GS/s)
- Low resolution sufficient (<8 bits)
- Single-phase operation mandatory
- Area extremely constrained
- Noise is limiting factor

### Design Checklist

1. **Determine target accuracy:**
   - Calculate required effective gain
   - Decide: single CLS or sequential CLS

2. **Select opamp gain:**
   - $A_{\mathrm{opamp}} = \sqrt{k/\epsilon_{\mathrm{target}}}$ for single CLS
   - Can use single-stage opamp (30-40 dB)

3. **Size capacitors:**
   - $C_{\mathrm{LS}} = (0.5-1) \times C_S$
   - Consider noise vs. accuracy trade-off
   - Use charge compensation if noise critical

4. **Design clock timing:**
   - Allow 5-7τ settling per phase
   - Minimize non-overlap time
   - Consider look-ahead if speed critical

5. **Layout for matching:**
   - Common-centroid capacitors
   - Symmetric routing
   - Adequate matching for target accuracy

6. **Verify with simulation:**
   - Transient settling
   - Monte Carlo (mismatch)
   - Noise analysis
   - PVT corners

---

## Key Formulas Summary

### Effective Gain

$$A_{\mathrm{eff}} = A^N$$

where $N$ = number of CLS stages

### Gain Error

**Without CLS:**
$$\epsilon = \frac{1}{A}$$

**With CLS:**
$$\epsilon_{\mathrm{CLS}} = \frac{k}{A^2}$$

### Required Opamp Gain

$$A_{\mathrm{required}} = \sqrt{\frac{k}{\epsilon_{\mathrm{target}}}}$$

### Noise

$$V_{n,\mathrm{total}}^2 = \frac{kT}{C_S} + \frac{kT}{C_{\mathrm{LS}}} + V_{n,\mathrm{opamp}}^2 \cdot G_{\mathrm{noise}}$$

$$G_{\mathrm{noise}} = 1 + \frac{C_{\mathrm{LS}}}{C_S}$$

---

## References and Sources

- [Sequential Correlated Level Shifting: A Switched-Capacitor Approach for High-Accuracy Systems](https://ieeexplore.ieee.org/document/6613543/) - SCLS technique
- [An Over-60 dB True Rail-to-Rail Performance Using CLS](https://ieeexplore.ieee.org/abstract/document/4684624/) - Rail-to-rail CLS
- [Correlated level shifting technique](https://ece.osu.edu/media/document/2022-08-30/cc_cls.pdf) - Tutorial slides
- [The effect of correlated level shifting on noise performance](https://ieeexplore.ieee.org/document/6272200) - Noise analysis
- [Look Ahead CLS in Pipelined SAR ADCs](https://ieeexplore.ieee.org/document/9937476/) - High-speed CLS
- [Sequential Correlated Level Shifting - Texas A&M](https://people.engr.tamu.edu/spalermo/docs/2013_sequential_correlated_level_shifting_zhiantabasy_tcas2.pdf) - Detailed paper
- [The CLS as a Gain Enhancement Technique for Comparator Based Integrators](https://www.researchgate.net/publication/272495524_The_Correlated_Level_Shifting_as_a_Gain_Enhancement_Technique_for_Comparator_Based_Integrators) - CBSC application
- [Ping-Pong Operated Inverter-based OTA using CLS](https://ieeexplore.ieee.org/document/9278332/) - Inverter OTA
- [Charge-compensated correlated level shifting for single-stage opamps](https://ietresearch.onlinelibrary.wiley.com/doi/full/10.1049/el.2015.0614) - Charge compensation

---

## Related Topics

See also:
- [Correlated-Double-Sampling.md](Correlated-Double-Sampling.md) - CDS for noise cancellation
- [kTC-Noise-Cancellation.md](kTC-Noise-Cancellation.md) - Reset noise cancellation
- [Floating-Inverter-Amplifier.md](Floating-Inverter-Amplifier.md) - Simple dynamic amplifiers
- [5T-Differential-Amplifier-Analysis.md](5T-Differential-Amplifier-Analysis.md) - Traditional amplifier design
- [Amplifier-Bandwidth-Calculations.md](Amplifier-Bandwidth-Calculations.md) - Settling time analysis
