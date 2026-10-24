import { Escalation, SymptomLog } from '../models/index.js';
import { describeRule } from '../rules/redFlagRules.js';
import { currentPlan } from './planService.js';
import { evaluate } from './ruleEngine.js';

export function symptomLogJSON(log) {
  return { ...log.toJSON(), reasons: log.triggeredRules.map(describeRule) };
}

/**
 * Report symptom -> rule engine -> escalation (the sequence diagram, FR-4.4 to FR-4.8).
 * 1. Save the log first, so every report is kept even if a later step fails.
 * 2. Evaluate the rules against the active plan (none -> only rules for all protocols).
 * 3. Store tier + matched rules on the log, whatever the tier.
 * 4. Tier above self_care -> escalate to the clinician of the active plan, or else of the latest
 *    plan. A patient who has never had a plan has no clinician: the report is kept, the result
 *    screen tells them to seek care, and clinicianAlerted is false.
 */
export async function reportSymptoms(patientId, { symptoms, severity }, now = new Date()) {
  const log = await SymptomLog.create({ patientId, symptoms, severity, reportedAt: now });

  const plan = await currentPlan(patientId); // active, or else the latest
  const activePlan = plan?.status === 'active' ? plan : null;
  const { tier, triggeredRules } = evaluate(log, activePlan);
  log.triageTier = tier;
  log.triggeredRules = triggeredRules;
  await log.save();

  let escalation = null;
  if (tier !== 'self_care') {
    if (plan) {
      escalation = await Escalation.create({
        patientId,
        symptomLogId: log._id,
        assignedClinicianId: plan.clinicianId,
        source: 'symptom_log',
        tier,
        triggeredRules,
        status: 'open',
      });
    }
  }
  return {
    symptomLog: symptomLogJSON(log),
    escalation: escalation?.toJSON() ?? null,
    clinicianAlerted: Boolean(escalation),
  };
}

export async function listSymptoms(patientId) {
  const logs = await SymptomLog.find({ patientId }).sort({ reportedAt: -1 }).limit(100);
  return logs.map(symptomLogJSON);
}
