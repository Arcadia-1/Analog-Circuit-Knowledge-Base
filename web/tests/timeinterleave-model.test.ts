import { describe, expect, it } from 'vitest';
import { fft } from '../src/lib/fft';
import { coherentFrequency, foldBin, foldFrequency } from '../src/lib/frequency';
import {
  AMP,
  analysisPoints,
  calibrate,
  capture,
  channelNyquist,
  contributions,
  decimate,
  deinterleave,
  delayFarrow,
  delayFft,
  extractMismatch,
  FS,
  HARMONIC_ORDERS,
  interleave,
  jitterOnlySnr,
  mismatch,
  N,
  pattern,
  physicalParams,
  predictedSfdr,
  predictSpurs,
  read,
  residualRms,
  spectrumOf,
  sweep,
  SWEEP,
  thermalOnlySnr,
  unwrap,
  type HarmonicLevels,
  type Params,
} from '../src/illustrations/timeinterleave/model';

type Triple = [number[], number[], number[]];
interface Case {
  m: number;
  bits: number;
  target: number;
  rms: number[];
  fin: number;
  bin: number;
  amp: number;
  set: Triple;
  measured: Triple;
  spurs: [string, number, number, number, number][];
  metrics: number[];
  left: [Triple, Triple];
}

/** Gain, offset and skew in the units python/adc_time_interleave.py prints them in: %, mV and ps. */
function expectParams(p: { gain: Float64Array; offset: Float64Array; skew: Float64Array }, [gain, offset, skew]: Triple) {
  p.gain.forEach((g, c) => expect((g - 1) * 100).toBeCloseTo(gain[c], 4));
  p.offset.forEach((o, c) => expect(o * 1e3).toBeCloseTo(offset[c], 4));
  p.skew.forEach((s, c) => expect(s * 1e12).toBeCloseTo(skew[c], 4));
}

describe('time-interleaved mismatch', () => {
  // from python/adc_time_interleave.py: 4096 samples at 1 GS/s, a 0.4 V tone on ±0.5 V, 0.3 LSB of noise
  // unit-rms patterns for gain, offset and skew, by channel count
  const patterns: Record<number, number[][]> = {
    2: [
      [-1, 1],
      [1, -1],
      [1, -1],
    ],
    4: [
      [-0.406039806, 1.722331085, -0.692757364, -0.623533915],
      [1.36067386, 0.555741979, -0.999394491, -0.917021348],
      [1.024180548, -1.381948575, 0.877909535, -0.520141509],
    ],
    8: [
      [-0.644243804, 1.118462823, -0.881701918, -0.824371388, 0.217045556, 1.922383301, 0.147250254, -1.054824824],
      [1.058630116, 0.199103654, -1.461510094, -1.373549984, 0.684999015, 0.584444518, -0.835708488, 1.143591264],
      [0.924640177, -1.367212699, 0.785316132, -0.546336137, -0.927818062, 1.656281148, 0.293760381, -0.818630941],
    ],
  };

  // samples 0 1 2 3 4 31 32 59 60 61 62 63 of each delayed record
  const delays: [string, number[]][] = [
    ['fft 0.3', [0.45156987, 1.445554915, 0.691360775, 0.167408139, -0.297920097, 0.639637787, 0.233262072, 0.316005297, -0.14140394, -0.422952327, -0.275441901, -1.234248633]],
    ['fft -1.7', [0.691360775, 0.167408139, -0.297920097, -0.212774762, -0.657376619, -0.588504658, -1.055170945, -0.422952327, -0.275441901, -1.234248633, 0.45156987, 1.445554915]],
    ['farrow 0.3', [0.812518291, 1.282624175, 0.801636769, 0.083703091, -0.23105557, 0.639923169, 0.23136263, 0.374445143, -0.215031085, -0.329197049, -0.382040042, -1.098056809]],
    ['farrow -1.7 x5', [0.523639931, 0.113403098, -0.220249429, -0.261529343, -0.625397192, -0.595963262, -1.047835127, -0.308796937, -0.412841795, -1.095894711, -0.261390162, 0.028383419]],
    ['farrow 2.5 x7', [0.039992279, -0.144865507, 0.584191355, 1.285349896, 0.936432033, 0.784323029, 0.590712131, 1.108967928, 1.154943091, 0.527361064, -0.119592293, -0.371743653]],
    ['farrow 3.5 x3', [0, 0, 0, 0.418809564, 1.284212448, 1.163099599, 0.834841385, 0.66610172, 1.055209812, 1.14714385, 0.584781804, -0.000575976]],
    ['fft 0.45 odd', [0.318010689, 1.439054721, 0.802999083, 0.255771201, -0.279045116, 0.661070284, 0.320696765, 0.564462318, -0.255187931, -0.181642211, -0.658430912]],
  ];

  // channels, bits, target, rms gain (%), offset (mV) and skew (ps); then fin (MHz), bin and amplitude; the mismatch
  // set, measured, and left after each calibration, as [gain − 1 (%), offset (mV), skew (ps)]; the spurs predicted,
  // as [kind, k, MHz, dBFS, dBc]; SFDR and SNDR off, after fft and after farrow, then the predicted SFDR
  const cases: Case[] = [
    {
      m: 4, bits: 12, target: 100e6, rms: [0.3, 1, 5],
      fin: 99.853516, bin: 409, amp: 0.400003324,
      set: [[-0.12181, 0.5167, -0.20783, -0.18706], [1.36067, 0.55574, -0.99939, -0.91702], [5.1209, -6.90974, 4.38955, -2.60071]],
      measured: [[-0.12194, 0.51728, -0.20738, -0.18796], [1.23835, 0.43178, -1.1251, -1.04165], [5.12911, -6.9043, 4.38817, -2.61298]],
      spurs: [
        ['image', 3, 150.146484, -55.5804, -53.6422],
        ['offset', 1, 250, -51.1031, -49.165],
        ['image', 1, 349.853516, -57.2821, -55.344],
        ['image', 2, 400.146484, -51.2794, -49.3413],
        ['offset', 2, 500, -68.8363, -66.8982],
      ],
      metrics: [49.165, 45.011, 93.223, 68.726, 57.596, 56.862, 49.165],
      left: [
        [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
        [[-1e-05, -0.00025, 6e-05, 0.0002], [0.00066, -0.00056, 0, 0.00021], [2.26583, -3.05004, 1.93852, -1.15431]],
      ],
    },
    {
      m: 4, bits: 12, target: 17e6, rms: [2, 5, 3],
      fin: 16.845703, bin: 69, amp: 0.400001422,
      set: [[-0.81208, 3.44466, -1.38551, -1.24707], [6.80337, 2.77871, -4.99697, -4.58511], [3.07254, -4.14585, 2.63373, -1.56042]],
      measured: [[-0.81367, 3.44403, -1.38599, -1.24437], [6.68359, 2.65598, -5.12314, -4.70662], [3.04924, -4.026, 2.72715, -1.75039]],
      spurs: [
        ['image', 3, 233.154297, -40.4823, -38.5442],
        ['offset', 1, 250, -37.1308, -35.1926],
        ['image', 1, 266.845703, -40.5068, -38.5686],
        ['image', 2, 483.154297, -41.1083, -39.1701],
        ['offset', 2, 500, -54.8678, -52.9297],
      ],
      metrics: [35.193, 31.471, 93.342, 68.78, 93.255, 68.755, 35.193],
      left: [
        [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
        [[0, 0, 0, 0], [1e-05, -1e-05, 0, 0], [0.00175, -0.00231, 0.00157, -0.001]],
      ],
    },
    {
      m: 2, bits: 10, target: 180e6, rms: [1, 2, 5],
      fin: 179.931641, bin: 737, amp: 0.399996341,
      set: [[-1, 1], [2, -2], [5, -5]],
      measured: [[-1.00022, 1.00022], [1.51968, -2.49815], [4.99789, -4.99789]],
      spurs: [
        ['image', 1, 320.068359, -40.7336, -38.7953],
        ['offset', 1, 500, -47.9202, -45.9819],
      ],
      metrics: [38.795, 37.339, 81.23, 56.73, 56.457, 53.575, 38.795],
      left: [
        [[0, 0], [0, 0], [0, 0]],
        [[0, 0], [0.00052, 0], [1.33011, -1.33011]],
      ],
    },
    {
      m: 8, bits: 14, target: 40e6, rms: [0.5, 3, 8],
      fin: 39.794922, bin: 163, amp: 0.400000396,
      set: [[-0.32212, 0.55923, -0.44085, -0.41219, 0.10852, 0.96119, 0.07363, -0.52741], [3.17589, 0.59731, -4.38453, -4.12065, 2.055, 1.75333, -2.50713, 3.43077], [7.39712, -10.9377, 6.28253, -4.37069, -7.42254, 13.25025, 2.35008, -6.54905]],
      measured: [[-0.32185, 0.55968, -0.44124, -0.41341, 0.10881, 0.96186, 0.07377, -0.52762], [3.14403, 0.56648, -4.41647, -4.1523, 2.02501, 1.72162, -2.53797, 3.40116], [7.3946, -10.93217, 6.29145, -4.36939, -7.41314, 13.25267, 2.33162, -6.55563]],
      spurs: [
        ['image', 7, 85.205078, -60.3596, -58.4214],
        ['offset', 1, 125, -46.1784, -44.2402],
        ['image', 1, 164.794922, -58.037, -56.0988],
        ['image', 6, 210.205078, -52.9463, -51.0081],
        ['offset', 2, 250, -44.0834, -42.1452],
        ['image', 2, 289.794922, -51.303, -49.3648],
        ['image', 5, 335.205078, -58.2239, -56.2858],
        ['offset', 3, 375, -51.2625, -49.3244],
        ['image', 3, 414.794922, -62.3073, -60.3691],
        ['image', 4, 460.205078, -58.1592, -56.221],
        ['offset', 4, 500, -61.6123, -59.6741],
      ],
      metrics: [42.145, 38.49, 104.898, 80.822, 75.576, 70.603, 42.145],
      left: [
        [[0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0]],
        [[1e-05, -4e-05, 2e-05, 3e-05, 1e-05, -8e-05, 4e-05, 1e-05], [0.00058, -0.00069, 0.00028, -0.0001, 0, -0.00031, -0.0001, 0.00041], [1.01618, -1.50235, 0.86459, -0.60046, -1.01873, 1.82124, 0.32042, -0.90088]],
      ],
    },
    {
      m: 4, bits: 12, target: 300e6, rms: [0.3, 1, 5],
      fin: 300.048828, bin: 1229, amp: 0.399995267,
      set: [[-0.12181, 0.5167, -0.20783, -0.18706], [1.36067, 0.55574, -0.99939, -0.91702], [5.1209, -6.90974, 4.38955, -2.60071]],
      measured: [[-0.12274, 0.51648, -0.20718, -0.18656], [1.23596, 0.42868, -1.12605, -1.04094], [5.12688, -6.91269, 4.39064, -2.60482]],
      spurs: [
        ['image', 3, 50.048828, -52.1822, -50.2439],
        ['image', 2, 199.951172, -42.7306, -40.7923],
        ['offset', 1, 250, -51.1132, -49.1749],
        ['image', 1, 449.951172, -54.6746, -52.7363],
        ['offset', 2, 500, -68.8478, -66.9095],
      ],
      metrics: [40.792, 39.557, 42.528, 42.083, 42.515, 42.071, 40.792],
      left: [
        [[0, 0, 0, 0], [0, 0, 0, 0], [4.2717, -5.75964, 3.65827, -2.17033]],
        [[0, 0, 0, 0], [0.00013, 0.00028, 0, -0.00011], [4.27785, -5.76792, 3.66353, -2.17345]],
      ],
    },
    {
      m: 8, bits: 16, target: 450e6, rms: [1, 0, 10],
      fin: 449.951172, bin: 1843, amp: 0.399999896,
      set: [[-0.64424, 1.11846, -0.8817, -0.82437, 0.21705, 1.92238, 0.14725, -1.05482], [0, 0, 0, 0, 0, 0, 0, 0], [9.2464, -13.67213, 7.85316, -5.46336, -9.27818, 16.56281, 2.9376, -8.18631]],
      measured: [[-0.64437, 1.11849, -0.88182, -0.82436, 0.21707, 1.92252, 0.14733, -1.05487], [-0.00775, -0.00757, -0.00787, -0.00805, -0.00787, -0.00739, -0.00793, -0.00802], [9.24652, -13.67199, 7.85307, -5.46336, -9.2781, 16.56287, 2.93757, -8.18658]],
      spurs: [
        ['image', 4, 50.048828, -43.9444, -42.0062],
        ['image', 5, 74.951172, -36.8869, -34.9487],
        ['offset', 1, 125, -147.0335, -145.0953],
        ['image', 3, 175.048828, -37.5341, -35.5959],
        ['image', 6, 199.951172, -46.4902, -44.552],
        ['offset', 2, 250, -125.0588, -123.1206],
        ['image', 2, 300.048828, -40.6599, -38.7217],
        ['image', 7, 324.951172, -48.1629, -46.2247],
        ['offset', 3, 375, -136.3203, -134.3821],
        ['image', 1, 425.048828, -44.7179, -42.7797],
        ['offset', 4, 500, -140.2773, -138.3391],
      ],
      metrics: [34.945, 30.432, 34.389, 30.054, 34.788, 30.453, 34.949],
      left: [
        [[0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0], [10.27502, -15.19275, 8.72658, -6.07106, -10.31012, 18.40519, 3.26432, -9.09719]],
        [[4e-05, -0.00024, 0.00011, 0.0002, 4e-05, -0.00049, 0.00026, 9e-05], [0.00121, 0.00147, 0.00065, 0.00022, 3e-05, 0.0006, -0.00023, -0.00092], [9.81487, -14.51237, 8.33577, -5.79918, -9.8484, 17.58095, 3.11814, -8.68979]],
      ],
    },
  ];

  // the first case at each frequency of SWEEP: fin (MHz), then SFDR off, predicted, after fft and after farrow
  const sweepRows = [
    [6.103516, 49.168, 49.168, 93.308, 93.057],
    [18.798828, 49.162, 49.162, 93.317, 92.965],
    [31.005859, 49.179, 49.179, 91.907, 91.903],
    [43.701172, 49.163, 49.163, 92.944, 92.791],
    [56.396484, 49.163, 49.163, 93.606, 91.555],
    [68.603516, 49.173, 49.174, 92.649, 78.825],
    [81.298828, 49.143, 49.143, 93.711, 68.532],
    [93.505859, 49.163, 49.163, 92.991, 60.843],
    [106.201172, 48.951, 48.951, 92.574, 54.779],
    [118.896484, 48.143, 48.143, 93.504, 50.248],
    [131.103516, 47.424, 47.424, 42.534, 47.139],
    [143.798828, 46.726, 46.726, 42.515, 44.95],
    [156.005859, 46.118, 46.118, 42.538, 43.697],
    [168.701172, 45.496, 45.496, 42.529, 42.975],
    [181.396484, 44.921, 44.921, 42.522, 42.656],
    [193.603516, 44.424, 44.424, 42.547, 42.578],
    [206.298828, 43.897, 43.897, 42.534, 42.538],
    [218.505859, 43.425, 43.425, 42.529, 42.53],
    [231.201172, 42.968, 42.968, 42.535, 42.535],
    [243.896484, 42.532, 42.532, 42.54, 42.54],
    [256.103516, 42.122, 42.122, 42.537, 42.536],
    [268.798828, 41.71, 41.71, 42.524, 42.524],
    [281.005859, 41.351, 41.351, 42.537, 42.537],
    [293.701172, 40.976, 40.977, 42.533, 42.528],
    [306.396484, 40.619, 40.619, 42.53, 42.5],
    [318.603516, 40.295, 40.296, 42.535, 42.403],
    [331.298828, 39.97, 39.971, 42.542, 42.118],
    [343.505859, 39.654, 39.655, 42.53, 41.537],
    [356.201172, 39.359, 39.359, 42.543, 40.643],
    [368.896484, 39.053, 39.053, 42.535, 39.541],
    [381.103516, 38.774, 38.775, 36.512, 38.513],
    [393.798828, 38.493, 38.493, 36.509, 37.642],
    [406.005859, 38.239, 38.239, 36.515, 37.075],
    [418.701172, 37.98, 37.981, 36.52, 36.74],
    [431.396484, 37.716, 37.717, 36.511, 36.578],
    [443.603516, 37.487, 37.488, 36.52, 36.535],
    [456.298828, 37.238, 37.239, 36.513, 36.515],
    [468.505859, 37.006, 37.007, 36.508, 36.508],
    [481.201172, 36.788, 36.789, 36.518, 36.518],
    [493.896484, 36.554, 36.555, 36.508, 36.508],
  ];

  it('draws the same mismatch patterns', () => {
    for (const [m, rows] of Object.entries(patterns)) rows.forEach((row, which) => pattern(which, Number(m)).forEach((v, c) => expect(v).toBeCloseTo(row[c], 8)));
  });

  it('delays a record as fractional_delay_fft and fractional_delay_farrow do, edges included', () => {
    const x = Float64Array.from({ length: 64 }, (_, i) => Math.cos(2 * Math.PI * 0.071 * i) + 0.3 * Math.sin(2 * Math.PI * 0.23 * i + 0.4));
    const picks = [0, 1, 2, 3, 4, 31, 32, 59, 60, 61, 62, 63];
    const run: Record<string, () => Float64Array> = {
      'fft 0.3': () => delayFft(x, 0.3, 1),
      'fft -1.7': () => delayFft(x, -1.7, 1),
      'farrow 0.3': () => delayFarrow(x, 0.3, 1, 9),
      'farrow -1.7 x5': () => delayFarrow(x, -1.7, 1, 5),
      'farrow 2.5 x7': () => delayFarrow(x, 2.5, 1, 7),
      'farrow 3.5 x3': () => delayFarrow(x, 3.5, 1, 3),
      'fft 0.45 odd': () => delayFft(x.slice(0, 63), 0.45, 1),
    };
    for (const [name, values] of delays) {
      const y = run[name]();
      values.forEach((v, i) => expect(y[picks[i]]).toBeCloseTo(v, 8));
    }
  });

  it('splits and stitches the channels', () => {
    const ch = deinterleave(Float64Array.from({ length: 12 }, (_, i) => i), 3);
    expect(ch.map((c) => [...c])).toEqual([[0, 3, 6, 9], [1, 4, 7, 10], [2, 5, 8, 11]]);
    expect([...interleave(ch)]).toEqual([...Array(12).keys()]);
  });

  it('unwraps as numpy does, a step of exactly π included', () => {
    // np.unwrap of each
    const cases: [number[], number[]][] = [
      [[0, 3, -3, 1], [0, 3, 3.2831853071795862, 1]],
      [[0, Math.PI, 0, -Math.PI], [0, Math.PI, 0, -Math.PI]],
      [[0.5, 4, 7.5, -2, 10], [0.5, -2.2831853071795862, -5.0663706143591725, -2, -2.5663706143591725]],
    ];
    for (const [p, up] of cases) unwrap(p).forEach((v, i) => expect(v).toBeCloseTo(up[i], 12));
  });

  it.each(cases.map((c) => [c.m, c.bits, c.target / 1e6, c] as const))('matches ADCToolbox for %i channels, %i bits, a tone near %s MHz', (m, bits, _, c) => {
    const { fin, bin } = coherentFrequency(FS, c.target, N);
    expect(fin / 1e6).toBeCloseTo(c.fin, 5);
    expect(bin).toBe(c.bin);
    const mm = mismatch(m, c.rms[0] / 100, c.rms[1] / 1e3, c.rms[2] / 1e12);
    expectParams(mm, c.set);

    const x = capture(fin, mm, bits);
    const p = extractMismatch(x, m, FS, fin);
    expectParams(p, c.measured);
    expect(p.amp).toBeCloseTo(c.amp, 8);

    const spurs = predictSpurs(p, FS, 0.5);
    expect(spurs.map((s) => [s.kind, s.k])).toEqual(c.spurs.map(([kind, k]) => [kind, k]));
    spurs.forEach((s, i) => {
      expect(s.freq / 1e6).toBeCloseTo(c.spurs[i][2], 5);
      expect(s.dbfs).toBeCloseTo(c.spurs[i][3], 3);
      expect(s.dbc).toBeCloseTo(c.spurs[i][4], 3);
    });

    const after = (['fft', 'farrow'] as const).map((method) => calibrate(x, m, p, FS, method));
    [x, ...after].forEach((y, i) => {
      const s = spectrumOf(y, bits);
      expect(s.sfdr).toBeCloseTo(c.metrics[2 * i], 2);
      expect(s.sndr).toBeCloseTo(c.metrics[2 * i + 1], 2);
    });
    expect(predictedSfdr(spurs)).toBeCloseTo(c.metrics[6], 2);
    after.forEach((y, i) => expectParams(extractMismatch(y, m, FS, fin), c.left[i]));
  });

  it('puts a tone in the spectrum wherever predict_spurs puts a spur, as big as it says', () => {
    const c = cases[3];
    const { fin } = coherentFrequency(FS, c.target, N);
    const x = capture(fin, mismatch(c.m, c.rms[0] / 100, c.rms[1] / 1e3, c.rms[2] / 1e12), c.bits);
    const s = spectrumOf(x, c.bits);
    const spurs = predictSpurs(extractMismatch(x, c.m, FS, fin), FS, 0.5);
    expect(new Set(spurs.map((p) => p.freq)).size).toBe(spurs.length);
    for (const spur of spurs) {
      const bin = Math.round((spur.freq / FS) * N);
      // a tone on the last bin is its own mirror, and holds twice the power of a sine as tall
      const measured = s.dbfs[bin] - (bin === N / 2 ? 10 * Math.log10(2) : 0);
      expect(measured).toBeCloseTo(spur.dbfs, 1);
    }
  });

  it('retains the time-domain records and reduces residual error after FFT calibration', () => {
    const mm = mismatch(4, 0.003, 0.001, 5e-12);
    const raw = read(4, 100e6, mm, 12, 'off');
    const fixed = read(4, 100e6, mm, 12, 'fft');
    expect(raw.rawData).toHaveLength(N);
    expect(fixed.outData).toHaveLength(N);
    expect(residualRms(fixed.outData, fixed.fin)).toBeLessThan(residualRms(raw.rawData, raw.fin) / 10);
  });

  it('lists each offset tone once, as large as the tone the pattern makes', () => {
    for (const c of cases) {
      const { fin } = coherentFrequency(FS, c.target, N);
      const x = capture(fin, mismatch(c.m, c.rms[0] / 100, c.rms[1] / 1e3, c.rms[2] / 1e12), c.bits);
      const p = extractMismatch(x, c.m, FS, fin);
      const offsets = predictSpurs(p, FS, 0.5).filter((s) => s.kind === 'offset');
      expect(offsets.map((s) => s.k)).toEqual(Array.from({ length: c.m / 2 }, (_, i) => i + 1));
      // the offsets repeated over 64 turns, and the size of each tone in their spectrum
      const n = 64 * c.m, re = Float64Array.from({ length: n }, (_, i) => p.offset[i % c.m]), im = new Float64Array(n);
      fft(re, im);
      for (const s of offsets) {
        const bin = (s.k * n) / c.m, size = (Math.hypot(re[bin], im[bin]) / n) * (bin === n / 2 ? 1 : 2);
        expect(s.amp / size).toBeCloseTo(1, 9);
      }
      // with nothing but spurs above the floor, the prediction is the measurement
      if (c.target / 1e6 < 200) expect(Math.abs(c.metrics[6] - c.metrics[0])).toBeLessThan(0.01);
    }
  });

  it('predicts images from gain that stay put and images from skew that grow with the input', () => {
    const flat: Params = { fin: 0, amp: 0.4, gain: Float64Array.of(0.99, 1.01, 1, 1), offset: new Float64Array(4), skew: new Float64Array(4) };
    const late: Params = { ...flat, gain: new Float64Array(4).fill(1), skew: Float64Array.of(2e-12, -2e-12, 0, 0) };
    const worst = (p: Params, fin: number) => Math.max(...predictSpurs({ ...p, fin }, FS).map((s) => s.dbc));
    expect(worst(flat, 10e6)).toBeCloseTo(worst(flat, 400e6), 9);
    // twice the frequency, twice the phase error: 6 dB, while it stays small
    expect(worst(late, 20e6) - worst(late, 10e6)).toBeCloseTo(6.0206, 3);
    expect(worst(late, 10e6)).toBeCloseTo(20 * Math.log10(2 * Math.PI * 10e6 * 2e-12 / 2), 3);
  });

  it('leaves the skew uncorrected by the nearest multiple of fs/M above the channels’ Nyquist frequency', () => {
    // the delay turns the phase of the frequency each channel sees, fin less that multiple
    for (const c of cases.filter((c) => c.target / 1e6 > channelNyquist(c.m) / 1e6)) {
      const fsCh = FS / c.m, share = (fsCh * Math.round((c.fin * 1e6) / fsCh)) / (c.fin * 1e6);
      c.left[0][2].forEach((s, i) => expect(s / (c.measured[2][i] * share)).toBeCloseTo(1, 2));
    }
    // and below it, nothing is left
    for (const c of cases.filter((c) => c.target / 1e6 < channelNyquist(c.m) / 1e6)) c.left[0][2].forEach((s) => expect(Math.abs(s)).toBeLessThan(1e-4));
  });

  it('reads the page’s state in one call', () => {
    const c = cases[0], mm = mismatch(c.m, c.rms[0] / 100, c.rms[1] / 1e3, c.rms[2] / 1e12);
    const off = read(c.m, c.target, mm, c.bits, 'off');
    expect(off.out).toBe(off.raw);
    expect(off.left).toBeNull();
    const fft = read(c.m, c.target, mm, c.bits, 'fft');
    expect(fft.bin).toBe(c.bin);
    expect(fft.raw.sfdr).toBeCloseTo(c.metrics[0], 2);
    expect(fft.out.sfdr).toBeCloseTo(c.metrics[2], 2);
    expect(read(c.m, c.target, mm, c.bits, 'farrow').out.sfdr).toBeCloseTo(c.metrics[4], 2);
    // an image for every k, an offset tone for k = 1 … m/2
    expect(fft.spurs).toHaveLength(c.m - 1 + c.m / 2);
  });

  it('runs the expanded page model at 10 GS/s and keeps each new source distinct', () => {
    const fs = 10e9, fin = 1e9, jitter = 0.5e-12;
    const harmonics: HarmonicLevels = { 2: -65, 3: -71, 5: -80, 7: -86 };
    const mm = mismatch(4, 0.003, 0.001, 5e-12, 0.02);
    const r = read(4, fin, mm, 12, 'off', { fs, jitter, harmonics });
    expect(r.rawData).toHaveLength(N);
    expect(Math.abs(r.fin - fin)).toBeLessThanOrEqual(fs / N);
    expect(Number.isFinite(r.raw.sndr)).toBe(true);

    const rows = contributions(mm, fin, fs, harmonics);
    expect(rows.map((row) => row.id)).toEqual(['offset', 'gain', 'skew', 'bandwidth', 'harmonics']);
    expect(rows.every((row) => Number.isFinite(row.level))).toBe(true);
    expect(rows.find((row) => row.id === 'harmonics')?.frequencies).toEqual([2e9, 3e9, 5e9, 3e9]);
    expect(rows.find((row) => row.id === 'harmonics')?.toneLabels).toEqual(['H2', 'H3', 'H5', 'H7']);
  });

  it('reports independent thermal-noise and aperture-jitter SNR limits', () => {
    const bits = 12, noiseLsb = 0.3, fin = 1e9, analogBandwidth = 5e9, jitter = 0.5e-12;
    const signalRms = AMP / Math.sqrt(2 * (1 + (fin / analogBandwidth) ** 2));
    expect(thermalOnlySnr(bits, noiseLsb, fin, analogBandwidth)).toBeCloseTo(20 * Math.log10(signalRms / (noiseLsb / 2 ** bits)), 12);
    expect(jitterOnlySnr(fin, jitter)).toBeCloseTo(-20 * Math.log10(2 * Math.PI * fin * jitter), 12);
    expect(thermalOnlySnr(bits, 0, fin, analogBandwidth)).toBe(Infinity);
    expect(jitterOnlySnr(fin, 0)).toBe(Infinity);
  });

  it('uses an even record with complete channel turns for every selectable channel count', () => {
    for (let m = 1; m <= 16; m++) {
      const points = analysisPoints(m);
      expect(points % 2).toBe(0);
      expect(points % m).toBe(0);
      expect(points).toBeLessThanOrEqual(N);
      expect(N - points).toBeLessThan(2 * m);
    }
  });

  it('keeps every 15-channel bandwidth-mismatch image coherent in the displayed FFT', () => {
    const m = 15, fs = 10e9, points = analysisPoints(m);
    const mm = mismatch(m, 0, 0, 0, 0.013);
    const r = read(m, 4.9976e9, mm, 12, 'off', { fs });
    expect(points).toBe(4080);
    expect(r.fftPoints).toBe(points);
    expect(r.rawData).toHaveLength(points);
    for (const spur of r.spurs) {
      const exactBin = (spur.freq / r.fsOut) * points;
      expect(exactBin).toBeCloseTo(Math.round(exactBin), 9);
      expect(Math.abs(r.raw.dbfs[Math.round(exactBin)] - spur.dbfs)).toBeLessThan(0.1);
    }
    expect(Math.abs(r.raw.sfdr - predictedSfdr(r.spurs))).toBeLessThan(0.1);
  });

  it('uses the selected input-referred thermal noise and reports ENOB from SNDR', () => {
    const mm = mismatch(4, 0, 0, 0);
    const quiet = read(4, 1e9, mm, 12, 'off', { fs: 10e9, thermalNoiseLsb: 0 });
    const defaultNoise = read(4, 1e9, mm, 12, 'off', { fs: 10e9 });
    const explicitDefault = read(4, 1e9, mm, 12, 'off', { fs: 10e9, thermalNoiseLsb: 0.3 });
    const noisy = read(4, 1e9, mm, 12, 'off', { fs: 10e9, thermalNoiseLsb: 4 });
    expect(defaultNoise.raw.sndr).toBe(explicitDefault.raw.sndr);
    expect(noisy.raw.sndr).toBeLessThan(defaultNoise.raw.sndr);
    expect(defaultNoise.raw.sndr).toBeLessThan(quiet.raw.sndr);
    expect(noisy.raw.enob).toBeCloseTo((noisy.raw.sndr - 1.76) / 6.02, 12);
  });

  it('applies the selected Analog Bandwidth as a physical one-pole response', () => {
    const fin = 1e9, analogBandwidth = 1e9;
    const mm = mismatch(4, 0, 0, 0, 0);
    const p = physicalParams(mm, fin, 10e9, analogBandwidth);
    p.gain.forEach((gain) => expect(gain).toBeCloseTo(1 / Math.sqrt(2), 12));
    p.skew.forEach((delay) => expect(delay).toBeCloseTo(-1 / (8 * fin), 18));
    const r = read(4, fin, mm, 16, 'off', { fs: 10e9, analogBandwidth, thermalNoiseLsb: 0 });
    expect(r.raw.dbfs[r.raw.signal]).toBeCloseTo(20 * Math.log10(AMP / (0.5 * Math.sqrt(2))), 1);
  });

  it('places H2, H3, H5, and H7 independently in the decimated FFT', () => {
    const harmonics: HarmonicLevels = { 2: -44, 3: -50, 5: -56, 7: -62 };
    const r = read(4, 73e6, mismatch(4, 0, 0, 0), 16, 'off', { harmonics, decimation: 4 });
    expect(r.harmonics.map((tone) => tone.order)).toEqual(HARMONIC_ORDERS);
    for (const tone of r.harmonics) {
      const bin = Math.round((foldFrequency(tone.order * r.fin, r.fsOut) / r.fsOut) * r.fftPoints);
      expect(tone.freq).toBeCloseTo(foldFrequency(tone.order * r.fin, r.fsOut), 8);
      expect(r.raw.dbfs[bin] - r.raw.dbfs[r.raw.signal]).toBeCloseTo(harmonics[tone.order], 0);
    }

    const h5Only = read(4, 73e6, mismatch(4, 0, 0, 0), 16, 'off', { harmonics: { 5: -46 } });
    expect(h5Only.harmonics.map((tone) => tone.order)).toEqual([5]);
  });

  it.each([1, 2, 3, 17, 53, 63, 127, 255])('keeps an N-point coherent spectrum after direct decimation by %i', (factor) => {
    const r = read(4, 97e6, mismatch(4, 0.003, 0.001, 5e-12), 12, 'off', { decimation: factor });
    expect(r.rawData).toHaveLength(N);
    expect(r.fftPoints).toBe(N);
    expect(r.fsOut).toBe(FS / factor);
    expect(r.raw.dbfs).toHaveLength(N / 2 + 1);
    expect(r.raw.signal).toBe(foldBin(r.bin * factor, N));
    expect(r.coherent).toBe(true);
    expect(r.metricsResolved).toBe(true);
  });

  it('aligns the measured and predicted interleaving spurs after decimation by 53', () => {
    const r = read(8, 1e9, mismatch(8, 0.003, 0.001, 0.1e-12), 16, 'off', { fs: 10e9, decimation: 53 });
    for (const spur of r.spurs) {
      const bin = Math.round((spur.freq / r.fsOut) * r.fftPoints);
      expect(r.raw.dbfs[bin]).toBeCloseTo(spur.dbfs, 0);
    }
  });

  it.each([0, 256, 1.5])('rejects invalid decimation factor %s', (factor) => {
    expect(() => decimate(new Float64Array(N), factor)).toThrow('invalid decimation factor');
    expect(() => read(4, 97e6, mismatch(4, 0, 0, 0), 12, 'off', { decimation: factor })).toThrow('unsupported decimation factor');
  });

  it('accepts every integer decimation factor from 1 through 255', () => {
    const input = Float64Array.from({ length: N }, (_, i) => i);
    for (let factor = 1; factor <= 255; factor++) {
      const output = decimate(input, factor);
      expect(output).toHaveLength(Math.ceil(N / factor));
      expect(output.at(-1)).toBe((output.length - 1) * factor);
    }
  });

  it('folds every contribution onto the same output-frequency axis as the FFT', () => {
    const factor = 8, fsOut = FS / factor;
    const harmonics: HarmonicLevels = { 2: -48, 3: -54, 5: -60, 7: -66 };
    const mm = mismatch(4, 0.003, 0.001, 5e-12, 0.02);
    const r = read(4, 91e6, mm, 14, 'off', { harmonics, decimation: factor });
    const rows = contributions(mm, r.fin, FS, harmonics, fsOut);
    for (const row of rows) for (const frequency of row.frequencies) expect(frequency).toBeLessThanOrEqual(fsOut / 2);
    const harmonicRow = rows.find((row) => row.id === 'harmonics');
    expect(harmonicRow?.frequencies).toEqual(HARMONIC_ORDERS.map((order) => foldFrequency(order * r.fin, fsOut)));
    harmonicRow?.frequencies.forEach((frequency, i) => {
      const tone = r.harmonics[i];
      expect(Math.round((frequency / fsOut) * r.fftPoints)).toBe(Math.round((tone.freq / r.fsOut) * r.fftPoints));
    });
  });

  it('sweeps the frequency as the reference does', () => {
    const c = cases[0];
    const s = sweep(c.m, mismatch(c.m, c.rms[0] / 100, c.rms[1] / 1e3, c.rms[2] / 1e12), c.bits);
    expect(SWEEP).toHaveLength(sweepRows.length);
    sweepRows.forEach(([f, off, predicted, fft, farrow], i) => {
      expect(s.fin[i] / 1e6).toBeCloseTo(f, 5);
      expect(s.off[i]).toBeCloseTo(off, 2);
      expect(s.predicted[i]).toBeCloseTo(predicted, 2);
      expect(s.fft[i]).toBeCloseTo(fft, 2);
      expect(s.farrow[i]).toBeCloseTo(farrow, 2);
    });
  });
});
