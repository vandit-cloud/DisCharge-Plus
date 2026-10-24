import { TIMING_SLOTS } from '../models/enums.js';
import { SLOT_TIMES, addDays, atIstTime } from '../utils/time.js';

/**
 * One pending AdherenceRecord per dose: every day of the course (day 0 = discharge day)
 * x every timing slot, at the slot's IST clock time.
 *
 * Doses scheduled before `notBefore` are skipped: they fall before the plan existed (for example
 * the morning dose of discharge day, given in hospital). Without this, saving a plan in the
 * afternoon would mark the morning dose missed at once and raise a false escalation.
 *
 * @param {{ _id, timingSlots: string[], durationDays: number }} prescription
 * @param {Date} dischargeDate calendar date
 * @param {{ notBefore?: Date }} options
 * @returns {{ prescriptionId, scheduledAt: Date, status: 'pending' }[]} sorted by time
 */
export function generateDoses(prescription, dischargeDate, { notBefore } = {}) {
  const slots = TIMING_SLOTS.filter((slot) => prescription.timingSlots.includes(slot));
  const doses = [];
  for (let day = 0; day < prescription.durationDays; day += 1) {
    const date = addDays(dischargeDate, day);
    for (const slot of slots) {
      const scheduledAt = atIstTime(date, SLOT_TIMES[slot]);
      if (notBefore && scheduledAt < notBefore) continue;
      doses.push({ prescriptionId: prescription._id, scheduledAt, status: 'pending' });
    }
  }
  return doses;
}
