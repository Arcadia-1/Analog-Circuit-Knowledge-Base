import { describe, expect, it } from 'vitest';
import {
  capture,
  fitSine,
  floorModel,
  ifilter,
  ntfperf,
  ntfTaps,
  OSRS,
  perfosr,
  read,
  rms,
  spectrumOf,
  TONE,
  whiteSnr,
} from '../src/illustrations/oversampling/model';
import { analyzeSpectrum, inbandBins } from '../src/lib/spectrum';

describe('oversampling and noise shaping', () => {
  // from python/adc_oversampling.py: 8192 samples at 100 MHz, a 0.4 V tone on a ±0.5 V range
  it('tests at exp_o03’s tone', () => {
    expect(TONE.bin).toBe(13);
    expect(TONE.fin / 1e3).toBeCloseTo(158.691, 3);
  });

  // ntfperf of (1 − z⁻¹)^order at OSR 1, 2, 4 … 256
  const gains = [
    [0, 3.01, 6.021, 9.031, 12.041, 15.052, 18.062, 21.072, 24.083],
    [-3.01, 4.396, 13.024, 21.954, 30.96, 39.985, 49.015, 58.045, 67.075],
    [-7.782, 3.434, 17.526, 32.338, 47.33, 62.367, 77.415, 92.465, 107.514],
    [-13.01, 1.785, 21.288, 41.969, 62.943, 83.991, 105.058, 126.127, 147.197],
  ];
  it('integrates the NTF over the band as ntfperf does', () => {
    gains.forEach((row, order) => OSRS.forEach((osr, i) => expect(ntfperf(order, osr)).toBeCloseTo(row[i], 3)));
  });

  // [bits, order, SNDR and SFDR over the whole band, the same at OSR 32, perfosr's SNDR at each OSR,
  //  rms of the record, of ifilter's band to fs/64, and of what it leaves out]
  const cases: [number, number, number[], number[], number[], number[]][] = [
    [4, 0, [24.215, 33.15], [37.155, 40.765], [24.219, 24.592, 25.141, 26.375, 32.179, 37.22, 40.172, 55.148, 55.617], [2.860145e-1, 2.855017e-1, 1.711905e-2]],
    [4, 1, [27.194, 40.688], [62.149, 66.956], [27.182, 30.389, 33.674, 37.469, 50.077, 63.464, 69.723, 86.271, 86.518], [2.831126e-1, 2.828429e-1, 1.235324e-2]],
    [4, 2, [23.961, 38.641], [85.343, 90.011], [23.948, 31.244, 39.239, 47.18, 66.585, 87.934, 98.096, 108.624, 108.643], [2.834101e-1, 2.828426e-1, 1.792733e-2]],
    [4, 3, [19.189, 32.762], [108.851, 113.138], [19.177, 30.198, 43.174, 56.392, 82.757, 111.297, 126.091, 151.966, 152.192], [2.84542e-1, 2.828427e-1, 3.105106e-2]],
    [10, 0, [60.085, 81.621], [74.219, 83.82], [60.094, 62.666, 65.191, 68.06, 71.093, 74.528, 76.487, 78.191, 81.77], [2.828445e-1, 2.828444e-1, 2.746274e-4]],
    [10, 1, [57.532, 78.676], [99.291, 108.636], [57.511, 64.615, 72.558, 80.732, 89.894, 100.525, 108.332, 113.772, 121.401], [2.82843e-1, 2.828427e-1, 3.757912e-4]],
    [10, 2, [52.823, 72.676], [120.378, 129.824], [52.8, 63.81, 77.401, 90.742, 106.232, 122.985, 136.234, 141.496, 142.648], [2.828435e-1, 2.828427e-1, 6.46225e-4]],
    [10, 3, [47.615, 66.676], [143.133, 150.622], [47.585, 62.185, 81.407, 99.989, 121.904, 144.647, 165.208, 178.1, 181.605], [2.828452e-1, 2.828427e-1, 1.177105e-3]],
  ];
  it.each(cases)('matches ADCToolbox for a %i-bit quantiser shaped to order %i', (bits, order, full, band, sweep, levels) => {
    const data = capture(order, bits);
    for (const [osr, [sndr, sfdr]] of [[1, full], [32, band]] as const) {
      const s = spectrumOf(data, bits, osr);
      expect(s.sndr).toBeCloseTo(sndr, 2);
      expect(s.sfdr).toBeCloseTo(sfdr, 2);
    }
    perfosr(data, OSRS).forEach((v, i) => expect(v).toBeCloseTo(sweep[i], 2));
    const inband = ifilter(data, 0, 0.5 / 32);
    const [whole, kept, left] = [data, inband, data.map((v, i) => v - inband[i])].map(rms);
    expect(whole / levels[0]).toBeCloseTo(1, 5);
    expect(kept / levels[1]).toBeCloseTo(1, 5);
    expect(left / levels[2]).toBeCloseTo(1, 5);
  });

  // what the page is about: shaping makes the total noise worse and the in-band noise far better
  it('trades noise out of the band for noise in it', () => {
    const r = [0, 1, 2, 3].map((order) => read(order, 4, 32));
    for (let order = 1; order < 4; order++) {
      expect(r[order].full.sndr).toBeLessThan(r[0].full.sndr + 4);
      expect(r[order].band.sndr).toBeGreaterThan(r[order - 1].band.sndr + 20);
    }
    // and each doubling of OSR buys about 6 dB per order plus 3, once the band is narrow enough
    const slope = (order: number) => ntfperf(order, 64) - ntfperf(order, 32);
    [3.01, 9.03, 15.05, 21.07].forEach((db, order) => expect(slope(order)).toBeCloseTo(db, 1));
  });

  it('predicts the measured sweep from white noise and the NTF, where the error is noise-like', () => {
    // ten bits leave a clean tone's quantisation error busy enough to pass for white noise up to OSR 32
    for (const order of [0, 1, 2]) {
      const r = read(order, 10, 32);
      [1, 2, 4, 8, 16, 32].forEach((osr) => {
        const i = OSRS.indexOf(osr);
        expect(Math.abs(r.sweep[i] - r.theory[i])).toBeLessThan(2.5);
      });
    }
    // (0.4² / 2) / ((1/16)² / 12)
    expect(whiteSnr(4)).toBeCloseTo(10 * Math.log10(0.08 * 3072), 9);
  });

  it('draws the dashed floor where the measured noise sits', () => {
    // the mean power of a stretch of bins, against the model's value in its middle
    for (const order of [0, 1, 2]) {
      const s = spectrumOf(capture(order, 10), 10, 1);
      let power = 0;
      for (let k = 1500; k < 1700; k++) power += 10 ** (s.dbfs[k] / 10) / 200;
      expect(10 * Math.log10(power)).toBeCloseTo(floorModel(10, order)(1600), -0.5);
    }
  });

  it('builds the NTF from the binomial coefficients', () => {
    expect([0, 1, 2, 3].map(ntfTaps)).toEqual([[1], [1, -1], [1, -2, 1], [1, -3, 3, -1]]);
  });

  it('counts the in-band bins the way rfft_inband_bin_count does', () => {
    expect(OSRS.map((osr) => inbandBins(8192, osr))).toEqual([4097, 2049, 1025, 513, 257, 129, 65, 33, 17]);
    expect(inbandBins(12288, 3)).toBe(2049);
    // and an OSR of 1 reads the whole spectrum, as before
    const x = capture(0, 10);
    expect(analyzeSpectrum(x, 10, 'rectangular', 0, 1).sndr).toBe(analyzeSpectrum(x, 10).sndr);
  });

  it('fits the tone with fit_sine_4param’s frequency estimate and one refinement', () => {
    const fit = fitSine(capture(2, 6));
    expect(fit.frequency * 8192).toBeCloseTo(13, 4);
    expect(fit.amplitude).toBeCloseTo(0.4, 3);
  });

  it('keeps the band and its mirror and nothing else', () => {
    const x = Float64Array.from({ length: 64 }, (_, i) => Math.cos((2 * Math.PI * 3 * i) / 64) + Math.cos((2 * Math.PI * 20 * i) / 64));
    const y = ifilter(x, 0, 5 / 64);
    y.forEach((v, i) => expect(v).toBeCloseTo(Math.cos((2 * Math.PI * 3 * i) / 64), 12));
  });
});
