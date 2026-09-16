export interface Illustration {
  href: string;
  title: string;
  summary: string;
  tags: string[];
  thumb: 'pll' | 'sar' | 'inl' | 'err' | 'win' | 'fold' | 'ntf' | 'ti';
  /** The ADCToolbox module and examples this page runs, shown under the card. */
  toolbox?: string;
}

export interface Topic {
  name: string;
  /** shown beside the heading, for anything that is here only for now */
  note?: string;
  items: Illustration[];
}

/** Parts of the toolbox that have no page yet, named so the gaps are honest ones. */
export const coming = [
  'reading the digital output bit by bit',
  'polar spectra and averaging',
  'jitter and dynamic nonlinearity',
  'figures of merit',
];

export const topics: Topic[] = [
  {
    name: 'Analog-to-digital converters',
    items: [
      {
        href: '/adc/coherent-sampling/',
        title: 'Coherent sampling',
        summary: 'A perfect converter, measured badly. Move the tone a tenth of a bin off and an unwindowed FFT reads two effective bits; see which window catches it, what its side bins cost, and what a longer record does and does not buy.',
        tags: ['leakage', 'windows', 'side bins', 'record length', 'SFDR'],
        thumb: 'win',
        toolbox: 'spectrum · exp_b02, exp_s06, exp_s08, exp_s09',
      },
      {
        href: '/adc/aliasing-and-nyquist-zones/',
        title: 'Aliasing and Nyquist zones',
        summary: 'Sweep a tone across six Nyquist zones and it lands between 0 and fs/2 every time, backwards in every other zone. See where its harmonics fold, and what keeping only one sample in N does to all of them.',
        tags: ['Nyquist zones', 'undersampling', 'spectral inversion', 'harmonic folding', 'decimation'],
        thumb: 'fold',
        toolbox: 'fundamentals, siggen · exp_c01, exp_d00',
      },
      {
        href: '/adc/oversampling-and-noise-shaping/',
        title: 'Oversampling and noise shaping',
        summary: 'Shape a quantiser’s noise to first, second or third order and watch the band’s share of it collapse while the total grows. Measure it with perfosr, predict it with ntfperf, and pull the band out with ifilter.',
        tags: ['OSR', 'noise shaping', 'NTF', 'in-band SNDR', 'ideal filter'],
        thumb: 'ntf',
        toolbox: 'oversampling, siggen · exp_o01, exp_o02, exp_o03',
      },
      {
        href: '/adc/time-interleaved-adcs/',
        title: 'Time-interleaved ADCs',
        summary: 'Four converters take turns, each with its own offset, gain and sampling skew. See where predict_spurs puts every spur, measure the mismatch from one sine, and calibrate it out, until the input crosses fs/2M.',
        tags: ['offset spurs', 'image spurs', 'timing skew', 'fractional delay', 'foreground calibration'],
        thumb: 'ti',
        toolbox: 'timeinterleave · exp_ti01',
      },
      {
        href: '/adc/reading-the-error/',
        title: 'Reading the error',
        summary: 'Subtract the sine you asked for and read what is left four ways. Noise, static curvature, clock jitter, settling memory and an interfering tone each sign their name in a different view.',
        tags: ['sine fit', 'AM / PM', 'error PDF', 'jitter', 'memory effect'],
        thumb: 'err',
        toolbox: 'aout · exp_a01, exp_a02, exp_a03, exp_a21, exp_a22',
      },
      {
        href: '/adc/inl-and-dnl/',
        title: 'INL and DNL',
        summary: 'Shape the static error of a capacitor DAC, then measure it back the way a lab does: a ramp or a sine code-density test, an endpoint or best-fit reference line, and only so many samples.',
        tags: ['missing codes', 'code density', 'ramp test', 'reference line', 'harmonics'],
        thumb: 'inl',
        toolbox: 'aout · exp_a32, exp_a33, exp_g05',
      },
      {
        href: '/adc/binary-vs-redundant-sar/',
        title: 'Binary vs redundant SAR',
        summary: 'Step through the SAR conversion of ADCToolbox, add unit-capacitor mismatch and comparator noise, and compare the spectra before and after sine-fit calibration.',
        tags: ['capacitor DAC', 'redundancy', 'unit-cap mismatch', 'calibration', 'ENOB'],
        thumb: 'sar',
        toolbox: 'models, calibration · exp_d02, exp_d03, exp_d15, exp_g04',
      },
    ],
  },
  {
    name: 'Phase-locked loops',
    note: 'here until it has a home of its own',
    items: [
      {
        href: '/pll/integer-vs-fractional/',
        title: 'Integer-N vs fractional-N',
        summary: 'One reference, one loop, one VCO. Drag the target frequency and see what a fractional divider does to the phase detector, the spectrum and the jitter.',
        tags: ['accumulator', 'ΣΔ', 'DTC', 'loop bandwidth', 'reference frequency'],
        thumb: 'pll',
      },
    ],
  },
];
