# Degenerated Resistor - Charging Time Analysis

## Circuit Configurations

**Case 1: No Degeneration**: A resistor $R_\text{L}$ and a transistor operating as a switch.

**Case 2: With Degeneration**: A source degenerated resistor $R_\text{s}$ and a transistor operating in saturation.

## Design Parameters

- $V_\text{DD} = 0.8$ $\text{V}$
- $V_\text{th} = 0.26$ $\text{V}$ (source degeneration case)
- $C = 1$ $\text{pF}$

To ensure a fair comparison, both cases are designed to have the same **charging time to $V_\text{DD}/2$**.

---

## Case 1: RC Charging (No Degeneration)

The transistor operates as a near-ideal switch ($R_\text{on}$ is very small). The capacitor voltage is:

$$V_C(t) = V_\text{DD}\left(1 - e^{-t/R_\text{L}C}\right)$$

The time to reach $V_\text{DD}/2$:

$$\frac{V_\text{DD}}{2} = V_\text{DD}\left(1 - e^{-\Delta t/R_\text{L}C}\right)$$

$$\Delta t = R_\text{L}C \ln(2) \approx 0.693 \, R_\text{L}C$$

The average charging current to $V_\text{DD}/2$ is:

$$I_{\text{avg}} = \frac{\Delta Q}{\Delta t} = \frac{C \cdot \frac{V_\text{DD}}{2}}{0.693 \, R_\text{L} C} = \frac{0.5}{0.693} \cdot \frac{V_\text{DD}}{R_\text{L}} \approx 0.721 \frac{V_\text{DD}}{R_\text{L}}$$

---

## Case 2: Constant Current with Source Degeneration

The transistor operates in saturation with constant current:

$$I = G_\text{m} \Delta V_\text{G}$$

$$G_\text{m} = \frac{g_m}{1 + g_m R_s}, \quad \Delta V_\text{G} = V_\text{DD} - V_\text{th}$$

$$I = \frac{g_m}{1 + g_m R_s} (V_\text{DD} - V_\text{th}) = \frac{V_\text{DD} - V_\text{th}}{R_\text{s} + \frac{1}{g_m}}$$

The capacitor voltage increases linearly:

$$V_C(t) = \frac{I \cdot t}{C}$$

The time to reach $V_\text{DD}/2$:

$$\frac{V_\text{DD}}{2} = \frac{I \cdot \Delta t}{C}$$

$$\Delta t = \frac{V_\text{DD} \cdot C}{2I} = \frac{V_\text{DD} \cdot C}{2} \cdot \frac{R_\text{s} + \frac{1}{g_m}}{V_\text{DD} - V_\text{th}}$$

---

## Equivalence Condition

For matched charging time to $V_\text{DD}/2$:

$$0.693 \, R_\text{L} \, C = \frac{V_\text{DD} \cdot C}{2} \cdot \frac{R_\text{s} + \frac{1}{g_m}}{V_\text{DD} - V_\text{th}}$$

Simplifying:

$$R_\text{L} = \frac{1}{2\times0.693} \cdot \frac{V_\text{DD}}{V_\text{DD} - V_\text{th}} \cdot \left(R_\text{s} + \frac{1}{g_m}\right)$$

**Numerical example:**

$V_\text{DD} = 0.8$ $\text{V}$, $V_\text{th} = 0.26$ $\text{V}$, so

$$\frac{V_\text{DD}}{V_\text{DD} - V_\text{th}} = \frac{0.8}{0.54} \approx 1.48$$

$$\boxed{R_\text{L} = \frac{1}{2\times0.693} \times 1.48 \times \left(R_\text{s} + \frac{1}{g_m}\right) = 1.0678 \times \left(R_\text{s} + \frac{1}{g_m}\right)}$$

**Double-directonal mapping tables:**

<div align="center">

**Table 1: Fixed $R_\text{s} = 150$ Ω**

| $g_m$ | $\frac{1}{g_m}$ | $R_\text{s} + \frac{1}{g_m}$ | Required $R_\text{L}$ |
|:-----:|:---------------:|:----------------------------:|:---------------------:|
| $10$ $\text{mS}$ | $100$ $\Omega$ | $250$ $\Omega$ | $268$ $\Omega$ |
| $20$ $\text{mS}$ | $50$ $\Omega$ | $200$ $\Omega$ | $214$ $\Omega$ |
| $30$ $\text{mS}$ | $33$ $\Omega$ | $183$ $\Omega$ | $196$ $\Omega$ |

</div>

<div align="center">

**Table 2: Fixed $R_\text{L} = 200$ Ω**

| $g_m$ | $\frac{1}{g_m}$ | Required $R_\text{s}$ | $R_\text{s} + \frac{1}{g_m}$ |
|:-----:|:---------------:|:---------------------:|:----------------------------:|
| $10$ $\text{mS}$ | $100$ $\Omega$ | $87$ $\Omega$ | $187$ $\Omega$ |
| $20$ $\text{mS}$ | $50$ $\Omega$ | $137$ $\Omega$ | $187$ $\Omega$ |
| $30$ $\text{mS}$ | $33$ $\Omega$ | $154$ $\Omega$ | $187$ $\Omega$ |

</div>

**Result:** Source degeneration reduces the resistor value requirement for the same charging speed.

---

## Effective Transconductance

$$1 + g_m R_s = 1 + 4.2 = 5.2$$

$$g_{m,\text{eff}} = \frac{g_m}{1 + g_m R_s} = \frac{0.028}{5.2} = 5.38 \text{ mS}$$

---

## Output Resistance

The output resistance is boosted by the degeneration:

$$R_{\text{out}} = r_{\text{o}} \times (1 + g_m R_s)$$

<div align="center">

| $r_{\text{o}}$ | $R_{\text{out}}$ |
|:----------------:|:----------------:|
| $500$ $\Omega$ | $2.6$ $\text{k}\Omega$ |
| $1$ $\text{k}\Omega$ | $5.2$ $\text{k}\Omega$ |
| $2$ $\text{k}\Omega$ | $10.4$ $\text{k}\Omega$ |

</div>
