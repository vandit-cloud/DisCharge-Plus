import { env } from '../config/env.js';
import { AdherenceRecord, DischargePlan, Prescription } from '../models/index.js';
import { conflict, forbidden, notFound } from '../utils/httpError.js';
import {
  IST_OFFSET_MINUTES, SLOT_TIMES, addDays, addMinutes, istDayRange, istToday,
} from '../utils/time.js';
import { currentPlan, prescriptionJSON } from './planService.js';

// A dose can be marked from 1 hour before its time until the grace window closes (FR-3.3).
const EARLY_MARK_MINUTES = 60;

function markWindow(scheduledAt, graceMinutes = env.doseGraceMinutes) {
  return { opensAt: addMinutes(scheduledAt, -EARLY_MARK_MINUTES), closesAt: addMinutes(scheduledAt, graceMinutes) };
}

function slotOf(scheduledAt) {
  const ist = addMinutes(scheduledAt, IST_OFFSET_MINUTES).toISOString().slice(11, 16);
  return Object.keys(SLOT_TIMES).find((slot) => SLOT_TIMES[slot] === ist) ?? null;
}

function doseJSON(dose, prescription, now, planActive = true) {
  const { opensAt, closesAt } = markWindow(dose.scheduledAt);
  return {
    ...dose.toJSON(),
    slot: slotOf(dose.scheduledAt),
    canMark: planActive && dose.status === 'pending' && now >= opensAt && now <= closesAt,
    prescription: prescription ? prescriptionJSON(prescription) : undefined,
  };
}

/** Adherence % = taken / (taken + missed). Pending doses don't count. Null if none are due yet. */
async function adherenceForPrescriptions(prescriptionIds, { since } = {}) {
  const match = { prescriptionId: { $in: prescriptionIds }, status: { $in: ['taken', 'missed'] } };
  if (since) match.scheduledAt = { $gte: since };
  const counts = await AdherenceRecord.aggregate([{ $match: match }, { $group: { _id: '$status', n: { $sum: 1 } } }]);
  const taken = counts.find((c) => c._id === 'taken')?.n ?? 0;
  const missed = counts.find((c) => c._id === 'missed')?.n ?? 0;
  const percent = taken + missed === 0 ? null : Math.round((taken * 100) / (taken + missed));
  return { percent, taken, missed };
}

export async function adherenceForPlan(planId, options) {
  const prescriptionIds = await Prescription.find({ planId }).distinct('_id');
  return adherenceForPrescriptions(prescriptionIds, options);
}

/** Whole-plan and last-7-days adherence for a patient's current plan (decision D7). */
export async function patientAdherence(patientId, now = new Date()) {
  const plan = await currentPlan(patientId);
  if (!plan) return { window: 'plan', percent: null, taken: 0, missed: 0, last7Days: { percent: null, taken: 0, missed: 0 } };
  const since = istDayRange(addDays(istToday(now), -6)).start;
  const [whole, last7Days] = await Promise.all([adherenceForPlan(plan._id), adherenceForPlan(plan._id, { since })]);
  return { window: 'plan', ...whole, last7Days };
}

/** Doses of the current plan between two IST calendar dates (inclusive). Default: today. */
export async function listDoses(patientId, { from, to }, now = new Date()) {
  const today = istToday(now);
  const first = from ?? to ?? today;
  const last = to ?? from ?? today;
  const plan = await currentPlan(patientId);
  if (!plan) return [];
  const prescriptions = await Prescription.find({ planId: plan._id }).populate('medicationId');
  const byId = new Map(prescriptions.map((p) => [String(p._id), p]));
  const doses = await AdherenceRecord.find({
    prescriptionId: { $in: [...byId.keys()] },
    scheduledAt: { $gte: istDayRange(first).start, $lt: istDayRange(last).end },
  }).sort({ scheduledAt: 1 });
  return doses.map((dose) => doseJSON(dose, byId.get(String(dose.prescriptionId)), now, plan.status === 'active'));
}

/**
 * Patient marks a dose taken (FR-3.2, FR-3.3). Marking an already-taken dose again is harmless.
 * The update only succeeds while the dose is still pending, so it can never clash with the
 * missed-dose sweep.
 */
export async function markDoseTaken(user, adherenceId, now = new Date()) {
  const dose = await AdherenceRecord.findById(adherenceId);
  if (!dose) throw notFound('Dose');
  const prescription = await Prescription.findById(dose.prescriptionId).populate('medicationId');
  const plan = await DischargePlan.findById(prescription.planId);
  if (String(plan.patientId) !== String(user.patientId)) throw forbidden();

  if (dose.status === 'taken') return doseJSON(dose, prescription, now);
  if (dose.status === 'missed') throw conflict('DOSE_MISSED', 'This dose was already recorded as missed');
  if (plan.status !== 'active') throw conflict('PLAN_CLOSED', 'This care plan is closed');
  const { opensAt, closesAt } = markWindow(dose.scheduledAt);
  if (now < opensAt) throw conflict('DOSE_NOT_DUE', 'This dose is not due yet');
  if (now > closesAt) throw conflict('DOSE_WINDOW_CLOSED', 'The time to mark this dose has passed');

  const updated = await AdherenceRecord.findOneAndUpdate(
    { _id: dose._id, status: 'pending' },
    { $set: { status: 'taken', recordedAt: now } },
    { returnDocument: 'after' },
  );
  if (!updated) throw conflict('DOSE_CHANGED', 'This dose was just updated. Please refresh');
  return doseJSON(updated, prescription, now);
}
