import { describe, expect, it } from 'vitest';
import {
  CASES,
  capture,
  decompose,
  estimateFrequency,
  fitStaticNonlin,
  hdToK,
  read,
  spectrumOf,
  TONE,
} from '../src/illustrations/harmonics/model';

interface Sheet {
  /** k2 and k3 as asked for, then as fit_static_nonlin got them back */
  k: [number, number, number, number];
  magnitudes: number[];
  db: number[];
  phases: number[];
  residualRms: number;
  noiseDb: number;
  frequency: number;
  /** the fundamental, the harmonics and what is left, at samples 0, 1, 2 and 100 */
  parts: [number[], number[], number[]];
  /** SNDR and SFDR, then harmonics 2 … 5 in dBc, as analyze_spectrum reports them */
  spectrum: [number, number, number[]];
  samples: number[];
}

describe('pulling the harmonics out', () => {
  // every number below is printed by python/adc_harmonics.py, which runs ADCToolbox on the same samples
  it('puts the tone on a coherent bin, with five harmonics under Nyquist', () => {
    expect(TONE.bin).toBe(397);
    expect(TONE.fin * 5).toBeLessThan(500e6);
  });

  const sheets: Record<string, Sheet> = {
    clean: {
      k: [0, 0.000002111, 0, -0.000030676],
      magnitudes: [0.899999615, 0.000000654, 0.000001407, 0.000001297, 0.000000851],
      db: [-0.0002, -122.7692, -116.119, -116.8232, -120.4858],
      phases: [0, -0.858681, 3.026113, 0.196891, 0.121544],
      residualRms: 0.000056319,
      noiseDb: -84.072,
      frequency: 0.096923828,
      parts: [
        [0.499971129, 0.757388623, 0.922251705, 0.079137021],
        [0.000000452, 0.000000504, -0.000000246, 0.000000824],
        [0.000028419, -0.000003873, -0.000010248, -0.000036282],
      ],
      spectrum: [84.0633, 107.7721, [-122.758, -116.1126, -116.816, -120.4863]],
      samples: [0.5, 0.757385254, 0.922241211, 0.935302734, 0.079101562, 0.757385254],
    },
    second: {
      k: [0.004444444, 0.004442706, 0, 0.000014247],
      magnitudes: [0.899998537, 0.000899643, 0.000001124, 0.000001683, 0.000001233],
      db: [-0.0002, -60.0037, -118.0692, -114.5638, -117.2625],
      phases: [0, 0.000718, 0.955176, 0.80022, 2.660784],
      residualRms: 0.000057056,
      noiseDb: -83.9591,
      frequency: 0.096923828,
      parts: [
        [0.500420025, 0.757837484, 0.922701091, 0.079588459],
        [-0.000449062, -0.000155989, 0.000341277, 0.000336638],
        [0.000029037, 0.000008934, -0.0000077, -0.000030078],
      ],
      spectrum: [59.986, 60.0034, [-60.0034, -118.0696, -114.5652, -117.2611]],
      samples: [0.5, 0.75769043, 0.923034668, 0.936157227, 0.07989502, 0.75769043],
    },
    both: {
      k: [0.007903464, 0.007898657, 0.011107977, 0.011036391],
      magnitudes: [0.901519168, 0.001602189, 0.000504548, 0.000000859, 0.000001015],
      db: [-0.005, -55.0102, -65.0465, -120.4264, -118.979],
      phases: [0, 0.001146, -0.000343, 1.746355, 1.941129],
      residualRms: 0.000057763,
      noiseDb: -83.8715,
      frequency: 0.096923828,
      parts: [
        [0.500769129, 0.758621514, 0.923763658, 0.079226491],
        [-0.000801728, -0.000520908, 0.000732087, 0.000481877],
        [0.000032599, 0.00001707, 0.000003766, 0.000003546],
      ],
      spectrum: [54.5894, 55.0052, [-55.0052, -65.0415, -120.4219, -118.9723]],
      samples: [0.5, 0.758117676, 0.924499512, 0.937683105, 0.079711914, 0.758117676],
    },
    buried: {
      k: [0.001405457, 0.001489171, 0.003512651, 0.003254423],
      magnitudes: [0.900482063, 0.000302258, 0.000148713, 0.000004823, 0.000008521],
      db: [-0.0091, -69.4911, -75.6516, -105.433, -100.4885],
      phases: [0, 0.059058, 0.060123, -2.674716, 2.232268],
      residualRms: 0.00056836,
      noiseDb: -64.0062,
      frequency: 0.096923826,
      parts: [
        [0.500128671, 0.757681856, 0.922627262, 0.079051946],
        [-0.000151921, -0.000129394, 0.000139491, 0.000079937],
        [0.000084285, -0.000167209, 0.000145845, -0.000274462],
      ],
      spectrum: [62.6857, 69.4824, [-69.4824, -75.6433, -105.4522, -100.4904]],
      samples: [0.500061035, 0.757385254, 0.922912598, 0.935913086, 0.078857422, 0.75769043],
    },
  };

  for (const [name, sheet] of Object.entries(sheets)) {
    it(`decomposes the ${name} capture as ADCToolbox does`, () => {
      const c = CASES[name];
      const x = capture(c);
      sheet.samples.forEach((v, k) => expect(x[[0, 1, 2, 3, 100, 2047][k]], `sample ${k}`).toBeCloseTo(v, 9));

      const d = decompose(x, 5);
      expect(d.frequency).toBeCloseTo(sheet.frequency, 9);
      sheet.magnitudes.forEach((v, h) => expect(d.magnitudes[h], `harmonic ${h + 1}`).toBeCloseTo(v, 9));
      sheet.db.forEach((v, h) => expect(d.db[h], `harmonic ${h + 1} in dB`).toBeCloseTo(v, 4));
      sheet.phases.forEach((v, h) => expect(d.phases[h], `phase ${h + 1}`).toBeCloseTo(v, 6));
      expect(d.residualRms).toBeCloseTo(sheet.residualRms, 9);
      expect(d.noiseDb).toBeCloseTo(sheet.noiseDb, 4);
      [0, 1, 2, 100].forEach((i, k) => {
        expect(d.fundamental[i], `fundamental at ${i}`).toBeCloseTo(sheet.parts[0][k], 9);
        expect(d.harmonic[i], `harmonics at ${i}`).toBeCloseTo(sheet.parts[1][k], 9);
        expect(d.residual[i], `residual at ${i}`).toBeCloseTo(sheet.parts[2][k], 9);
      });
      // the three parts add back up to the capture itself, which is what makes the split worth looking at
      [0, 7, 513, 4095].forEach((i) =>
        expect(d.fundamental[i] + d.harmonic[i] + d.residual[i], `the parts at ${i}`).toBeCloseTo(x[i], 9),
      );

      const s = fitStaticNonlin(x, 3);
      expect(hdToK(c.hd2, 2)).toBeCloseTo(sheet.k[0], 9);
      expect(s.k2).toBeCloseTo(sheet.k[1], 9);
      expect(hdToK(c.hd3, 3)).toBeCloseTo(sheet.k[2], 9);
      expect(s.k3).toBeCloseTo(sheet.k[3], 9);

      const spec = spectrumOf(x);
      expect(spec.sndr).toBeCloseTo(sheet.spectrum[0], 4);
      expect(spec.sfdr).toBeCloseTo(sheet.spectrum[1], 4);
      sheet.spectrum[2].forEach((v, h) =>
        expect(spec.dbfs[spec.harmonics[h]] - spec.dbfs[spec.signal], `spectrum harmonic ${h + 2}`).toBeCloseTo(v, 4),
      );
    });
  }

  it('finds the fundamental without being told where it is', () => {
    // the FFT estimate lands within a thousandth of a bin of the coherent frequency
    const x = capture(CASES.both);
    expect(estimateFrequency(x) * 4096).toBeCloseTo(397, 2);
    // and read() carries the same decomposition, static fit and spectrum as calling them one at a time
    const r = read(CASES.both);
    expect(r.decomposition.db[1]).toBeCloseTo(-55.0102, 4);
    expect(r.statik.k2).toBeCloseTo(0.007898657, 9);
    expect(r.k2).toBeCloseTo(0.007903464, 9);
    expect(r.spectrum.sndr).toBeCloseTo(54.5894, 4);
  });
});
