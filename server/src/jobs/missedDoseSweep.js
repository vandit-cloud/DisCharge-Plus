import cron from 'node-cron';
import { env } from '../config/env.js';
import { AdherenceRecord, DischargePlan, Escalation, Prescription } from '../models/index.js';
import { MISSED_DOSE_RULE } from '../rules/redFlagRules.js';
import { addMinutes } from '../utils/time.js';

/**
 * Marks every dose still pending after its grace window as missed (FR-3.4). A missed dose of a
 * critical prescription on an active plan raises an escalation (FR-3.5).
 *
 * Safe to run any number of times (FR-3.6):
 * - a dose only moves pending -> missed once (conditional update);
 * - the escalation is created BEFORE the dose is marked, and a unique index allows one
 *   escalation per dose. If the job crashes in between, the next run finds the dose still
 *   pending, the duplicate escalation is rejected, and the dose is then marked.
 * The patient can no longer mark these doses (their window has closed), so there is no race.
 *
 * @param {Date} now passed in so tests can control time
 */
export async function sweepMissedDoses(now = new Date(), graceMinutes = env.doseGraceMinutes) {
  const cutoff = addMinutes(now, -graceMinutes);
  const due = await AdherenceRecord.find({ status: 'pending', scheduledAt: { $lt: cutoff } });
  if (due.length === 0) return { checked: 0, markedMissed: 0, escalationsRaised: 0 };

  const prescriptions = await Prescription.find({ _id: { $in: [...new Set(due.map((d) => d.prescriptionId))] } });
  const plans = await DischargePlan.find({ _id: { $in: [...new Set(prescriptions.map((p) => p.planId))] } });
  const prescriptionById = new Map(prescriptions.map((p) => [String(p._id), p]));
  const planById = new Map(plans.map((p) => [String(p._id), p]));

  let markedMissed = 0;
  let escalationsRaised = 0;
  for (const dose of due) {
    const prescription = prescriptionById.get(String(dose.prescriptionId));
    const plan = prescription && planById.get(String(prescription.planId));
    if (prescription?.isCritical && plan?.status === 'active') {
      try {
        await Escalation.create({
          patientId: plan.patientId,
          adherenceId: dose._id,
          assignedClinicianId: plan.clinicianId,
          source: 'missed_critical_dose',
          tier: MISSED_DOSE_RULE.tier,
          triggeredRules: [MISSED_DOSE_RULE.id],
          status: 'open',
        });
        escalationsRaised += 1;
      } catch (err) {
        if (err?.code !== 11000) throw err; // already escalated on an earlier run
      }
    }
    const result = await AdherenceRecord.updateOne({ _id: dose._id, status: 'pending' }, { $set: { status: 'missed' } });
    markedMissed += result.modifiedCount;
  }
  return { checked: due.length, markedMissed, escalationsRaised };
}

export function startMissedDoseJob() {
  return cron.schedule(
    env.cronSchedule,
    async () => {
      try {
        const result = await sweepMissedDoses(new Date());
        if (result.checked > 0) console.log(`[missed-dose sweep] ${JSON.stringify(result)}`);
      } catch (err) {
        console.error('[missed-dose sweep] failed:', err);
      }
    },
    { name: 'missed-dose-sweep', noOverlap: true },
  );
}
