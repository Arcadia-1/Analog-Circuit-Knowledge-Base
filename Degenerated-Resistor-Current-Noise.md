# Degenerated Resistor - Current Noise Analysis

## Case 1: No Degeneration

### Current Noise Analysis
Only the resistor contributes to the output noise, as the transistor is an ideal switch.

**Output current noise PSD:**

$$\boxed{S_{i,R_\text{L} \to \text{out}} = \frac{4kT}{R_\text{L}} \quad [\text{A}^2/\text{Hz}]}$$

---

## Case 2: With Degeneration

### Current Noise Analysis

**Transistor noise contribution:**

$$S_{i,M \to \text{out}} = \frac{4kT\gamma }{g_m} \cdot \left(\frac{g_m}{1 + g_m R_s}\right)^2 \quad [\text{A}^2/\text{Hz}]$$

**Resistor noise contribution:**

$$S_{i,Rs \to \text{out}} =  4kTR_s \cdot \left(\frac{g_m}{1 + g_m R_s}\right)^2 \quad [\text{A}^2/\text{Hz}]$$

**Sanity check:**
- If $R_s \to 0$, then $S_{i,Rs \to \text{out}} \to 0$ and $S_{i,M \to \text{out}} \to 4kT\gamma g_m$ which is the standard MOSFET noise without degeneration.

- If the source degeneration is very strong such that $g_m R_s \gg 1$, then $S_{i,M \to \text{out}} \to 0$ and $S_{i,Rs \to \text{out}} \to \frac{4kT}{R_s}$, which matches the noise of a resistor $R_s$ directly connected to the output, and the transistor noise is negligible.

**Total output current noise PSD:**

$$S_{i,\text{out}} = S_{i,M \to \text{out}} + S_{i,Rs \to \text{out}}$$

$$\boxed{S_{i,\text{out}} = \frac{4kT g_m}{(1 + g_m R_s)^2} \cdot \left(\gamma + g_m R_s\right) \quad [\text{A}^2/\text{Hz}]}$$

where $\gamma$ is the transistor thermal noise coefficient (typically $\gamma \approx 2/3$ for long-channel, $\gamma \approx 1.2$ for short-channel devices).

**Noise contribution ratio:**

$$\boxed{ratio=\frac{S_{i,Rs \to \text{out}}}{S_{i,M \to \text{out}}} = \frac{g_m R_s}{\gamma}}$$

---

## Current Noise Comparison

**Case 1 (No Degeneration):**

$$\boxed{S_{i,\text{out, case1}} = \frac{4kT}{R_\text{L}} \quad [\text{A}^2/\text{Hz}]}$$

**Case 2 (With Degeneration):**

$$\boxed{S_{i,\text{out, case2}} = \frac{4kT g_m}{(1 + g_m R_s)^2} \cdot \left(\gamma + g_m R_s\right) \quad [\text{A}^2/\text{Hz}]}$$

**Current noise ratio:**

$$\boxed{\text{Ratio} = \frac{S_{i,\text{out, case2}}}{S_{i,\text{out, case1}}} = \frac{g_m R_L}{(1 + g_m R_s)^2} \cdot \left(\gamma + g_m R_s\right)}$$

**Simplified form when $g_m R_s \gg \gamma$:**

$$\boxed{\text{Ratio} \approx \frac{R_L}{\frac{1}{g_m} + R_s}}$$

**Conclusion:**
If $\frac{1}{g_m} + R_s = R_L$, then the current noise PSDs of both cases are equal. This indicates that with appropriate source degeneration, the noise performance can be matched to that of a simple resistor load.