/** Names, categories and explanations of everything that can be picked in the 3-D view. */
export type Category = 'digital' | 'clock' | 'afe' | 'conv' | 'mixed' | 'io';
export type BlockId =
  | 'pcs_a' | 'txdsp' | 'ser' | 'pll_a' | 'drv' | 'esd_a' | 'bias_a' | 'dft_a'
  | 'esd_b' | 'ctle' | 'vga' | 'th' | 'adc' | 'dsp' | 'pll_b' | 'cdr' | 'fw' | 'deser' | 'pcs_b' | 'bias_b' | 'mon_b'
  | 'pkg' | 'chan' | 'accaps' | 'refclk' | 'vrm' | 'pcb';

/** PAM4 symbol colours −3, −1, +1, +3 (drawn on the dark die in both themes) and the symbol-error colour. */
export const SYMBOL_COLORS = ['#3d7bff', '#8cc2ff', '#ffd699', '#f0a33c'] as const;
export const ERROR_COLOR = '#f27d8a';

export const CATEGORY: Record<Category, { name: string; color: number }> = {
  digital: { name: 'Digital · DSP', color: 0x4c6a8f },
  clock: { name: 'Clocking', color: 0x6a5aa8 },
  afe: { name: 'Analog front end', color: 0x2f8f83 },
  conv: { name: 'Data converter', color: 0xa8803a },
  mixed: { name: 'Mux / demux', color: 0x9a5b52 },
  io: { name: 'I/O · package · board', color: 0xb89a4c },
};

export interface BlockInfo {
  title: string;
  category: Category;
  text: string;
}

export const BLOCKS: Record<BlockId, BlockInfo> = {
  pcs_a: { title: 'PCS + KP4 FEC encoder', category: 'digital', text: 'Transcodes 64b/66b into 256b/257b, appends Reed–Solomon RS(544,514) “KP4” parity and Gray-maps bit pairs onto PAM4 symbols. During link training it sends PRBS13Q.' },
  txdsp: { title: 'TX DSP · 3-tap FFE', category: 'digital', text: 'A feed-forward equalizer pre-distorts each symbol: c(−1) cancels pre-cursor ISI, c(+1) de-emphasises the post-cursor, and Σ|c| = 1 keeps the peak swing at 1.0 Vppd. The pillars show the taps relative to c(0).' },
  ser: { title: 'Serializer · MUX tree', category: 'mixed', text: 'Retiming 2:1 multiplexers double the symbol rate at every stage; in silicon the last stage is a 4:1 MUX on four 14 GHz clock phases. The particles speed up at each level until one symbol leaves every UI.' },
  pll_a: { title: 'TX LC-PLL', category: 'clock', text: 'A fractional-N PLL locks a 14 GHz LC-VCO to the 156.25 MHz reference (÷ 89.6). Quadrature clocks with duty-cycle and quadrature-error correction drive the final multiplexer.' },
  drv: { title: 'SST driver · 7-bit DAC', category: 'afe', text: 'Source-series-terminated segments pull each output leg up or down; how many point up sets the PAM4 level. The slabs light with the symbol being launched. 1.0 Vppd swing, 2 × 50 Ω back-termination.' },
  esd_a: { title: 'T-coil · ESD · bumps', category: 'io', text: 'A bridged T-coil tunes out the ESD-diode and pad capacitance so the output stays matched toward 28 GHz. TXP and TXN leave the die through flip-chip bumps.' },
  bias_a: { title: 'Bias · regulators', category: 'afe', text: 'Bandgap reference, bias currents and low-dropout regulators that keep digital supply noise out of the PLL and driver.' },
  dft_a: { title: 'Test · PRBS / BIST', category: 'digital', text: 'Pattern generators (PRBS13Q, PRBS31Q), loopback control and JTAG access for bring-up and production test.' },
  esd_b: { title: 'Termination · T-coil · ESD', category: 'io', text: 'On-die 100 Ω differential termination; a T-coil hides the ESD capacitance to keep return loss low up to Nyquist.' },
  ctle: { title: 'CTLE', category: 'afe', text: 'Continuous-time linear equalizer in the IEEE 802.3ck COM reference form: a zero at f_b/2.5, poles at f_b/2.5 and f_b, and a low-frequency shelf at f_b/80. A lower g_DC boosts 28 GHz relative to DC, and amplifies noise with it.' },
  vga: { title: 'VGA', category: 'afe', text: 'Scales the equalized signal so its rms sits at 0.3 of ADC full scale, leaving headroom for PAM4 peaks.' },
  th: { title: 'Track-and-hold × 8', category: 'afe', text: 'Eight front-end samplers each take every eighth symbol at 7 GS/s and hold it while the eight SAR ADCs behind them convert in turn. Each box flashes as its group samples.' },
  adc: { title: '64-way SAR TI-ADC', category: 'conv', text: 'Sixty-four 7-bit successive-approximation ADCs at 875 MS/s interleave to 56 GS/s. Bars hold the last 64 samples at the CDR phase; each tile flashes when it samples. Noise is modelled as 0.010 FS rms, about 6 ENOB.' },
  dsp: { title: 'DSP · FFE + DFE', category: 'digital', text: 'A 12-tap feed-forward equalizer (3 pre-cursor, 8 post-cursor taps) and a 1-tap decision-feedback equalizer, adapting toward the MMSE solution. Pillars show taps relative to the main tap; violet is the DFE.' },
  pll_b: { title: 'RX LC-PLL', category: 'clock', text: 'Generates the multi-phase 14 GHz clocks that the phase interpolator rotates to follow the incoming data.' },
  cdr: { title: 'CDR · phase interpolator', category: 'clock', text: 'A baud-rate Mueller–Müller phase detector on ADC samples drives a digital loop filter that steers the phase interpolator. The needle shows the recovered sampling phase.' },
  fw: { title: 'Adaptation µC', category: 'digital', text: 'Firmware that sequences link training: CTLE search, FFE/DFE adaptation and on-chip eye monitoring.' },
  deser: { title: 'Deserializer · DEMUX tree', category: 'mixed', text: 'Fans the 56 GBd decision stream back out into parallel words; the symbol rate halves at each stage. Red particles are symbol errors.' },
  pcs_b: { title: 'PCS + KP4 FEC decoder', category: 'digital', text: 'The Reed–Solomon decoder corrects up to 15 ten-bit symbols in each 5440-bit codeword, which turns a pre-FEC BER around 10⁻⁵ into error-free traffic.' },
  bias_b: { title: 'Bias · regulators', category: 'afe', text: 'Bandgap, bias currents and low-dropout regulators for the receiver front end and clocking.' },
  mon_b: { title: 'Eye monitor · BIST', category: 'digital', text: 'Counts slicer errors and sweeps a spare sampler in phase and threshold to map the eye on-chip.' },
  pkg: { title: 'FCBGA package', category: 'io', text: 'Flip-chip die on an organic build-up substrate. Bumps fan out through package traces and vias to BGA balls; each transition is a small impedance step, modelled as one echo (ρ₁ρ₂ = 0.02, 9 UI round trip).' },
  chan: { title: 'PCB channel', category: 'io', text: '100 Ω differential stripline in low-loss laminate. Loss grows with √f from skin effect and roughly ∝ f from the dielectric; the model splits them 35/65 and keeps both causal. The glow shows the voltage on each leg; a 30 cm trace holds about 110 symbols in flight, 44 are drawn.' },
  accaps: { title: 'AC-coupling capacitors', category: 'io', text: 'Series 100 nF capacitors block DC so the two chips can bias their common modes independently; their ~16 kHz corner sits far below the data spectrum.' },
  refclk: { title: 'Reference oscillator', category: 'clock', text: 'Low-jitter 156.25 MHz crystal oscillator feeding the PLL reference input.' },
  vrm: { title: 'Voltage regulator', category: 'afe', text: 'Point-of-load regulator for the SerDes analog supply rails.' },
  pcb: { title: 'Evaluation board', category: 'io', text: 'A 16-layer board carrying both chips, their reference clocks and regulators, with ground-stitching vias flanking the differential pair.' },
};
