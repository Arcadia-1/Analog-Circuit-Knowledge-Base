<!--
Input: reference/five_transistor_amplifier.tex | Output: Mathematical reference for 5T amplifier design | Position: Core technical document
⚠️ After any change, update this comment AND reference/.FOLDER.md
-->
# Analysis of 5-Transistor Differential Amplifier

## Circuit Topology

This is an **active-loaded (current mirror loaded) differential amplifier**, not a fully differential topology.

**Transistor Configuration:**
- **M1, M2**: Differential input pair (NMOS)
- **M3, M4**: Active load current mirror (PMOS)
- **Mtail**: Tail current source (NMOS)

**Node Naming:**
- **Node X**: Drain of Mtail (common source of M1 and M2)
- **Node Y**: Drain of M1 (diode side of current mirror, connects to M3)
- **Output**: Drain of M2/M4 node


## Differential Gain ($A_{\mathrm{dm}}$)

$$\boxed{A_{\mathrm{dm}} = -g_{\mathrm{m1}} (r_{\mathrm{o1}} \| r_{\mathrm{o3}})}$$

## Common Mode Gain ($A_{\mathrm{cm}}$)

$$A_{\mathrm{cm}} = -\frac{g_{\mathrm{m1}}}{1 + 2 g_{\mathrm{m1}} r_{\mathrm{o,tail}}} (r_{\mathrm{o1}} \| r_{\mathrm{o3}})$$

**Engineering approximation** (when $2 g_{\mathrm{m1}} r_{\mathrm{o,tail}} \gg 1$):
$$\boxed{A_{\mathrm{cm}} \approx -\frac{r_{\mathrm{o1}} \| r_{\mathrm{o3}}}{2 r_{\mathrm{o,tail}}}}$$

## Common Mode Rejection Ratio (CMRR)

$$\boxed{CMRR = \left|\frac{A_{\mathrm{dm}}}{A_{\mathrm{cm}}}\right| = 2 g_{\mathrm{m1}} r_{\mathrm{o,tail}}}$$

## Internal Node Gain Analysis

### Node X (Tail Node) Gain: $v_X / v_{\mathrm{in}}$

For **common-mode input** (both inputs at $v_{\mathrm{in}}$), node X voltage is determined by voltage division.

**Derivation:**
- Looking UP from node X: Two parallel paths through (M1+M3) and (M2+M4)
- Each path resistance: $r_{\mathrm{o1}} + r_{\mathrm{o3}}$ (assuming matched devices)
- Parallel combination: $(r_{\mathrm{o1}} + r_{\mathrm{o3}})/2$
- Looking DOWN from node X: $r_{\mathrm{o,tail}}$

When $r_{\mathrm{o,tail}} \gg (r_{\mathrm{o1}} + r_{\mathrm{o3}})/2$, the tail current source acts as AC ground, and node X tracks the input through the upper voltage divider:

The voltage drop from $v_{\mathrm{in}}$ to node X occurs across the M1 channel resistance, while the drop from node X to ground occurs across both $r_{\mathrm{o1}}$ and $r_{\mathrm{o3}}$. The voltage at X is:

$$\boxed{\frac{v_X}{v_{\mathrm{in}}} = \frac{r_{\mathrm{o3}}}{2(r_{\mathrm{o3}} + r_{\mathrm{o1}})}}$$

This is approximately $\approx 1/4$ for matched devices where $r_{\mathrm{o1}} \approx r_{\mathrm{o3}}$.

### Node Y (Mirror Input) Gain: $v_Y / v_{\mathrm{in}}$

Node Y is the drain of M1, which connects to the diode side of the current mirror.

$$\boxed{\frac{v_Y}{v_{\mathrm{in}}} = -\frac{g_{\mathrm{m1}} r_{\mathrm{o1}}}{2 g_{\mathrm{m3}} (r_{\mathrm{o1}} \| r_{\mathrm{o3}})}}$$

**Note:** These internal node movements are critical for accurate common-mode and PSRR analysis.

## Power Supply Rejection Ratio (PSRR)

### Positive Supply Side (VDD noise)

Current mirror transistors M3, M4 act as diode-connected devices with resistance $R_{\mathrm{up}} \approx 1/g_{\mathrm{m3}}$.

Looking down from output through M2: $R_{\mathrm{down}} \approx g_{\mathrm{m2}} r_{\mathrm{o2}} r_{\mathrm{o,tail}}$ (source degeneration).

Voltage divider: Since $R_{\mathrm{down}} \gg R_{\mathrm{up}}$:

$$\boxed{\frac{v_{\mathrm{out}}}{v_{\mathrm{VDD}}} \approx \frac{R_{\mathrm{down}}}{R_{\mathrm{up}} + R_{\mathrm{down}}} \approx 1}$$

**Poor positive PSRR:**
$$\boxed{PSRR^+ = \left|\frac{A_{\mathrm{dm}}}{v_{\mathrm{out}}/v_{\mathrm{VDD}}}\right| \approx |A_{\mathrm{dm}}| \approx g_{\mathrm{m1}} (r_{\mathrm{o1}} \| r_{\mathrm{o3}})}$$

This is typically 0-20 dB, very poor. VDD noise couples directly to output.

### Negative Supply Side (VSS noise)

$$\frac{v_{\mathrm{out}}}{v_{\mathrm{VSS}}} = A_{\mathrm{cm}} \approx -\frac{r_{\mathrm{o1}} \| r_{\mathrm{o3}}}{2 r_{\mathrm{o,tail}}}$$

The negative PSRR is:
$$\boxed{PSRR^- = \left|\frac{A_{\mathrm{dm}}}{v_{\mathrm{out}}/v_{\mathrm{VSS}}}\right| = 2 g_{\mathrm{m1}} r_{\mathrm{o,tail}}}$$

## Noise Analysis

### Thermal Noise

Drain current noise of each input transistor:
$$\overline{i_{\mathrm{n,M1}}^2} = 4kT\gamma g_{\mathrm{m1}} \Delta f$$

Input-referred voltage noise (both M1 and M2):
$$\overline{v_{\mathrm{n,in,M1M2}}^2} = 8kT\gamma \frac{1}{g_{\mathrm{m1}}} \Delta f$$

Drain current noise of each load transistor:
$$\overline{i_{\mathrm{n,M3}}^2} = \overline{i_{\mathrm{n,M4}}^2} = 4kT\gamma g_{\mathrm{m3}} \Delta f$$

Input-referred voltage noise (both M3 and M4 contribute equally):
$$\overline{v_{\mathrm{n,in,M3M4}}^2} = 8kT\gamma \frac{g_{\mathrm{m3}}}{g_{\mathrm{m1}}^2} \Delta f$$

**Total input-referred thermal noise:**
$$\boxed{\overline{v_{\mathrm{n,in}}^2} =  \frac{8kT\gamma}{g_{\mathrm{m1}}} \left(1 + \frac{g_{\mathrm{m3}}}{g_{\mathrm{m1}}}\right) \Delta f}$$

### Flicker Noise (1/f Noise)

Input-referred flicker noise from M1 and M2:
$$\overline{v_{\mathrm{n,flicker,M1M2}}^2} = 2 \cdot \frac{K_1}{W_1 L_1 C_{\mathrm{ox}} f} \Delta f$$

Input-referred flicker noise from M3 and M4:
$$\overline{v_{\mathrm{n,flicker,M3M4}}^2} = 2 \cdot \frac{K_3 g_{\mathrm{m3}}^2}{W_3 L_3 C_{\mathrm{ox}} f \cdot g_{\mathrm{m1}}^2} \Delta f$$

**Total noise spectral density:**
$$\boxed{S_{\mathrm{v,n,total}} = 8kT\gamma \frac{1}{g_{\mathrm{m1}}} \left(1 + \frac{g_{\mathrm{m3}}}{g_{\mathrm{m1}}}\right) + \frac{2K_1}{W_1 L_1 C_{\mathrm{ox}} f} + \frac{2K_3 g_{\mathrm{m3}}^2}{W_3 L_3 C_{\mathrm{ox}} f \cdot g_{\mathrm{m1}}^2}}$$

## Poles and Zeros

### Dominant Pole ($\omega_{P1}$)

**Location:** Output node

The dominant pole determines the -3dB bandwidth:
$$\boxed{\omega_{P1} = \frac{1}{R_{\mathrm{out}} C_L}}$$

where $R_{\mathrm{out}} = r_{\mathrm{o1}} \| r_{\mathrm{o3}}$ and $C_L$ is the load capacitance.

### Non-Dominant Pole ($\omega_{P2}$) - Mirror Pole

**Location:** Current mirror node (gate of M3 and M4)

The mirror pole affects phase margin and stability:
$$\boxed{\omega_{P2} = \frac{g_{\mathrm{m3}}}{C_X}}$$

where $C_X$ is the parasitic capacitance at the mirror node:
$$C_X \approx C_{\mathrm{gs3}} + C_{\mathrm{gs4}} + C_{\mathrm{db3}}$$

### Left-Half-Plane Zero ($\omega_Z$)

The zero arises from asymmetric signal paths to the output:

- **Path 1 (direct):** $V_{\mathrm{in}-} \rightarrow$ M2 $\rightarrow V_{\mathrm{out}}$ (fast path)
- **Path 2 (mirror):** $V_{\mathrm{in}+} \rightarrow$ M1 $\rightarrow$ M3 $\rightarrow$ M4 $\rightarrow V_{\mathrm{out}}$ (slow path)

The zero angular frequency:
$$\boxed{\omega_Z \approx 2 \omega_{P2} = \frac{2g_{\mathrm{m3}}}{C_X}}$$

This LHP zero slightly improves phase at high frequencies but may affect settling time.

### Transfer Function

The complete transfer function:
$$\boxed{A(s) = A_{\mathrm{dm}} \cdot \frac{1 - \frac{s}{\omega_Z}}{(1 + \frac{s}{\omega_{P1}})(1 + \frac{s}{\omega_{P2}})}}$$
