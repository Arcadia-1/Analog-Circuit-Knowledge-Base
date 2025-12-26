# Analog Circuit Knowledge Base

A knowledge repository for analog circuit design fundamentals, focusing on amplifier theory, signal processing techniques, noise reduction, and ADC architectures.

## Contents

### Basic Amplifier Topologies

#### `Single-Transistor-Amplifier-Configurations.md`
Reference guide for the three fundamental MOSFET amplifier topologies (Common Source, Common Gate, Common Drain). Includes voltage gain, input/output impedance analysis, and typical applications for each configuration.

#### `5T-Differential-Amplifier-Analysis.md`
Complete mathematical analysis of 5-transistor differential amplifiers including differential/common-mode gains, CMRR, PSRR, noise analysis (thermal and flicker), frequency response (poles, zeros, transfer function), and pole-zero doublet settling time analysis.

### Dynamic and Advanced Amplifiers

#### `Ring-Amplifier.md`
Ring amplifier (Ringamp) topology using dynamically stabilized inverter stages. Covers working principle, dead-zone design, bandwidth/power equations, dead-zone degeneration (DZD), multi-stage configurations, and state-of-the-art pipelined ADC applications.

#### `Floating-Inverter-Amplifier.md`
Floating Inverter Amplifier (FIA/FIDA) with floating supply reservoir. Includes gain formulas, common-mode stability, reservoir capacitor sizing, cross-coupled body biasing (CCBB) for enhanced gain, and applications in DTDSM and SAR ADCs.

#### `Floating-Charge-Transfer-Amplifier.md`
Floating Charge Transfer (FCT) amplifier with complementary common-gate topology and cross-coupled capacitor biasing (C³B). Covers charge conservation equations, PVT-robust gain, filter-embedded Pipe-SAR ADC architecture achieving 172 dB Schreier FoM.

### Noise Reduction Techniques

#### `kTC-Noise-Cancellation.md`
Thermal noise cancellation achieving up to 70% noise power reduction using auxiliary capacitors. Includes basic cancellation, presampling techniques (>5× sampling rate improvement), design equations, capacitor sizing, and applications in high-resolution SAR ADCs and ΔΣ modulators.

#### `Correlated-Double-Sampling.md`
Correlated Double Sampling (CDS) for removing offset, reset noise, and 1/f noise. Covers frequency response, noise shaping, reset noise cancellation, switched-capacitor implementation, Correlated Multiple Sampling (CMS), and comparison with other techniques.

#### `Correlated-Level-Shifting.md`
Correlated Level Shifting (CLS) for gain enhancement achieving effective gain A² from opamp with gain A. Enables >60 dB performance from 30 dB opamps. Includes sequential CLS (SCLS), noise analysis, pipelined SAR ADC applications, and look-ahead CLS techniques.

### Sampling and Data Conversion

#### `Current-Integration-Sampling.md`
Current integration sampling for converting current signals to voltage. Covers fundamental equations, integrating ADC architectures (dual-slope, incremental ΔΣ, multi-slope), photodiode integrators, noise analysis (kT/C, shot noise), jitter performance comparison with voltage sampling, and design equations.

### Analysis and Calculations

#### `Amplifier-Bandwidth-Calculations.md`
Comprehensive guide to amplifier bandwidth theory including gain-bandwidth product (GBW) fundamentals, closed-loop bandwidth calculations, gain-bandwidth tradeoffs, and multi-stage bandwidth analysis with visual comparisons.

#### `Phase-Noise-Calculations.md`
Bidirectional conversion formulas between phase noise and amplitude noise, including definitions, step-by-step derivations, direct formulas, and worked examples for high-speed applications.

## Directories

### `code/`
Python scripts for generating figures and visualizations.

### `figures/`
Generated plots and images referenced in the documentation.

### `reference/`
Local reference materials including LaTeX source documents and papers.
