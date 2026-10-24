import { PROTOCOL_TEMPLATES } from '../rules/protocols.js';
import { addDays } from '../utils/time.js';

/**
 * FollowUp records for a plan: one per template entry, on dischargeDate + dayOffset.
 * @param {{ _id, dischargeDate: Date, followUpProtocol: string }} plan
 */
export function generateFollowUps(plan, templates = PROTOCOL_TEMPLATES) {
  const template = templates[plan.followUpProtocol];
  if (!template) throw new Error(`No follow-up template for protocol "${plan.followUpProtocol}"`);
  return template.followUps.map(({ dayOffset, type, description }) => ({
    planId: plan._id,
    scheduledDate: addDays(plan.dischargeDate, dayOffset),
    type,
    description,
    status: 'scheduled',
  }));
}
