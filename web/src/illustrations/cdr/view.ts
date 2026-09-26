/** What the lesson and the 3-D scene share, kept free of three.js so the page's first bundle stays small. */
export const WINDOW = 800;
export const COLORS = { early: '#f0b45c', late: '#66aaff', error: '#f27d8a', edgeSampler: '#e9eef6', dataSampler: '#41e3a5' } as const;
export type CdrView = 'belt' | 'tunnel' | 'wheel' | 'loop';
/** Bits of the conveyor belt shown on either side of the reader, and the most bits still to arrive that it can draw. */
export const BELT_SPAN = 5;
export const AHEAD = 64;

/** The last WINDOW UI of the simulation. */
export interface History {
  /** Index of the newest UI plus one. */
  end: number;
  bit: Uint8Array;
  edge: Float32Array;
  theta: Float32Array;
  decision: Int8Array;
  error: Uint8Array;
  transition: Uint8Array;
  /** Bits still to arrive after `end` (the first `ahead` entries of nextBit and nextEdge), for the belt. */
  ahead: number;
  nextBit: Uint8Array;
  nextEdge: Float32Array;
}
