export interface Illustration {
  href: string;
  title: string;
  summary: string;
  tags: string[];
  thumb: 'pll' | 'sar';
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
        href: '/adc/binary-vs-redundant-sar/',
        title: 'Binary vs redundant SAR',
        summary: 'Step through the SAR conversion of ADCToolbox, add unit-capacitor mismatch and comparator noise, and compare the spectra before and after sine-fit calibration.',
        tags: ['capacitor DAC', 'redundancy', 'unit-cap mismatch', 'calibration', 'ENOB'],
        thumb: 'sar',
      },
    ],
  },
];
