import { describe, expect, it } from 'vitest';
import { generateDoses } from '../../src/services/doseGenerator.js';
import { generateFollowUps } from '../../src/services/followUpGenerator.js';
import { PROTOCOL_TEMPLATES } from '../../src/rules/protocols.js';
import { parseDateOnly } from '../../src/utils/time.js';

const discharge = parseDateOnly('2026-10-06');

describe('generateDoses', () => {
  it('AC-4: BD x 5 days + OD x 5 days = 15 pending doses', () => {
    const bd = generateDoses({ _id: 'a', timingSlots: ['morning', 'night'], durationDays: 5 }, discharge);
    const od = generateDoses({ _id: 'b', timingSlots: ['morning'], durationDays: 5 }, discharge);
    expect(bd).toHaveLength(10);
    expect(od).toHaveLength(5);
    expect([...bd, ...od].every((d) => d.status === 'pending')).toBe(true);
  });

  it('puts doses at the IST slot times, in time order, starting on discharge day', () => {
    const doses = generateDoses({ _id: 'a', timingSlots: ['night', 'morning'], durationDays: 2 }, discharge);
    expect(doses.map((d) => d.scheduledAt.toISOString())).toEqual([
      '2026-10-06T02:30:00.000Z', // 08:00 IST
      '2026-10-06T15:30:00.000Z', // 21:00 IST
      '2026-10-07T02:30:00.000Z',
      '2026-10-07T15:30:00.000Z',
    ]);
  });

  it('skips doses before notBefore (already given in hospital)', () => {
    const notBefore = new Date('2026-10-06T09:30:00Z'); // 15:00 IST on discharge day
    const doses = generateDoses({ _id: 'a', timingSlots: ['morning', 'night'], durationDays: 2 }, discharge, { notBefore });
    expect(doses).toHaveLength(3); // discharge-day morning dose skipped
    expect(doses[0].scheduledAt.toISOString()).toBe('2026-10-06T15:30:00.000Z');
  });

  it('handles a 1-day QID course', () => {
    const doses = generateDoses({ _id: 'a', timingSlots: ['morning', 'afternoon', 'evening', 'night'], durationDays: 1 }, discharge);
    expect(doses).toHaveLength(4);
  });
});

describe('generateFollowUps', () => {
  it('creates one follow-up per template entry on dischargeDate + dayOffset', () => {
    const followUps = generateFollowUps({ _id: 'p', dischargeDate: discharge, followUpProtocol: 'cardiac' });
    expect(followUps).toHaveLength(PROTOCOL_TEMPLATES.cardiac.followUps.length);
    expect(followUps[0]).toMatchObject({ planId: 'p', type: 'phone_check', status: 'scheduled' });
    expect(followUps[0].scheduledDate.toISOString()).toBe('2026-10-09T00:00:00.000Z'); // day 3
  });

  it('has a template with a source for every protocol', () => {
    for (const protocol of ['cardiac', 'diabetes', 'ckd', 'post_surgical', 'general']) {
      expect(PROTOCOL_TEMPLATES[protocol].followUps.length).toBeGreaterThan(0);
      expect(PROTOCOL_TEMPLATES[protocol].source.length).toBeGreaterThan(10);
    }
  });

  it('throws for an unknown protocol', () => {
    expect(() => generateFollowUps({ _id: 'p', dischargeDate: discharge, followUpProtocol: 'nope' })).toThrow();
  });
});
