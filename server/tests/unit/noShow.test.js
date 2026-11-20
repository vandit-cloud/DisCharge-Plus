import { describe, expect, it } from 'vitest';
import {
  NO_SHOW_CUTOFFS, NO_SHOW_MODEL, noShowBand, noShowInputs, noShowReasons, predictNoShow,
} from '../../src/ml/noShow.js';
import { distanceToHospitalKm } from '../../src/rules/districtDistance.js';

const base = { age: 60, gender: 'female', protocol: 'general', leadDays: 7 };

describe('predictNoShow', () => {
  it('is the sigmoid of the intercept plus the weighted inputs', () => {
    const { weights, intercept } = NO_SHOW_MODEL;
    const z = intercept + weights.age * 60 + weights.logLeadDays * Math.log(8);
    expect(predictNoShow(base)).toBeCloseTo(1 / (1 + Math.exp(-z)), 10);
  });

  it('maps app fields onto the dataset columns', () => {
    expect(noShowInputs({ ...base, gender: 'male', protocol: 'cardiac' })).toMatchObject({ male: 1, hypertension: 1, diabetes: 0 });
    expect(noShowInputs({ ...base, gender: 'other', protocol: 'diabetes' })).toMatchObject({ male: 0, hypertension: 0, diabetes: 1 });
  });

  it('follows the trained weights: later visits, younger patients and earlier misses score higher', () => {
    expect(predictNoShow({ ...base, leadDays: 30 })).toBeGreaterThan(predictNoShow(base));
    expect(predictNoShow({ ...base, missedBefore: true })).toBeGreaterThan(predictNoShow(base));
    expect(predictNoShow({ ...base, age: 25 })).toBeGreaterThan(predictNoShow(base));
  });

  it('always returns a probability', () => {
    for (const leadDays of [0, 3, 90]) {
      const p = predictNoShow({ ...base, leadDays });
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThan(1);
    }
  });
});

describe('noShowReasons', () => {
  const calm = { missedBefore: false, adherencePercent: 90, daysInactive: 0, distanceKm: 40 };

  it('gives no reason for an engaged patient who lives near', () => {
    expect(noShowReasons(calm)).toEqual([]);
    expect(noShowReasons({ ...calm, adherencePercent: null, distanceKm: null })).toEqual([]);
  });

  it('flags each rule at its threshold', () => {
    expect(noShowReasons({ ...calm, missedBefore: true })).toEqual(['Missed an earlier follow-up']);
    expect(noShowReasons({ ...calm, adherencePercent: 59 })).toEqual(['Adherence 59%']);
    expect(noShowReasons({ ...calm, adherencePercent: 60 })).toEqual([]);
    expect(noShowReasons({ ...calm, daysInactive: 3 })).toEqual(['No app activity for 3 days']);
    expect(noShowReasons({ ...calm, daysInactive: 2 })).toEqual([]);
    expect(noShowReasons({ ...calm, distanceKm: 100 })).toEqual(['Lives ~100 km away']);
  });
});

describe('distanceToHospitalKm', () => {
  it('is 0 for the hospital district and grows with distance', () => {
    expect(distanceToHospitalKm('Vadodara')).toBe(0);
    expect(distanceToHospitalKm('Anand')).toBeLessThan(50);
    expect(distanceToHospitalKm('Kutch')).toBeGreaterThan(300);
  });

  it('is null for a district not in the table', () => {
    expect(distanceToHospitalKm('Atlantis')).toBeNull();
  });
});

describe('noShowBand', () => {
  const { moderate, high } = NO_SHOW_CUTOFFS;

  it('takes its cut-offs from the training score percentiles', () => {
    expect(moderate).toBe(NO_SHOW_MODEL.metrics.scorePercentiles.p50);
    expect(high).toBe(NO_SHOW_MODEL.metrics.scorePercentiles.p75);
  });

  it('bands by score, with each cut-off belonging to the higher band', () => {
    expect(noShowBand(0.1)).toBe('low');
    expect(noShowBand(moderate - 0.001)).toBe('low');
    expect(noShowBand(moderate)).toBe('moderate');
    expect(noShowBand(high - 0.001)).toBe('moderate');
    expect(noShowBand(high)).toBe('high');
    expect(noShowBand(0.9)).toBe('high');
  });

  it('moves up one level for two or more rule reasons, never past high', () => {
    const two = ['Adherence 40%', 'Lives ~180 km away'];
    expect(noShowBand(0.1, ['Lives ~180 km away'])).toBe('low');
    expect(noShowBand(0.1, two)).toBe('moderate');
    expect(noShowBand(moderate, two)).toBe('high');
    expect(noShowBand(0.9, two)).toBe('high');
  });

  it('does not count the earlier miss again: the model already has it', () => {
    expect(noShowBand(0.1, ['Missed an earlier follow-up', 'Lives ~180 km away'])).toBe('low');
  });
});
