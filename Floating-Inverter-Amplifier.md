# Floating Inverter Amplifier (FIA)

<!--
Input: Internet research, technical papers on FIA topology
Output: Basic formulas and design insights for floating inverter amplifier
Position: Energy-efficient amplifier for dynamic applications
⚠️ After any change, update this comment AND .PROJECT.md
-->

## Overview

**Floating Inverter Amplifier (FIA)** is a dynamic amplifier topology that uses CMOS inverters powered by a **reservoir capacitor (C_RES)** instead of a fixed power supply. It was initially proposed as a preamplifier for comparators and has found rapid application in integrators of discrete-time delta-sigma modulators (DTDSMs).

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

$$I_{\mathrm{out,positive}} = I_{\mathrm{out,negative}}$$

$$\boxed{V_{\mathrm{CM,out}} = \mathrm{constant}}$$

Output common-mode voltage preserved (current loop constraint).

---

## Gain

$$\boxed{A_V = g_m \cdot R_o}$$

$$\boxed{g_{m,\mathrm{total}} = g_{m,n} + g_{m,p}}$$

$$g_{m,n} = \mu_n C_{\mathrm{ox}} \frac{W}{L}_n (V_{\mathrm{GS},n} - V_{\mathrm{TH},n})$$

$$g_{m,p} = \mu_p C_{\mathrm{ox}} \frac{W}{L}_p (|V_{\mathrm{SG},p}| - |V_{\mathrm{TH},p}|)$$

$$\boxed{R_o = r_{o,n} \| r_{o,p} = \frac{1}{g_{\mathrm{ds},n} + g_{\mathrm{ds},p}}}$$

**Basic FIA:** $A_V \approx 10$ (20 dB, 28nm CMOS)

**Enhanced FIA:** $A_V > 90$ dB (with cross-coupled body biasing + cascoding)

---

## Reservoir Capacitor

$$\boxed{\Delta V_{\mathrm{RES}} = \frac{Q_{\mathrm{transferred}}}{C_{\mathrm{RES}}} = \frac{C_L \times \Delta V_{\mathrm{out}}}{C_{\mathrm{RES}}}}$$

$$\boxed{C_{\mathrm{RES}} \geq 10 \times C_L}$$

Minimize voltage droop during amplification.

---

## Energy & Power

$$\boxed{E = C_{\mathrm{RES}} \times V_{\mathrm{DD}}^2 \times \eta}$$

$$\boxed{P_{\mathrm{avg}} = f_{\mathrm{clk}} \times C_{\mathrm{RES}} \times V_{\mathrm{DD}}^2 \times \eta}$$

where $\eta$ = charge transfer efficiency (0.7-0.9), $f_{\mathrm{clk}}$ = clock frequency.

---

## Settling Time

$$\boxed{t_{\mathrm{settle}} \approx \frac{C_L}{g_m} \times \ln\left(\frac{1}{\varepsilon}\right)}$$

where $\varepsilon$ = settling accuracy.

---

## Gain Enhancement

**Cross-Coupled Body Biasing (CCBB):**

$$\boxed{g_{m,\mathrm{eff}} = g_m + g_{mb}}$$

where $g_{mb} \approx \chi \times g_m$ ($\chi \approx 0.2$-$0.3$). Gain enhancement: 20-30 dB.

**Cascode:**

$$\boxed{R_{\mathrm{out,cascode}} = g_{m,\mathrm{cascode}} \times r_{o,\mathrm{cascode}} \times r_{o,\mathrm{main}}}$$

Gain enhancement: 20-40 dB.

**Multi-Stage:**

$$\boxed{A_{\mathrm{total}} = A_1 \times A_2 \times \ldots \times A_N}$$

Example: 3-stage → 60 dB, with enhancements → >90 dB.

---

## Common-Mode

$$\boxed{\frac{\partial V_{\mathrm{CM,out}}}{\partial V_{\mathrm{CM,in}}} \approx 0}$$

$$\boxed{V_{\mathrm{CM,out}} = V_{\mathrm{reset}}}$$

CM voltage set during reset phase, independent of input CM level.

---

## Noise

$$\boxed{V_{n,\mathrm{in}}^2 = \frac{16kT\gamma}{3g_{m,\mathrm{total}}}}$$

$$\boxed{V_{n,\mathrm{RES}}^2 = \frac{kT}{C_{\mathrm{RES}}}}$$

where $\gamma \approx 2/3$ (long-channel), $g_{m,\mathrm{total}} = g_{m,n} + g_{m,p}$.

Reservoir noise does not directly couple to output (floating supply isolation).

$$\boxed{V_{n,\mathrm{total}}^2 \approx \frac{kT}{C_s} + \frac{V_{n,\mathrm{FIA}}^2}{A^2}}$$

---

## Switched-Capacitor Application

$$\boxed{Q_{\mathrm{in}} = Q_{\mathrm{out}}}$$

$$C_S \times V_{\mathrm{in}} = C_F \times V_{\mathrm{out}}$$

$$\boxed{\frac{V_{\mathrm{out}}}{V_{\mathrm{in}}} = \frac{C_S / C_F}{1 + 1/A_{\mathrm{FIA}}}}$$

Ideal: $V_{\mathrm{out}}/V_{\mathrm{in}} = C_S/C_F$

---

## Design Equations

**Inverter Sizing:**

$$\boxed{\frac{(W/L)_p}{(W/L)_n} = \frac{\mu_n}{\mu_p} \approx 2.5\text{-}3}$$

Typical (28nm): $(W/L)_n = 2$-$10$, $(W/L)_p = 5$-$25$

**Bandwidth:**

$$\boxed{GBW = A_V \times BW = \frac{g_m}{2\pi C_L}}$$

---

## Performance Comparison

| Criterion | FIA | Ring Amp | Op-Amp | FCT |
|-----------|-----|----------|--------|-----|
| **Gain** | 20 dB (basic)<br>90 dB (enhanced) | 20-40 dB | 60-120 dB | Medium-High |
| **Power** | Very Low (dynamic) | Medium | Medium-High (static) | Very Low |
| **Speed** | High | High | Medium | High |
| **Noise** | Medium | Medium | Low-Medium | Low |
| **CM Sensitivity** | Excellent | Medium | Medium (60-90 dB CMRR) | Excellent |
| **Complexity** | Low | Medium | High | Low |
| **Area** | Small | Medium | Medium-Large | Small |

