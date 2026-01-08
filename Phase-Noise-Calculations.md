<!--
Input: reference/phase_noise_calculation.tex | Output: Phase noise and amplitude noise conversion reference | Position: Core technical document
⚠️ After any change, update this comment AND reference/.FOLDER.md
-->
# Phase Noise and Amplitude Noise Conversion

## Phase Noise to Amplitude Noise

### Definitions

- **Phase noise (SSB)**: $L = P_{\mathrm{n}}/P_{\mathrm{c}}$ (linear), or $\mathcal{L}(f) = 10\log_{10}(L)$ [dBc/Hz]
- **Phase PSD**: $S_{\phi}(f) = 2 \times L(f)$ [rad²/Hz]
- **$S_{\mathrm{v}}$**: Voltage noise power spectral density [V²/Hz]
- **$S_{\mathrm{t}}$**: Timing jitter power spectral density [s²/Hz]

### Conversion Steps

$$S_{\phi}(f) = 2 \times 10^{\mathcal{L}(f)/10} \quad \text{[rad}^2\text{/Hz]}$$

$$S_{\mathrm{t}}(f) = S_{\phi}(f) \times \left(\frac{1}{2\pi f_{\mathrm{0}}}\right)^2 \quad \text{[s}^2\text{/Hz]}$$

$$S_{\mathrm{v}}(f) = S_{\mathrm{t}}(f) \times (SR)^2 \quad \text{[V}^2\text{/Hz]}$$

where:
- $f_{\mathrm{0}}$ is the operating frequency [Hz]
- $SR$ is the measured slew rate at zero-crossing [V/s]

### Direct Formula

$$\boxed{S_{\mathrm{v}}(f) = 2 \times 10^{\mathcal{L}(f)/10} \times \left(\frac{SR}{2\pi f_{\mathrm{0}}}\right)^2 \quad \text{[V}^2\text{/Hz]}}$$

### Example

**Given:** $f_{\mathrm{0}} = 500$ $\text{MHz}$

**Case 1:** $\mathcal{L}(f) = -180$ $\text{dBc/Hz}$, $SR = 20$ $\text{GV/s}$

$$S_{\mathrm{v}} = 2 \times 10^{-18} \times \left(\frac{20 \times 10^9}{2\pi \times 500 \times 10^6}\right)^2 = 0.081 \text{ fV}^2\text{/Hz}$$

$$S_{\mathrm{v}}[\text{dB}] = 10\log_{10}(8.1 \times 10^{-17}) = -160.9 \text{ dB (V}^2\text{/Hz)}$$

$$v_{\mathrm{n}}(f) = \sqrt{S_{\mathrm{v}}} = 9.0 \text{ nV} / \sqrt{\text{Hz}}$$

**Case 2:** $\mathcal{L}(f) = -160$ $\text{dBc/Hz}$, $SR = 20$ $\text{GV/s}$

$$S_{\mathrm{v}} = 2 \times 10^{-16} \times \left(\frac{20 \times 10^9}{2\pi \times 500 \times 10^6}\right)^2 = 8.1 \text{ fV}^2\text{/Hz}$$

$$S_{\mathrm{v}}[\text{dB}] = 10\log_{10}(8.1 \times 10^{-15}) = -140.9 \text{ dB (V}^2\text{/Hz)}$$

$$v_{\mathrm{n}}(f) = \sqrt{S_{\mathrm{v}}} = 90.0 \text{ nV} / \sqrt{\text{Hz}}$$

**Case 3:** $\mathcal{L}(f) = -180$ $\text{dBc/Hz}$, $SR = 200$ $\text{GV/s}$

$$S_{\mathrm{v}} = 2 \times 10^{-18} \times \left(\frac{200 \times 10^9}{2\pi \times 500 \times 10^6}\right)^2 = 8.1 \text{ fV}^2\text{/Hz}$$

$$S_{\mathrm{v}}[\text{dB}] = 10\log_{10}(8.1 \times 10^{-15}) = -140.9 \text{ dB (V}^2\text{/Hz)}$$

$$v_{\mathrm{n}}(f) = \sqrt{S_{\mathrm{v}}} = 90.0 \text{ nV} / \sqrt{\text{Hz}}$$

---

## Amplitude Noise to Phase Noise

### Definitions

- **Voltage noise PSD**: $S_{\mathrm{v}}(f)$ [V²/Hz]
- **Measured slew rate**: $SR$ [V/s]
- **Carrier frequency**: $f_{\mathrm{0}}$ [Hz]

### Conversion Steps

$$S_{\mathrm{t}}(f) = \frac{S_{\mathrm{v}}(f)}{(SR)^2} \quad \text{[s}^2\text{/Hz]}$$

$$S_{\phi}(f) = S_{\mathrm{t}}(f) \times (2\pi f_{\mathrm{0}})^2 = \frac{S_{\mathrm{v}}(f) \times (2\pi f_{\mathrm{0}})^2}{(SR)^2} \quad \text{[rad}^2\text{/Hz]}$$

$$L(f) = \frac{S_{\phi}(f)}{2} = \frac{S_{\mathrm{v}}(f) \times (2\pi f_{\mathrm{0}})^2}{2(SR)^2} \quad \text{[linear]}$$

where $SR$ is the measured slew rate at zero-crossing [V/s].

### Direct Formula

$$\boxed{\mathcal{L}(f) = 10\log_{10}\left(\frac{S_{\mathrm{v}}(f) \times (2\pi f_{\mathrm{0}})^2}{2(SR)^2}\right) \quad \text{[dBc/Hz]}}$$

**Or equivalently:**

$$\boxed{\mathcal{L}(f) = 10\log_{10}(S_{\mathrm{v}}) + 20\log_{10}(2\pi f_{\mathrm{0}}) - 20\log_{10}(SR) - 3\text{ dB} \quad \text{[dBc/Hz]}}$$

### Example

**Given:** $f_{\mathrm{0}} = 500$ $\text{MHz}$

**Case 1:** $S_{\mathrm{v}}(f) = 0.081$ $\text{fV}^2\text{/Hz}$, $v_{\mathrm{n}}(f) = 9.0 \text{ nV} / \sqrt{\text{Hz}}$, $SR = 20$ $\text{GV/s}$

$$S_{\mathrm{v}}[\text{dB}] = 10\log_{10}(8.1 \times 10^{-17}) = -160.9 \text{ dB (V}^2\text{/Hz)}$$

$$\mathcal{L} = 10\log_{10}\left(\frac{8.1 \times 10^{-17} \times (2\pi \times 500 \times 10^6)^2}{2 \times (20 \times 10^9)^2}\right) = -180 \text{ dBc/Hz}$$

**Case 2:** $S_{\mathrm{v}}(f) = 8.1$ $\text{fV}^2\text{/Hz}$, $v_{\mathrm{n}}(f) = 90.0 \text{ nV} / \sqrt{\text{Hz}}$, $SR = 20$ $\text{GV/s}$

$$S_{\mathrm{v}}[\text{dB}] = 10\log_{10}(8.1 \times 10^{-15}) = -140.9 \text{ dB (V}^2\text{/Hz)}$$

$$\mathcal{L} = 10\log_{10}\left(\frac{8.1 \times 10^{-15} \times (2\pi \times 500 \times 10^6)^2}{2 \times (20 \times 10^9)^2}\right) = -160 \text{ dBc/Hz}$$

**Case 3:** $S_{\mathrm{v}}(f) = 8.1$ $\text{fV}^2\text{/Hz}$, $v_{\mathrm{n}}(f) = 90.0 \text{ nV} / \sqrt{\text{Hz}}$, $SR = 200$ $\text{GV/s}$

$$S_{\mathrm{v}}[\text{dB}] = 10\log_{10}(8.1 \times 10^{-15}) = -140.9 \text{ dB (V}^2\text{/Hz)}$$

$$\mathcal{L} = 10\log_{10}\left(\frac{8.1 \times 10^{-15} \times (2\pi \times 500 \times 10^6)^2}{2 \times (200 \times 10^9)^2}\right) = -180 \text{ dBc/Hz}$$
