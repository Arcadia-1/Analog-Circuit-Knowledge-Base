export interface Illustration {
  href: string;
  title: string;
  summary: string;
  tags: string[];
  thumb: 'pll' | 'sar' | 'inl' | 'err';
  /** The ADCToolbox module and examples this page is the interactive companion to. */
  toolbox?: string;
}

export interface Topic {
  name: string;
  items: Illustration[];
}

export const topics: Topic[] = [
  {
    name: 'Phase-locked loops',
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
  {
    name: 'Analog-to-digital converters',
    items: [
      {
        href: '/adc/reading-the-error/',
        title: 'Reading the error',
        summary: 'Subtract the sine you asked for and read what is left four ways. Noise, static curvature, clock jitter, settling memory and an interfering tone each sign their name in a different view.',
        tags: ['sine fit', 'AM / PM', 'error PDF', 'jitter', 'memory effect'],
        thumb: 'err',
        toolbox: '04_debug_analog · exp_a01, exp_a02, exp_a03, exp_a21',
      },
      {
        href: '/adc/inl-and-dnl/',
        title: 'INL and DNL',
        summary: 'Shape the static error of a capacitor DAC, then measure it back the way a lab does: a ramp or a sine code-density test, an endpoint or best-fit reference line, and only so many samples.',
        tags: ['missing codes', 'code density', 'ramp test', 'reference line', 'harmonics'],
        thumb: 'inl',
        toolbox: '04_debug_analog · exp_a32, exp_a33, exp_g05',
      },
      {
        href: '/adc/binary-vs-redundant-sar/',
        title: 'Binary vs redundant SAR',
        summary: 'Step through the SAR conversion of ADCToolbox, add unit-capacitor mismatch and comparator noise, and compare the spectra before and after sine-fit calibration.',
        tags: ['capacitor DAC', 'redundancy', 'unit-cap mismatch', 'calibration', 'ENOB'],
        thumb: 'sar',
        toolbox: '05_debug_digital · exp_d02, exp_d03, exp_d15, exp_g04',
      },
    ],
  },
];
