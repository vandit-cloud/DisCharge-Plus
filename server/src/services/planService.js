import {
  AdherenceRecord, DischargePlan, FollowUp, Medication, Patient, Prescription, User,
} from '../models/index.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/httpError.js';
import { istToday } from '../utils/time.js';
import { generateDoses } from './doseGenerator.js';
import { generateFollowUps } from './followUpGenerator.js';

/** The active plan, or else the most recent one. Null if the patient has never had a plan. */
export async function currentPlan(patientId) {
  return (
    (await DischargePlan.findOne({ patientId, status: 'active' })) ??
    (await DischargePlan.findOne({ patientId }).sort({ dischargeDate: -1, _id: -1 }))
  );
}

/** Prescription JSON with its medicine attached as `medication`. */
export function prescriptionJSON(prescription) {
  const json = prescription.toJSON();
  const medication = prescription.populated('medicationId') ? prescription.medicationId.toJSON() : null;
  return { ...json, medicationId: medication?.medicationId ?? json.medicationId, medication };
}

/** The patient's current plan with prescriptions and the clinician's name (pages 4, 5, 12). */
export async function getPatientPlan(patientId) {
  const plan = await currentPlan(patientId);
  if (!plan) return { plan: null, prescriptions: [] };
  const [prescriptions, clinician] = await Promise.all([
    Prescription.find({ planId: plan._id }).populate('medicationId'),
    User.findById(plan.clinicianId),
  ]);
  return {
    plan: { ...plan.toJSON(), clinicianName: clinician?.fullName ?? null },
    prescriptions: prescriptions.map(prescriptionJSON),
  };
}

/**
 * Creates a plan with its prescriptions, then generates the follow-ups and the dose schedule
 * (FR-2.9, FR-2.10). All or nothing (FR-2.11): if any step fails, everything written so far is
 * deleted. A manual rollback is used instead of a transaction because a standalone local MongoDB
 * does not support transactions.
 *
 * @param now the moment of saving; doses before it are not generated (see doseGenerator)
 */
export async function createPlan(clinicianId, input, now = new Date()) {
  if (!(await Patient.exists({ _id: input.patientId }))) throw notFound('Patient');
  if (await DischargePlan.exists({ patientId: input.patientId, status: 'active' })) {
    throw conflict(
      'ACTIVE_PLAN_EXISTS',
      'This patient already has an active plan. Mark it completed, readmitted or lost to follow-up first.',
    );
  }
  if (input.dischargeDate > istToday(now)) {
    throw badRequest('Some fields need fixing', { dischargeDate: 'Discharge date cannot be in the future' });
  }
  const medicationIds = [...new Set(input.prescriptions.map((p) => p.medicationId))];
  if ((await Medication.countDocuments({ _id: { $in: medicationIds } })) !== medicationIds.length) {
    throw badRequest('Some fields need fixing', { prescriptions: 'Unknown medicine selected' });
  }

  const { prescriptions: lines, ...planFields } = input;
  let plan;
  try {
    plan = await DischargePlan.create({ ...planFields, clinicianId, status: 'active' });
  } catch (err) {
    // Two saves at the same moment: the partial unique index lets only one active plan in.
    if (err?.code === 11000) throw conflict('ACTIVE_PLAN_EXISTS', 'This patient already has an active plan.');
    throw err;
  }
  try {
    const prescriptions = await Prescription.insertMany(lines.map((line) => ({ ...line, planId: plan._id })));
    const followUps = await FollowUp.insertMany(generateFollowUps(plan));
    const doses = prescriptions.flatMap((p) => generateDoses(p, plan.dischargeDate, { notBefore: now }));
    await AdherenceRecord.insertMany(doses);
    return { plan: plan.toJSON(), generated: { followUps: followUps.length, doses: doses.length } };
  } catch (err) {
    const prescriptionIds = await Prescription.find({ planId: plan._id }).distinct('_id');
    await Promise.all([
      AdherenceRecord.deleteMany({ prescriptionId: { $in: prescriptionIds } }),
      FollowUp.deleteMany({ planId: plan._id }),
      Prescription.deleteMany({ planId: plan._id }),
      DischargePlan.deleteOne({ _id: plan._id }),
    ]);
    throw err;
  }
}

/**
 * Closes a plan: active -> completed / readmitted / lost_to_followup (decision D5: after saving,
 * only the status changes). Pending doses still in the future are deleted so they are never
 * counted as missed or escalated. Follow-ups still planned are closed too: future ones are
 * cancelled (deleted), past ones that never happened are recorded as missed.
 */
export async function changePlanStatus(clinicianId, planId, status, now = new Date()) {
  const plan = await DischargePlan.findById(planId);
  if (!plan) throw notFound('Plan');
  if (String(plan.clinicianId) !== String(clinicianId)) throw forbidden('Only the clinician who wrote this plan can change it');
  if (plan.status !== 'active') throw conflict('PLAN_NOT_ACTIVE', 'Only an active plan can be closed');

  plan.status = status;
  await plan.save();
  const prescriptionIds = await Prescription.find({ planId }).distinct('_id');
  await AdherenceRecord.deleteMany({ prescriptionId: { $in: prescriptionIds }, status: 'pending', scheduledAt: { $gt: now } });
  const today = istToday(now);
  await FollowUp.deleteMany({ planId, status: 'scheduled', scheduledDate: { $gte: today } });
  await FollowUp.updateMany({ planId, status: 'scheduled', scheduledDate: { $lt: today } }, { $set: { status: 'missed' } });
  return plan.toJSON();
}

/** Follow-ups of the current plan, with an `overdue` flag (FR-6.6: shown, not auto-marked). */
export async function listFollowUps(patientId, now = new Date()) {
  const plan = await currentPlan(patientId);
  if (!plan) return [];
  const today = istToday(now);
  const followUps = await FollowUp.find({ planId: plan._id }).sort({ scheduledDate: 1 });
  return followUps.map((f) => ({ ...f.toJSON(), overdue: f.status === 'scheduled' && f.scheduledDate < today }));
}

export async function completeFollowUp(user, followUpId, now = new Date()) {
  const followUp = await FollowUp.findById(followUpId);
  if (!followUp) throw notFound('Follow-up');
  const plan = await DischargePlan.findById(followUp.planId);
  if (String(plan.clinicianId) !== String(user.userId)) throw forbidden('Only the clinician who wrote this plan can update it');
  if (followUp.status !== 'scheduled') throw conflict('FOLLOW_UP_CLOSED', 'This follow-up is already closed');
  followUp.status = 'completed';
  followUp.completedDate = istToday(now);
  await followUp.save();
  return followUp.toJSON();
}
