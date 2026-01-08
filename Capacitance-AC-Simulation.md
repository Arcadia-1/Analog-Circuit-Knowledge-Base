# Extracting Capacitance from AC Simulation

<!--
Input: AC simulation results | Output: capacitance extraction | Position: simulation methodology
⚠️ After any change, update this comment AND relevant .FOLDER.md
-->

Extract capacitance from AC simulation using current-frequency relationship.

According to the definition of capacitance:

$$I = C \frac{dV}{dt} = j\omega C V = j2\pi f C V$$

The imaginary part of current is:

$$\text{Im}(I) = 2\pi f C V$$

If AC voltage $V_\mathrm{ac} = 1$, then the capacitance is:

$$C = \frac{\text{Im}(I)}{2\pi f}$$

**Important:** If $I$ is a vector with x-axis (frequency) and y-axis (current) data, the formula becomes:

$$C = \frac{\text{Im}(I)}{2\pi \cdot x(I)}$$

where $x(I)$ extracts the x-axis values (frequency) from the vector.

## Virtuoso Calculator Expressions

### For capacitor `C0` with port `PLUS`:

```
(imag(IF("/C0/PLUS")) / xval(IF("/C0/PLUS")) / 2 / 3.14159)
```

### For instance `I0` with port `AAAA`:

```
(imag(IF("/I0/AAAA")) / xval(IF("/I0/AAAA")) / 2 / 3.14159)
```

Where:
- `IF()` = current from AC simulation
- `imag()` = imaginary part
- `xval()` = frequency (x-axis value)