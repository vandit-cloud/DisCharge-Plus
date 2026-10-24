import { DischargePlan, Escalation, Patient, User } from '../models/index.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { daysBetween, istToday } from '../utils/time.js';
import { adherenceForPlan } from './adherenceService.js';
import { currentPlan } from './planService.js';
import { computeRiskBand } from './riskBand.js';

function ageOn(dateOfBirth, today) {
  let age = today.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const beforeBirthday =
    today.getUTCMonth() < dateOfBirth.getUTCMonth() ||
    (today.getUTCMonth() === dateOfBirth.getUTCMonth() && today.getUTCDate() < dateOfBirth.getUTCDate());
  return beforeBirthday ? age - 1 : age;
}

function identity(patient, user, now) {
  return {
    patientId: patient._id,
    fullName: user.fullName,
    phone: user.phone,
    preferredLanguage: user.preferredLanguage,
    abhaId: patient.abhaId ?? null,
    dateOfBirth: patient.dateOfBirth,
    age: ageOn(patient.dateOfBirth, istToday(now)),
    gender: patient.gender,
    district: patient.district,
  };
}

/** Identity + current plan + the three risk inputs + the risk band, for one patient. */
async function patientSummary(patient, now) {
  const unresolved = { patientId: patient._id, status: { $ne: 'resolved' } };
  const [user, plan, openEscalations, openEmergencies] = await Promise.all([
    User.findById(patient.userId),
    currentPlan(patient._id),
    Escalation.countDocuments(unresolved),
    Escalation.countDocuments({ ...unresolved, tier: 'emergency' }),
  ]);
  const adherence = plan ? await adherenceForPlan(plan._id) : { percent: null };
  const daysSinceDischarge = plan ? daysBetween(plan.dischargeDate, istToday(now)) : null;
  // Risk only means something while the patient is being followed on an active plan.
  const risk =
    plan?.status === 'active'
      ? computeRiskBand({ adherencePercent: adherence.percent, openEscalations, openEmergencies, daysSinceDischarge })
      : { band: null, score: -1, reasons: [] };
  return {
    ...identity(patient, user, now),
    plan: plan
      ? {
          planId: plan._id,
          primaryDiagnosis: plan.primaryDiagnosis,
          followUpProtocol: plan.followUpProtocol,
          dischargeDate: plan.dischargeDate,
          status: plan.status,
        }
      : null,
    daysSinceDischarge,
    adherencePercent: adherence.percent,
    openEscalations,
    riskBand: risk.band,
    riskScore: risk.score,
    riskReasons: risk.reasons,
  };
}

/** Summaries of every patient this clinician has written a plan for. */
export async function clinicianPatients(clinicianId, now) {
  const patientIds = await DischargePlan.distinct('patientId', { clinicianId });
  const patients = await Patient.find({ _id: { $in: patientIds } });
  const rows = await Promise.all(patients.map((patient) => patientSummary(patient, now)));
  return rows.sort(
    (a, b) =>
      b.riskScore - a.riskScore ||
      (a.adherencePercent ?? 101) - (b.adherencePercent ?? 101) ||
      a.fullName.localeCompare(b.fullName),
  );
}

export async function listPatients(clinicianId, { search, risk }, now) {
  let rows = await clinicianPatients(clinicianId, now);
  if (risk) rows = rows.filter((row) => row.riskBand === risk);
  if (search) {
    const needle = search.toLowerCase();
    const digits = search.replace(/\D/g, '');
    rows = rows.filter(
      (row) =>
        row.fullName.toLowerCase().includes(needle) ||
        (digits.length >= 3 && (row.phone.includes(digits) || row.abhaId?.includes(digits))),
    );
  }
  return rows;
}

export async function getPatient(patientId, now) {
  const patient = await Patient.findById(patientId);
  if (!patient) throw notFound('Patient');
  return patientSummary(patient, now);
}

/**
 * Exact lookup by mobile number or ABHA ID, so a clinician can find a newly registered patient
 * to write their first plan. Exact match only: clinicians cannot browse other doctors' patients.
 */
export async function lookupPatient(query, clinicianId, now) {
  const digits = query.replace(/\D/g, '');
  let patient = null;
  if (digits.length === 14) {
    patient = await Patient.findOne({ abhaId: digits });
  } else if (/^(91|0)?[6-9]\d{9}$/.test(digits)) {
    const user = await User.findOne({ phone: `+91${digits.slice(-10)}`, role: 'patient' });
    patient = user ? await Patient.findOne({ userId: user._id }) : null;
  } else {
    throw badRequest('Enter a 10-digit mobile number or a 14-digit ABHA ID', { q: 'Not a phone or ABHA ID' });
  }
  if (!patient) throw notFound('Patient');

  const [user, activePlan, isMyPatient] = await Promise.all([
    User.findById(patient.userId),
    DischargePlan.exists({ patientId: patient._id, status: 'active' }),
    DischargePlan.exists({ patientId: patient._id, clinicianId }),
  ]);
  return { ...identity(patient, user, now), hasActivePlan: Boolean(activePlan), isMyPatient: Boolean(isMyPatient) };
}
