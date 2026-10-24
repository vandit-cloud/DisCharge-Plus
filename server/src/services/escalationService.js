import {
  AdherenceRecord, DischargePlan, Escalation, Patient, Prescription, SymptomLog, User,
} from '../models/index.js';
import { TIERS } from '../models/enums.js';
import { describeRule } from '../rules/redFlagRules.js';
import { conflict, forbidden, notFound } from '../utils/httpError.js';
import { daysBetween, istToday } from '../utils/time.js';
import { currentPlan, prescriptionJSON } from './planService.js';
import { symptomLogJSON } from './symptomService.js';

const STATUS_ORDER = { open: 0, acknowledged: 1, resolved: 2 };

/**
 * Queue order (FR-5.1): highest tier first; within a tier, not-yet-acknowledged before
 * acknowledged (someone is already on those); then oldest first.
 */
function queueOrder(a, b) {
  return (
    TIERS.indexOf(b.tier) - TIERS.indexOf(a.tier) ||
    STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
    a.createdAt - b.createdAt
  );
}

async function patientNames(patientIds) {
  const patients = await Patient.find({ _id: { $in: patientIds } });
  const users = await User.find({ _id: { $in: patients.map((p) => p.userId) } });
  const userById = new Map(users.map((u) => [String(u._id), u]));
  return new Map(
    patients.map((p) => {
      const user = userById.get(String(p.userId));
      return [String(p._id), { fullName: user?.fullName ?? 'Unknown', phone: user?.phone ?? null }];
    }),
  );
}

function rowJSON(escalation, patient) {
  return { ...escalation.toJSON(), reasons: escalation.triggeredRules.map(describeRule), patient };
}

/** The clinician's escalations (default: open + acknowledged), in queue order. */
export async function listEscalations(clinicianId, { status, tier, patientId } = {}) {
  const filter = { assignedClinicianId: clinicianId, status: { $in: status?.length ? status : ['open', 'acknowledged'] } };
  if (tier?.length) filter.tier = { $in: tier };
  if (patientId) filter.patientId = patientId;
  const escalations = (await Escalation.find(filter).limit(500)).sort(queueOrder);
  const names = await patientNames([...new Set(escalations.map((e) => String(e.patientId)))]);
  return escalations.map((e) => rowJSON(e, names.get(String(e.patientId))));
}

async function loadOwn(clinicianId, escalationId) {
  const escalation = await Escalation.findById(escalationId);
  if (!escalation) throw notFound('Escalation');
  if (String(escalation.assignedClinicianId) !== String(clinicianId)) throw forbidden();
  return escalation;
}

/** One escalation with its source record, patient and plan (page 10). */
export async function getEscalation(clinicianId, escalationId, now = new Date()) {
  const escalation = await loadOwn(clinicianId, escalationId);
  const names = await patientNames([escalation.patientId]);
  const detail = rowJSON(escalation, names.get(String(escalation.patientId)));

  if (escalation.symptomLogId) {
    const log = await SymptomLog.findById(escalation.symptomLogId);
    detail.symptomLog = log ? symptomLogJSON(log) : null;
  }
  // The plan the escalation came from: the missed dose's plan, else the patient's current plan.
  let plan = null;
  if (escalation.adherenceId) {
    const dose = await AdherenceRecord.findById(escalation.adherenceId);
    const prescription = dose && (await Prescription.findById(dose.prescriptionId).populate('medicationId'));
    detail.dose = dose ? { ...dose.toJSON(), prescription: prescription ? prescriptionJSON(prescription) : null } : null;
    if (prescription) plan = await DischargePlan.findById(prescription.planId);
  }
  plan ??= await currentPlan(escalation.patientId);
  detail.plan = plan
    ? {
        planId: plan._id,
        primaryDiagnosis: plan.primaryDiagnosis,
        followUpProtocol: plan.followUpProtocol,
        dischargeDate: plan.dischargeDate,
        daysSinceDischarge: daysBetween(plan.dischargeDate, istToday(now)),
        status: plan.status,
      }
    : null;
  return detail;
}

/** open -> acknowledged (FR-5.6). Status only moves forward (FR-5.8). */
export async function acknowledgeEscalation(clinicianId, escalationId, now = new Date()) {
  const escalation = await loadOwn(clinicianId, escalationId);
  if (escalation.status !== 'open') throw conflict('INVALID_STATUS', `Cannot acknowledge an escalation that is ${escalation.status}`);
  escalation.status = 'acknowledged';
  escalation.acknowledgedAt = now;
  await escalation.save();
  return escalation.toJSON();
}

/** acknowledged -> resolved, with notes (FR-5.7, decision D10: acknowledge first). */
export async function resolveEscalation(clinicianId, escalationId, notes, now = new Date()) {
  const escalation = await loadOwn(clinicianId, escalationId);
  if (escalation.status !== 'acknowledged') {
    throw conflict('INVALID_STATUS', escalation.status === 'open' ? 'Acknowledge the escalation before resolving it' : 'This escalation is already resolved');
  }
  escalation.status = 'resolved';
  escalation.resolvedAt = now;
  escalation.notes = notes;
  await escalation.save();
  return escalation.toJSON();
}
