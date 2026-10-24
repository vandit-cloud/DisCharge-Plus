import { describe, expect, it } from 'vitest';
import { computeRiskBand } from '../../src/services/riskBand.js';
import { atIstTime, daysBetween, istDayRange, istToday, parseDateOnly } from '../../src/utils/time.js';

describe('computeRiskBand', () => {
  const band = (adherencePercent, openEscalations, daysSinceDischarge) =>
    computeRiskBand({ adherencePercent, openEscalations, daysSinceDischarge }).band;

  it('is low for a stable patient after the first week', () => {
    expect(band(95, 0, 20)).toBe('low');
    expect(band(null, 0, 20)).toBe('low');
  });

  it('is moderate in the first week or with small problems', () => {
    expect(band(100, 0, 3)).toBe('moderate');
    expect(band(70, 0, 20)).toBe('moderate');
    expect(band(90, 1, 20)).toBe('moderate');
  });

  it('is high when problems add up to 3 points', () => {
    expect(band(50, 1, 20)).toBe('high'); // 2 + 1
    expect(band(90, 2, 6)).toBe('high'); // 2 + 1
    expect(band(75, 1, 5)).toBe('high'); // 1 + 1 + 1
  });

  it('is always high while an emergency escalation is open', () => {
    expect(computeRiskBand({ adherencePercent: 100, openEscalations: 1, openEmergencies: 1, daysSinceDischarge: 20 }).band).toBe('high');
  });

  it('explains every point it adds', () => {
    expect(computeRiskBand({ adherencePercent: 50, openEscalations: 2, daysSinceDischarge: 6 }).reasons).toHaveLength(3);
  });
});

describe('time helpers (IST)', () => {
  it('rejects impossible dates', () => {
    expect(parseDateOnly('2026-02-30')).toBeNull();
    expect(parseDateOnly('06-10-2026')).toBeNull();
    expect(parseDateOnly('2026-10-06').toISOString()).toBe('2026-10-06T00:00:00.000Z');
  });

  it('knows that 23:30 IST and 00:30 IST are different days', () => {
    expect(istToday(new Date('2026-10-06T18:00:00Z')).toISOString()).toBe('2026-10-06T00:00:00.000Z'); // 23:30 IST
    expect(istToday(new Date('2026-10-06T19:00:00Z')).toISOString()).toBe('2026-10-07T00:00:00.000Z'); // 00:30 IST
  });

  it('converts IST clock times and day ranges to UTC instants', () => {
    const day = parseDateOnly('2026-10-06');
    expect(atIstTime(day, '08:00').toISOString()).toBe('2026-10-06T02:30:00.000Z');
    expect(istDayRange(day).start.toISOString()).toBe('2026-10-05T18:30:00.000Z');
    expect(daysBetween(day, parseDateOnly('2026-10-12'))).toBe(6);
  });
});
