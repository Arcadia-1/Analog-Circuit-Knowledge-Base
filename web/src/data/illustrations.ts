export interface Illustration {
  href: string;
  title: string;
  summary: string;
  thumb: 'pll' | 'sar' | 'inl' | 'err' | 'win' | 'fold' | 'ntf' | 'ti' | 'bits' | 'polar' | 'bode' | 'floor' | 'fom' | 'harm' | 'record';
  /** Whose site this is, for a page that is not on this one; it opens in a tab of its own. */
  external?: string;
}

export interface Topic {
  name: string;
  /** shown beside the heading, for anything that is here only for now */
  note?: string;
  items: Illustration[];
}

export const topics: Topic[] = [
  {
    name: 'Analog-to-digital converters',
    items: [
      {
        href: '/adc/aliasing-and-nyquist-zones/',
        title: 'Aliasing and Nyquist zones',
        summary: 'See where tones and harmonics land after sampling.',
        thumb: 'fold',
      },
      {
        href: '/adc/coherent-sampling/',
        title: 'Coherent sampling',
        summary: 'Measure spectral leakage and choose the right FFT window.',
        thumb: 'win',
      },
      {
        href: '/adc/how-long-a-record/',
        title: 'How long a record',
        summary: 'See how many samples a measurement needs before it settles.',
        thumb: 'record',
      },
      {
        href: '/adc/binary-vs-redundant-sar/',
        title: 'Binary vs redundant SAR',
        summary: 'Explore SAR decisions, redundancy and weight calibration.',
        thumb: 'sar',
      },
      {
        href: '/adc/inl-and-dnl/',
        title: 'INL and DNL',
        summary: 'Relate code widths and missing codes to static linearity.',
        thumb: 'inl',
      },
      {
        href: '/adc/what-sets-the-floor/',
        title: 'What sets the floor',
        summary: 'Weigh noise, resolution, jitter and distortion against each other.',
        thumb: 'floor',
      },
      {
        href: '/adc/reading-the-error/',
        title: 'Reading the error',
        summary: 'Separate noise, distortion and jitter in the residual.',
        thumb: 'err',
      },
      {
        href: '/adc/pulling-the-harmonics-out/',
        title: 'Pulling the harmonics out',
        summary: 'Measure distortion three ways and see whether they agree.',
        thumb: 'harm',
      },
      {
        href: '/adc/reading-the-bits/',
        title: 'Reading the bits',
        summary: 'Read bit activity and recover the weights of a SAR ADC.',
        thumb: 'bits',
      },
      {
        href: '/adc/what-a-conversion-costs/',
        title: 'What a conversion costs',
        summary: 'Weigh figures of merit, physical walls and the units a datasheet uses.',
        thumb: 'fom',
      },
      {
        href: '/adc/oversampling-and-noise-shaping/',
        title: 'Oversampling and noise shaping',
        summary: 'Trade bandwidth for resolution and shape in-band noise.',
        thumb: 'ntf',
      },
      {
        href: '/adc/averaging-and-the-polar-spectrum/',
        title: 'Averaging and the polar spectrum',
        summary: 'Average repeated captures and inspect harmonic phase.',
        thumb: 'polar',
      },
      {
        href: '/adc/time-interleaved-adcs/',
        title: 'Time-interleaved ADCs',
        summary: 'Find and correct offset, gain and timing mismatch.',
        thumb: 'ti',
      },
    ],
  },
];

/** Pages that are not ADCToolbox: the PLL one until it has a home of its own, and other people's tools. */
export const related: Topic = {
  name: 'More to explore',
  items: [
    {
      href: '/pll/integer-vs-fractional/',
      title: 'Integer-N vs fractional-N',
      summary: 'Compare PLL dividers and their effects on phase noise, spurs and jitter.',
      thumb: 'pll',
    },
    {
      href: 'https://many-question.github.io/bode-sketch/',
      title: 'Bode plots & stability',
      summary: 'Move poles and zeros to explore Bode plots, stability and transient response.',
      thumb: 'bode',
      external: 'many-question.github.io',
    },
  ],
};
