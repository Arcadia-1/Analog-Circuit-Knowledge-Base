import { describe, expect, it } from 'vitest';
import { crossingTime, stepMetrics, stepResponse, twoPoleModel } from '../src/illustrations/amplifier/twoPoleModel';
import { featuredLessons } from '../src/data/illustrations';
import { isPublicLessonPath } from '../src/data/publication';

describe('stable two-real-pole step response', () => {
  it('uses the repeated-pole limit without a singularity', () => {
    const model = twoPoleModel(100, 100), omega = 2 * Math.PI * 100;
    for (const time of [0, 1e-5, 1e-3, 1e-2]) {
      expect(stepResponse(model, time)).toBeCloseTo(1 - (1 + omega * time) * Math.exp(-omega * time), 14);
    }
  });

  it('starts at rest, rises monotonically and converges to unity', () => {
    const model = twoPoleModel(10, 1000);
    let previous = -1;
    for (let i = 0; i <= 1000; i++) {
      const value = stepResponse(model, i / 1000);
      expect(value).toBeGreaterThanOrEqual(previous);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
      previous = value;
    }
    expect(stepResponse(model, 0)).toBe(0);
    expect(stepResponse(model, 1)).toBeCloseTo(1, 12);
  });

  it('preserves the second-order time-scaling law', () => {
    const base = twoPoleModel(10, 250), scaled = twoPoleModel(1000, 25000);
    for (const time of [1e-5, 1e-4, 1e-3, 1e-2]) {
      expect(stepResponse(base, time)).toBeCloseTo(stepResponse(scaled, time / 100), 13);
    }
  });

  it('reports exact threshold crossings and consistent timing metrics', () => {
    for (const pair of [[1, 1], [1, 1.01], [10, 1000], [1e5, 1e5]] as const) {
      const model = twoPoleModel(pair[0], pair[1]), metrics = stepMetrics(model);
      expect(stepResponse(model, metrics.t10)).toBeCloseTo(.1, 13);
      expect(stepResponse(model, metrics.t90)).toBeCloseTo(.9, 13);
      expect(stepResponse(model, metrics.settlingTime)).toBeCloseTo(.98, 13);
      expect(metrics.riseTime).toBeCloseTo(metrics.t90 - metrics.t10, 15);
      expect(crossingTime(model, .5)).toBeGreaterThan(metrics.t10);
      expect(crossingTime(model, .5)).toBeLessThan(metrics.t90);
    }
  });

  it('rejects unstable or undefined inputs', () => {
    expect(() => twoPoleModel(0, 10)).toThrow(RangeError);
    expect(() => twoPoleModel(10, -1)).toThrow(RangeError);
    expect(() => twoPoleModel(10, NaN)).toThrow(RangeError);
    expect(() => stepResponse(twoPoleModel(10, 20), -1)).toThrow(RangeError);
    expect(() => crossingTime(twoPoleModel(10, 20), 1)).toThrow(RangeError);
  });

  it('publishes the lesson with its own visual preview', () => {
    const path = '/amplifiers/two-pole-step-response/';
    expect(isPublicLessonPath(path)).toBe(true);
    expect(featuredLessons.find((item) => item.href === path)).toMatchObject({ category: 'Circuits & Systems', thumb: 'two-pole-step' });
  });
});
