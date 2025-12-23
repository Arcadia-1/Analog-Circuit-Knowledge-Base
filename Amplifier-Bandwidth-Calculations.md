<!--
Input: figures/bandwidth_comparison.png, code/plot_bandwidth_comparison.py | Output: Bandwidth theory and GBW tradeoff guide | Position: Core technical document
⚠️ After any change, update this comment AND figures/.FOLDER.md and code/.FOLDER.md
-->
# Amplifier Bandwidth Calculations

## Gain-Bandwidth Product (GBW)

For a single-pole amplifier:

$$\boxed{GBW = A_v \cdot BW = A_0 \cdot \omega_{P1}}$$

where $A_v$ is closed-loop gain, $BW$ is -3dB bandwidth, $A_0$ is DC open-loop gain, and $\omega_{P1}$ is the dominant pole.

The unity-gain bandwidth:

$$\boxed{\omega_u = GBW}$$

## Closed-Loop Bandwidth

For negative feedback with feedback factor $\beta$:

$$A_{CL} = \frac{A_0}{1 + A_0 \beta} \approx \frac{1}{\beta} \quad \text{(when } A_0 \beta \gg 1\text{)}$$

$$\boxed{BW_{CL} = BW_{OL} \cdot (1 + A_0 \beta) \approx \frac{GBW}{A_{CL}}}$$

**Key Tradeoff:** Reducing gain increases bandwidth, while GBW remains constant.

## Bandwidth Comparison

![Bandwidth Comparison](figures/bandwidth_comparison.png)

The figure shows two cases with the same GBW but different open-loop gains:
- **Case 1 (60 dB)**: Lower open-loop gain, higher bandwidth at same closed-loop gain
- **Case 2 (80 dB)**: Higher open-loop gain, higher loop gain → better PSRR and distortion

All curves intersect at unity-gain frequency (GBW), demonstrating gain-bandwidth conservation.

## For 5T Differential Amplifier

$$\boxed{\omega_u = \frac{g_{m1}}{C_L}}$$

## Multi-Stage Bandwidth

For cascaded stages:

$$\frac{1}{BW_{total}^2} = \frac{1}{BW_1^2} + \frac{1}{BW_2^2} + \frac{1}{BW_3^2} + \ldots$$

For $n$ identical stages:

$$BW_{total} = BW_{stage} \cdot \sqrt{2^{1/n} - 1}$$
