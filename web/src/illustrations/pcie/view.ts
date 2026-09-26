/** What the lesson and the 3-D scene share, kept free of three.js so the page's first bundle stays small. */
export type PcieView = 'board' | 'lane' | 'cpu' | 'device' | 'packet';

/** Colours of the fields of a TLP and of the messages that come back. */
export const FIELD_COLORS = { framing: '#8b95a5', header: '#5aa0ff', payload: '#41d39a', lcrc: '#f0a34c', replay: '#b58cff', bad: '#f2566a' } as const;
export const DLLP_COLORS = { ack: '#b8f05a', nak: '#f2566a', credit: '#f5c542' } as const;

/** Byte layout of one TLP from its first byte: framing token with the sequence number, header, payload, LCRC. */
export function fields(payload: number, header: number, flit: boolean): { key: 'framing' | 'header' | 'payload' | 'lcrc'; bytes: number }[] {
  return flit
    ? [{ key: 'header', bytes: header }, { key: 'payload', bytes: payload }]
    : [{ key: 'framing', bytes: 4 }, { key: 'header', bytes: header }, { key: 'payload', bytes: payload }, { key: 'lcrc', bytes: 4 }];
}
