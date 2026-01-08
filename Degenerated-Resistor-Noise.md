# Degenerated Resistor Noise Analysis

## Case 1: No Degeneration

### Noise Analysis
Only the resistor contributes to the output noise, as the transistor is an ideal switch.

**Output current noise PSD:**

$$\boxed{S_{i,R_\text{L} \to \text{out}} = \frac{4kT}{R_\text{L}} \quad [\text{A}^2/\text{Hz}]}$$

**Output voltage noise PSD:**

$$Z_{out}(\omega) = \frac{1}{\frac{1}{R_L} + j\omega C} = \frac{R_L}{1 + j\omega R_L C}$$


$$S_{v,\text{out}}(f) = S_{i,R_\text{L}} \cdot |Z_{out}(2\pi f)|^2 = \frac{4kT}{R_L} \cdot \frac{R_L^2}{1 + (2\pi f R_L C)^2}$$

$$\boxed{S_{v,\text{out}}(f) = 4kT R_L \cdot \frac{1}{1 + (2\pi f R_L C)^2} \quad [\text{V}^2/\text{Hz}]}$$

Sanity check:
- In the low frequency limit ($f \to 0$):
$$\boxed{S_{v,\text{out}}(f) = 4kT R_L \quad [\text{V}^2/\text{Hz}]}$$

This is the standard thermal noise of a resistor.

- In the high frequency limit ($f \to \infty$):
$$\boxed{S_{v,\text{out}}(f) = \frac{4kT}{R_L} \cdot \frac{1}{(2\pi f C)^2} \quad [\text{V}^2/\text{Hz}]}$$

This shows the expected $1/f^2$ roll-off due to the capacitive load.

---

## Case 2: With Degeneration

### Noise Analysis

**Transistor noise contribution:**

$$S_{i,M \to \text{out}} = \frac{4kT\gamma }{g_m} \cdot \left(\frac{g_m}{1 + g_m R_s}\right)^2 \quad [\text{A}^2/\text{Hz}]$$

**Resistor noise contribution:**

$$S_{i,Rs \to \text{out}} =  4kTR_s \cdot \left(\frac{g_m}{1 + g_m R_s}\right)^2 \quad [\text{A}^2/\text{Hz}]$$

Sanity check:
- If $R_s \to 0$, then $S_{i,Rs \to \text{out}} \to 0$ and $S_{i,M \to \text{out}} \to 4kT\gamma g_m$ which is the standard MOSFET noise without degeneration.

- If the source degeneration is very strong such that $g_m R_s \gg 1$, then $S_{i,M \to \text{out}} \to 0$ and $S_{i,Rs \to \text{out}} \to \frac{4kT}{R_s}$, which matches the noise of a resistor $R_s$ directly connected to the output, and the transistor noise is negeligible.

**Total output current noise PSD:**

$$S_{i,\text{out}} = S_{i,M \to \text{out}} + S_{i,Rs \to \text{out}}$$


$$\boxed{S_{i,\text{out}} = \frac{4kT g_m}{(1 + g_m R_s)^2} \cdot \left(\gamma + g_m R_s\right) \quad [\text{A}^2/\text{Hz}]}$$


The ratio of both noise sources is:

$$\boxed{ratio=\frac{S_{i,Rs \to \text{out}}}{S_{i,M \to \text{out}}} = \frac{g_m R_s}{\gamma}}$$



**Output voltage noise PSD:**

The output impedance includes both the output resistance and capacitance:

$$Z_{out}(\omega) = \frac{1}{\frac{1}{R_{out}} + j\omega C} = \frac{R_{out}}{1 + j\omega R_{out} C}$$

where $R_{out} = r_o(1 + g_m R_s)$ is the degeneration-boosted output resistance.

The output voltage noise PSD is:

$$S_{v,\text{out}}(f) = S_{i,\text{out}} \cdot |Z_{out}(2\pi f)|^2 = S_{i,\text{out}} \cdot \frac{R_{out}^2}{1 + (2\pi f R_{out} C)^2}$$

$$S_{v,\text{out}}(f) = \frac{4kT g_m}{(1 + g_m R_s)^2} \cdot \left(\gamma + g_m R_s\right) \cdot \frac{R_{out}^2}{1 + (2\pi f R_{out} C)^2} \quad [\text{V}^2/\text{Hz}]$$

Substituting $R_{out} = r_o(1 + g_m R_s)$:

$$\boxed{S_{v,\text{out}}(f) = 4kT g_m r_o^2 \cdot (\gamma + g_m R_s) \cdot \frac{1}{1 + [2\pi f \cdot r_o(1 + g_m R_s) \cdot C]^2} \quad [\text{V}^2/\text{Hz}]} $$

Sanity check:
- If $R_s \to 0$, then 

$$S_{v,\text{out}}(f) = 4kT \gamma g_m \cdot \frac{r_o^2 }{1 + (2\pi f r_o C)^2}$$

this matches the standard MOSFET noise without degeneration.

- In the low frequency limit ($f \to 0$):

$$\boxed{S_{v,\text{out}}(f) = 4kT g_m r_o^2 \cdot (\gamma + g_m R_s) \quad [\text{V}^2/\text{Hz}]}$$

It seems very large because of the $r_o^2$ term, but the bandwidth is very small due to the large $R_{out}$, so the integrated noise voltage remains reasonable. Comparing to the no-degeneration case, the bandwidth is reduced by a factor of $(1 + g_m R_s)$, which helps reduce the integrated noise.

- In the high frequency limit ($f \to \infty$):

$$\boxed{S_{v,\text{out}}(f) = \frac{4kT g_m \cdot (\gamma + g_m R_s)}{(1 + g_m R_s)^2} \cdot \frac{1}{(2\pi f C)^2} \quad [\text{V}^2/\text{Hz}]} $$

Since $\gamma$ is near 1, then:

$$\boxed{S_{v,\text{out}}(f) \approx \frac{4kT g_m}{(1 + g_m R_s)} \cdot \frac{1}{(2\pi f C)^2} \quad [\text{V}^2/\text{Hz}]}$$

If the degeneration is strong such that $g_m R_s \gg 1$, then:

$$\boxed{S_{v,\text{out}}(f) \approx \frac{4kT }{R_s} \cdot \frac{1}{(2\pi f C)^2} \quad [\text{V}^2/\text{Hz}]}$$

This matches the noise of a resistor $R_s$ directly connected to the output, as expected.

---

## Noise Comparison

**Case 1 (No Degeneration):**

$$\boxed{S_{v,\text{out, case1}}(f) = 4kT R_L \cdot \frac{1}{1 + (2\pi f R_L C)^2} \quad [\text{V}^2/\text{Hz}]}$$

**Case 2 (With Degeneration):**

$$\boxed{S_{v,\text{out, case2}}(f) = 4kT g_m r_o^2 \cdot (\gamma + g_m R_s) \cdot \frac{1}{1 + [2\pi f \cdot r_o(1 + g_m R_s) \cdot C]^2} \quad [\text{V}^2/\text{Hz}]} $$


**Noise ratio:**

$$\boxed{\text{Noise Ratio} = \frac{S_{v,\text{out, case2}}(f)}{S_{v,\text{out, case1}}(f)} = \frac{g_m r_{o}^2 \cdot (\gamma + g_m R_s)}{R_L} \cdot \frac{1 + (2\pi f R_L C)^2}{1 + [2\pi f \cdot r_o(1 + g_m R_s) \cdot C]^2}}$$

**High frequency behavior** ($f \gg \frac{1}{2\pi R_{out} C}$ and $f \gg \frac{1}{2\pi R_L C}$):

In this regime, both cases exhibit $1/f^2$ behavior:

$$S_{v,\text{out, case1}}(f) \approx \frac{4kT}{R_L} \cdot \frac{1}{(2\pi f C)^2}$$

$$S_{v,\text{out, case2}}(f) \approx \frac{4kT g_m \cdot (\gamma + g_m R_s)}{(1 + g_m R_s)^2} \cdot \frac{1}{(2\pi f C)^2} \quad [\text{V}^2/\text{Hz}]$$

$$\boxed{\text{High-freq Ratio} = \frac{g_m (\gamma + g_m R_s)}{R_L (1 + g_m R_s)^2}}$$

---

## Numerical Example

For $R_s = 150$ $\Omega$, noise contribution breakdown using the correct formula $ratio = \frac{g_m R_s}{\gamma}$:

**Table 1: Short-channel transistor (γ = 1.2)**

<div align="center">

| $g_m$ | $g_m R_s$ | Noise ratio | Resistor Noise | Transistor Noise |
|:-----:|:---------:|:-----------:|:--------------:|:----------------:|
| $10$ $\text{mS}$ | $1.5$ | $1.25$ | $55.6\%$ | $44.4\%$ |
| $20$ $\text{mS}$ | $3.0$ | $2.5$ | $71.4\%$ | $28.6\%$ |
| $28$ $\text{mS}$ | $4.2$ | $3.5$ | $77.8\%$ | $22.2\%$ |

</div>

**Table 2: Ultra-short-channel transistor (γ = 1.5)**

<div align="center">

| $g_m$ | $g_m R_s$ | Noise ratio | Resistor Noise | Transistor Noise |
|:-----:|:---------:|:-----------:|:--------------:|:----------------:|
| $10$ $\text{mS}$ | $1.5$ | $1.0$ | $50.0\%$ | $50.0\%$ |
| $20$ $\text{mS}$ | $3.0$ | $2.0$ | $66.7\%$ | $33.3\%$ |
| $28$ $\text{mS}$ | $4.2$ | $2.8$ | $73.7\%$ | $26.3\%$ |

</div>
