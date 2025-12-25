<!--
Input: Basic transistor amplifier theory | Output: Single-stage amplifier parameters reference | Position: Core technical document
⚠️ After any change, update this comment AND README.md
-->
# Single-Transistor Amplifier Configurations

This document analyzes the three fundamental MOSFET amplifier topologies: Common Source (CS), Common Gate (CG), and Common Drain (CD). Analysis includes only intrinsic transconductance $g_{\mathrm{m}}$ and output resistance $r_{\mathrm{o}}$, neglecting body effect ($g_{\mathrm{mb}}$) and other secondary effects.

## Common Source (CS) Amplifier

### Circuit Configuration

Input at gate, output at drain, source at AC ground.

### Voltage Gain

$$\boxed{A_{\mathrm{v,CS}} = -g_{\mathrm{m}} (R_{\mathrm{D}} \| r_{\mathrm{o}})}$$

**Notes:**
- Negative sign indicates **180° phase inversion**
- Maximum gain configuration among the three topologies
- If $R_{\mathrm{D}} \gg r_{\mathrm{o}}$: $A_{\mathrm{v}} \approx -g_{\mathrm{m}} r_{\mathrm{o}}$

### Input Impedance

$$\boxed{Z_{\mathrm{in,CS}} \approx \infty}$$

Gate input presents very high impedance (limited only by gate-source capacitance in practice).

### Output Impedance

$$\boxed{Z_{\mathrm{out,CS}} = R_{\mathrm{D}} \| r_{\mathrm{o}}}$$

**Notes:**
- Looking into drain node with input signal at gate
- If no load resistor $R_{\mathrm{D}}$: $Z_{\mathrm{out}} = r_{\mathrm{o}}$

## Common Gate (CG) Amplifier

### Circuit Configuration

Input at source, output at drain, gate at AC ground.

### Voltage Gain

$$\boxed{A_{\mathrm{v,CG}} = +g_{\mathrm{m}} (R_{\mathrm{D}} \| r_{\mathrm{o}})}$$

**Notes:**
- Positive sign indicates **no phase inversion**
- Same magnitude as CS but opposite sign
- If $R_{\mathrm{D}} \gg r_{\mathrm{o}}$: $A_{\mathrm{v}} \approx g_{\mathrm{m}} r_{\mathrm{o}}$

### Input Impedance

$$\boxed{Z_{\mathrm{in,CG}} = \frac{1}{g_{\mathrm{m}}} \| r_{\mathrm{o}}}$$

For typical cases where $r_{\mathrm{o}} \gg 1/g_{\mathrm{m}}$:

$$Z_{\mathrm{in,CG}} \approx \frac{1}{g_{\mathrm{m}}}$$

**Notes:**
- **Very low input impedance** (typically tens of ohms)
- Useful for current-to-voltage conversion
- Good for wideband applications due to low input impedance

### Output Impedance

$$\boxed{Z_{\mathrm{out,CG}} = R_{\mathrm{D}} \| r_{\mathrm{o}}}$$

Same as CS configuration when looking from drain.

## Common Drain (CD) Amplifier - Source Follower

### Circuit Configuration

Input at gate, output at source, drain at DC supply (AC ground).

### Voltage Gain

$$\boxed{A_{\mathrm{v,CD}} = \frac{g_{\mathrm{m}} (R_{\mathrm{S}} \| r_{\mathrm{o}})}{1 + g_{\mathrm{m}} (R_{\mathrm{S}} \| r_{\mathrm{o}})}}$$

For typical cases where $g_{\mathrm{m}} (R_{\mathrm{S}} \| r_{\mathrm{o}}) \gg 1$:

$$\boxed{A_{\mathrm{v,CD}} \approx 1}$$

**Notes:**
- No phase inversion (in-phase with input)
- Gain always **less than unity** but approaches 1
- Also called **source follower** or **buffer**
- Excellent for impedance transformation

### Input Impedance

$$\boxed{Z_{\mathrm{in,CD}} \approx \infty}$$

Gate input presents very high impedance.

### Output Impedance

$$\boxed{Z_{\mathrm{out,CD}} = \frac{1}{g_{\mathrm{m}}} \| r_{\mathrm{o}}}$$

For typical cases where $r_{\mathrm{o}} \gg 1/g_{\mathrm{m}}$:

$$Z_{\mathrm{out,CD}} \approx \frac{1}{g_{\mathrm{m}}}$$

**Notes:**
- **Very low output impedance** (typically tens of ohms)
- Excellent for driving capacitive loads
- Good for buffering high-impedance nodes

## Summary Comparison Table

| Parameter | CS (Common Source) | CG (Common Gate) | CD (Common Drain) |
|-----------|-------------------|------------------|-------------------|
| **Voltage Gain** | $-g_{\mathrm{m}} (R_{\mathrm{D}} \| r_{\mathrm{o}})$ | $+g_{\mathrm{m}} (R_{\mathrm{D}} \| r_{\mathrm{o}})$ | $\approx 1$ |
| **Phase** | 180° inversion | No inversion | No inversion |
| **Input Z** | Very high ($\infty$) | Very low ($1/g_{\mathrm{m}}$) | Very high ($\infty$) |
| **Output Z** | Medium ($R_{\mathrm{D}} \| r_{\mathrm{o}}$) | Medium ($R_{\mathrm{D}} \| r_{\mathrm{o}}$) | Very low ($1/g_{\mathrm{m}}$) |
| **Primary Use** | Voltage amplification | Current buffer, wideband | Voltage buffer, impedance matching |

## Typical Applications

### Common Source (CS)
- General-purpose voltage amplifier
- Input stage of operational amplifiers
- High-gain applications

### Common Gate (CG)
- Wideband amplifiers (Miller effect elimination)
- Cascode configurations (upper device)
- Current buffers
- RF mixers and upconverters

### Common Drain (CD)
- Output buffer stages
- Level shifters
- Impedance matching networks
- Driving off-chip loads
