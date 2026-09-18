import { describe, expect, it } from 'vitest';
import {
  bins,
  enobAtWalden,
  ladder,
  N_FFT,
  PARTS,
  sndrAtSchreier,
  walls,
  type Part,
} from '../src/illustrations/conversions/model';
import {
  amplitudesToSnr,
  binToFreq,
  dbmToMw,
  dbmToVrms,
  dbToMag,
  dbToPower,
  enobToSnr,
  lsbToVolts,
  magToDb,
  mwToDbm,
  powerToDb,
  sineAmplitudeToPower,
  snrToEnob,
  thermalLimit,
  voltsToLsb,
  vrmsToDbm,
} from '../src/lib/units';

describe('what a conversion costs', () => {
  // every number below is printed by python/adc_conversions.py, which calls ADCToolbox itself

  it('goes round the unit conversions and back', () => {
    // dB, magnitude, and the dB it converts back to
    ([
      [-80, 0.0001, -80],
      [-40, 0.01, -40],
      [-6.02, 0.500034535, -6.02],
      [0, 1, 0],
      [20, 10, 20],
    ] as [number, number, number][]).forEach(([db, mag, back]) => {
      expect(dbToMag(db)).toBeCloseTo(mag, 9);
      expect(magToDb(dbToMag(db))).toBeCloseTo(back, 4);
    });
    ([
      [-3.01, 0.500035],
      [0, 1],
      [10, 10],
      [30, 1000],
    ] as [number, number][]).forEach(([db, power]) => {
      expect(dbToPower(db)).toBeCloseTo(power, 6);
      expect(powerToDb(dbToPower(db))).toBeCloseTo(db, 4);
    });
    // volts on a 1 V range at 12 bits, and the LSB count they come to
    ([
      [1e-6, 0.004096],
      [1e-3, 4.096],
      [0.25, 1024],
      [0.5, 2048],
    ] as [number, number][]).forEach(([v, lsb]) => {
      expect(voltsToLsb(v, 1, 12)).toBeCloseTo(lsb, 6);
      expect(lsbToVolts(voltsToLsb(v, 1, 12), 1, 12)).toBeCloseTo(v, 9);
    });
    // SNR, its ENOB, and the SNR that comes back
    ([
      [40, 6.3522, 40],
      [61.96, 10, 61.96],
      [74, 12, 74],
      [100, 16.3189, 100],
    ] as [number, number, number][]).forEach(([snr, enob, back]) => {
      expect(snrToEnob(snr)).toBeCloseTo(enob, 4);
      expect(enobToSnr(snrToEnob(snr))).toBeCloseTo(back, 4);
    });
    // dBm into 50 Ω: the rms it is, and the milliwatts it is
    ([
      [-30, 0.007071068, 0.001],
      [-10, 0.070710678, 0.1],
      [0, 0.223606798, 1],
      [13, 0.998814876, 19.952623],
    ] as [number, number, number][]).forEach(([dbm, vrms, mw]) => {
      expect(dbmToVrms(dbm)).toBeCloseTo(vrms, 9);
      expect(vrmsToDbm(dbmToVrms(dbm))).toBeCloseTo(dbm, 4);
      expect(dbmToMw(dbm)).toBeCloseTo(mw, 6);
      expect(mwToDbm(dbmToMw(dbm))).toBeCloseTo(dbm, 4);
    });
    ([
      [0.1, 0.0001],
      [0.5, 0.0025],
      [1, 0.01],
    ] as [number, number][]).forEach(([amp, watts]) => expect(sineAmplitudeToPower(amp)).toBeCloseTo(watts, 9));
  });

  it('rounds a frequency to a bin, which does not always take it back', () => {
    // frequency in MHz, the bin of a 4096-point FFT at 1 GS/s, and the frequency that bin stands for
    ([
      [1, 4, 0.976562],
      [96.923828, 397, 96.923828],
      [250, 1024, 250],
      [499.9, 2048, 500],
    ] as [number, number, number][]).forEach(([mhz, bin, back]) => {
      const r = bins(mhz * 1e6, 1e9);
      expect(r.bin).toBe(bin);
      expect(r.back / 1e6).toBeCloseTo(back, 6);
      expect(binToFreq(bin, 1e9, N_FFT) / 1e6).toBeCloseTo(back, 6);
    });
  });

  // part: bandwidth kHz, ENOB, NSD dBFS/Hz, noise µV, noise LSB, one LSB µV, signal dBm, Walden fJ, Schreier dB
  const sheets: Record<string, [number, number, number, number, number, number, number, number, number]> = {
    audio: [48, 16.3189, -146.8124, 7.071068, 59.316416, 0.119209, 10, 5.9728, 172.0412],
    sensor: [500, 9.6744, -116.9897, 353.553391, 1.448155, 244.140625, 3.9794, 24.476, 163.9794],
    radio: [250000, 10.505, -148.9794, 198.817682, 3.257429, 61.035156, 3.9794, 82.5783, 161.1979],
    scope: [5000000, 6.3522, -136.9897, 1767.766953, 0.905097, 1953.125, -2.0412, 1836.1186, 135.2288],
  };

  for (const [name, row] of Object.entries(sheets)) {
    it(`writes the ${name} part every way a datasheet writes it`, () => {
      const [bw, enob, nsd, noiseUv, noiseLsb, lsbUv, dbm, walden, schreier] = row;
      const d = ladder(PARTS[name]);
      expect(d.bw / 1e3).toBeCloseTo(bw, 4);
      expect(d.enob).toBeCloseTo(enob, 4);
      expect(d.back).toBeCloseTo(PARTS[name].sndr, 4);
      expect(d.nsd).toBeCloseTo(nsd, 4);
      expect(d.fromNsd).toBeCloseTo(PARTS[name].sndr, 4);
      expect(d.noiseV * 1e6).toBeCloseTo(noiseUv, 6);
      expect(d.noiseLsb).toBeCloseTo(noiseLsb, 6);
      expect(d.lsbV * 1e6).toBeCloseTo(lsbUv, 6);
      expect(d.fromAmplitudes).toBeCloseTo(PARTS[name].sndr, 4);
      expect(d.signalDbm).toBeCloseTo(dbm, 4);
      expect(d.walden * 1e15).toBeCloseTo(walden, 4);
      expect(d.schreier).toBeCloseTo(schreier, 4);
    });
  }

  it('draws what a fixed figure of merit buys', () => {
    // fs MHz, then the ENOB 10, 100 and 1000 fJ per conversion step buy at 10 mW
    ([
      [1, 19.9316, 16.6096, 13.2877],
      [10, 16.6096, 13.2877, 9.9658],
      [100, 13.2877, 9.9658, 6.6439],
      [1000, 9.9658, 6.6439, 3.3219],
      [10000, 6.6439, 3.3219, 0],
      [100000, 3.3219, 0, -3.3219],
    ] as [number, number, number, number][]).forEach(([mhz, ...enobs]) =>
      [10e-15, 100e-15, 1000e-15].forEach((fom, i) => expect(enobAtWalden(10e-3, fom, mhz * 1e6)).toBeCloseTo(enobs[i], 4)),
    );
    // BW MHz, then the SNDR 160, 170, 180 and 190 dB buy at 10 mW
    ([
      [0.1, 90, 100, 110, 120],
      [1, 80, 90, 100, 110],
      [10, 70, 80, 90, 100],
      [100, 60, 70, 80, 90],
      [1000, 50, 60, 70, 80],
      [10000, 40, 50, 60, 70],
    ] as [number, number, number, number, number][]).forEach(([mhz, ...sndrs]) =>
      [160, 170, 180, 190].forEach((fom, i) => expect(sndrAtSchreier(10e-3, fom, mhz * 1e6)).toBeCloseTo(sndrs[i], 4)),
    );
  });

  it('stands the walls in front of the part', () => {
    const part: Part = { ...PARTS.radio, vfs: 1, bits: 14 };
    // input MHz, then the SNR 10, 50, 100 and 500 fs of clock jitter allow
    ([
      [1, 144.0364, 130.057, 124.0364, 110.057],
      [10, 124.0364, 110.057, 104.0364, 90.057],
      [100, 104.0364, 90.057, 84.0364, 70.057],
      [1000, 84.0364, 70.057, 64.0364, 50.057],
      [5000, 70.057, 56.0776, 50.057, 36.0776],
    ] as [number, number, number, number, number][]).forEach(([mhz, ...limits]) =>
      [1e-14, 5e-14, 1e-13, 5e-13].forEach((tj, i) =>
        expect(walls(part, mhz * 1e6, tj, 1).jitter).toBeCloseTo(limits[i], 4),
      ),
    );
    // sampling capacitance in pF, the SNR its kT/C leaves on a 1 V range, and what that is in bits
    ([
      [0.01, 54.7991, 8.8105],
      [0.1, 64.7991, 10.4716],
      [1, 74.7991, 12.1327],
      [10, 84.7991, 13.7939],
      [100, 94.7991, 15.455],
    ] as [number, number, number][]).forEach(([pf, limit, enob]) => {
      expect(thermalLimit(pf, 1)).toBeCloseTo(limit, 4);
      expect(snrToEnob(thermalLimit(pf, 1))).toBeCloseTo(enob, 4);
    });
    // and what oversampling gives back, the gain amplitudes_to_snr has built in
    ([[1, 0], [2, 3.0103], [8, 9.0309], [64, 18.0618], [256, 24.0824]] as [number, number][]).forEach(([osr, gain]) => {
      expect(amplitudesToSnr(0.5, 1e-3, osr) - amplitudesToSnr(0.5, 1e-3)).toBeCloseTo(gain, 4);
      expect(walls({ ...part, osr }, 100e6, 1e-13, 1).gain).toBeCloseTo(gain, 4);
      expect(walls({ ...part, osr }, 100e6, 1e-13, 1).thermal).toBeCloseTo(74.7991 + gain, 4);
    });
    // the radio part at 100 MHz with a 100 fs clock and 1 pF: the clock allows 84.04 dB and its own codes 86.04, so
    // the sampling capacitor is the nearest wall, and the part still has 9.8 dB of room before it
    const w = walls(part, 100e6, 1e-13, 1);
    expect(w.jitter).toBeCloseTo(84.0364, 4);
    expect(w.quantiser).toBeCloseTo(86.04, 4);
    expect(w.nearest).toBe('thermal');
    expect(w.headroom).toBeCloseTo(74.7991 - 65, 4);
  });
});
