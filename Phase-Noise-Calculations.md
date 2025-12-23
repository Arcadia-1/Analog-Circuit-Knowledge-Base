<!--
Input: reference/phase_noise_calculation.tex | Output: Phase noise and amplitude noise conversion reference | Position: Core technical document
⚠️ After any change, update this comment AND reference/.FOLDER.md
-->
# Phase Noise and Amplitude Noise Conversion

## Phase Noise to Amplitude Noise

### Definitions

- **Phase noise (SSB)**: $L = P_n/P_c$ (linear), or $\mathcal{L}(f) = 10\log_{10}(L)$ [dBc/Hz]
- **Phase PSD**: $S_\phi(f) = 2 \times L(f)$ [rad²/Hz]

### Conversion Steps

$$S_\phi(f) = 2 \times 10^{\mathcal{L}(f)/10} \quad \text{[rad}^2\text{/Hz]}$$

$$S_t(f) = S_\phi(f) \times \left(\frac{1}{2\pi f_0}\right)^2 \quad \text{[s}^2\text{/Hz]}$$

$$S_v(f) = S_t(f) \times (SR)^2 \quad \text{[V}^2\text{/Hz]}$$

where:
- $f_0$ is the operating frequency [Hz]
- $SR$ is the measured slew rate at zero-crossing [V/s]

### Direct Formula

$$\boxed{S_v(f) = 2 \times 10^{\mathcal{L}(f)/10} \times \left(\frac{SR}{2\pi f_0}\right)^2 \quad \text{[V}^2\text{/Hz]}}$$

### Example

**Given:** $f_0 = 500$ MHz, $SR = 20$ GV/s

**Case 1:** $\mathcal{L}(10\text{ MHz}) = -180$ dBc/Hz

$$S_v = 2 \times 10^{-18} \times \left(\frac{20 \times 10^9}{2\pi \times 500 \times 10^6}\right)^2 = 8.1 \times 10^{-17} \text{ V}^2\text{/Hz}$$

$$v_{\text{rms}} = \sqrt{S_v} = 9.0 \text{ nV/}\sqrt{\text{Hz}}$$

**Case 2:** $\mathcal{L}(10\text{ MHz}) = -170$ dBc/Hz

$$S_v = 2 \times 10^{-17} \times \left(\frac{20 \times 10^9}{2\pi \times 500 \times 10^6}\right)^2 = 8.1 \times 10^{-16} \text{ V}^2\text{/Hz}$$

$$v_{\text{rms}} = \sqrt{S_v} = 28.5 \text{ nV/}\sqrt{\text{Hz}}$$

---

## Amplitude Noise to Phase Noise

### Definitions

- **Voltage noise PSD**: $S_v(f)$ [V²/Hz]
- **Measured slew rate**: $SR$ [V/s]
- **Carrier frequency**: $f_0$ [Hz]

### Conversion Steps

$$S_t(f) = \frac{S_v(f)}{(SR)^2} \quad \text{[s}^2\text{/Hz]}$$

$$S_\phi(f) = S_t(f) \times (2\pi f_0)^2 = \frac{S_v(f) \times (2\pi f_0)^2}{(SR)^2} \quad \text{[rad}^2\text{/Hz]}$$

$$L(f) = \frac{S_\phi(f)}{2} = \frac{S_v(f) \times (2\pi f_0)^2}{2(SR)^2} \quad \text{[linear]}$$

where $SR$ is the measured slew rate at zero-crossing [V/s].

### Direct Formula

$$\boxed{\mathcal{L}(f) = 10\log_{10}\left(\frac{S_v(f) \times (2\pi f_0)^2}{2(SR)^2}\right) \quad \text{[dBc/Hz]}}$$

**Or equivalently:**

$$\boxed{\mathcal{L}(f) = 10\log_{10}(S_v) + 20\log_{10}(2\pi f_0) - 20\log_{10}(SR) - 3\text{ dB} \quad \text{[dBc/Hz]}}$$

### Example

**Given:** $f_0 = 500$ MHz, $SR = 20$ GV/s

**Case 1:** $S_v(10\text{ MHz}) = 8.1 \times 10^{-17}$ V²/Hz, $v_{\text{rms}} = 9.0$ nV/$\sqrt{\text{Hz}}$

$$\mathcal{L} = 10\log_{10}\left(\frac{8.1 \times 10^{-17} \times (2\pi \times 500 \times 10^6)^2}{2 \times (20 \times 10^9)^2}\right) = -180 \text{ dBc/Hz}$$

**Case 2:** $S_v(10\text{ MHz}) = 8.1 \times 10^{-16}$ V²/Hz, $v_{\text{rms}} = 28.5$ nV/$\sqrt{\text{Hz}}$

$$\mathcal{L} = 10\log_{10}\left(\frac{8.1 \times 10^{-16} \times (2\pi \times 500 \times 10^6)^2}{2 \times (20 \times 10^9)^2}\right) = -170 \text{ dBc/Hz}$$
