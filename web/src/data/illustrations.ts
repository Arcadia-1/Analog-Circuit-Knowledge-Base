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
        summary: 'Step through a successive-approximation conversion, add DAC settling error, comparator noise and mismatch, and see what redundancy does and does not fix.',
        tags: ['capacitor DAC', 'redundancy', 'settling', 'SNDR', 'ENOB'],
        thumb: 'sar',
      },
    ],
  },
];
