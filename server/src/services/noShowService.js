import { noShowBand, noShowReasons, predictNoShow } from '../ml/noShow.js';
import { AdherenceRecord, DischargePlan, FollowUp, Prescription, SymptomLog } from '../models/index.js';
import { distanceToHospitalKm } from '../rules/districtDistance.js';
import { daysBetween, istToday } from '../utils/time.js';

/**
 * Patients (ids as strings) with an earlier follow-up, on any of their plans, that was missed or is
 * overdue. During an active plan an unattended follow-up stays 'scheduled' (the dashboard's
 * "overdue" list); it only becomes 'missed' when the plan is closed, so both count.
 */
async function patientsWhoMissed(patientIds, today) {
  const plans = await DischargePlan.find({ patientId: { $in: patientIds } }, { patientId: 1 });
  const missedPlanIds = await FollowUp.distinct('planId', {
    planId: { $in: plans.map((p) => p._id) },
    $or: [{ status: 'missed' }, { status: 'scheduled', scheduledDate: { $lt: today } }],
  });
  const missed = new Set(missedPlanIds.map(String));
  return new Set(plans.filter((p) => missed.has(String(p._id))).map((p) => String(p.patientId)));
}

/**
 * Last time each patient did something in the app: marked a dose as taken on this plan or
 * reported a symptom. Map of patientId -> Date (instant). Patients with no activity are absent.
 */
async function lastActivity(plans) {
  const patientByPlan = new Map(plans.map((p) => [String(p._id), String(p.patientId)]));
  const prescriptions = await Prescription.find({ planId: { $in: plans.map((p) => p._id) } }, { planId: 1 });
  const patientByPrescription = new Map(prescriptions.map((p) => [String(p._id), patientByPlan.get(String(p.planId))]));

  const [doses, symptoms] = await Promise.all([
    AdherenceRecord.aggregate([
      { $match: { prescriptionId: { $in: prescriptions.map((p) => p._id) }, status: 'taken' } },
      { $group: { _id: '$prescriptionId', last: { $max: '$recordedAt' } } },
    ]),
    SymptomLog.aggregate([
      { $match: { patientId: { $in: plans.map((p) => p.patientId) } } },
      { $group: { _id: '$patientId', last: { $max: '$reportedAt' } } },
    ]),
  ]);

  const latest = new Map();
  const keep = (patientId, when) => {
    if (patientId && (!latest.has(patientId) || when > latest.get(patientId))) latest.set(patientId, when);
  };
  for (const d of doses) keep(patientByPrescription.get(String(d._id)), d.last);
  for (const s of symptoms) keep(String(s._id), s.last);
  return latest;
}

/**
 * Scores the clinician's upcoming follow-ups: the ML probability plus the rule reasons,
 * riskiest first ("whom to phone first"). Computed on read, never stored.
 *
 * @param {object[]} upcoming          FollowUp documents
 * @param {Map<string, object>} planById          active DischargePlan documents by id
 * @param {Map<string, object>} summaryByPatient  rows from clinicianPatients() by patientId
 * @param {Date} today                 IST calendar date
 */
export async function scoreUpcomingFollowUps(upcoming, planById, summaryByPatient, today) {
  if (upcoming.length === 0) return [];
  const plans = [...new Set(upcoming.map((f) => String(f.planId)))].map((id) => planById.get(id));
  const [missedBefore, lastActive] = await Promise.all([
    patientsWhoMissed(plans.map((p) => p.patientId), today),
    lastActivity(plans),
  ]);

  return upcoming
    .map((f) => {
      const plan = planById.get(String(f.planId));
      const patientId = String(plan.patientId);
      const patient = summaryByPatient.get(patientId);
      const missed = missedBefore.has(patientId);

      // Days since the later of: discharge, or the last thing they did in the app.
      const active = lastActive.get(patientId);
      const since = active && istToday(active) > plan.dischargeDate ? istToday(active) : plan.dischargeDate;

      const probability = predictNoShow({
        age: patient.age,
        gender: patient.gender,
        protocol: plan.followUpProtocol,
        leadDays: daysBetween(plan.dischargeDate, f.scheduledDate),
        missedBefore: missed,
      });
      const reasons = noShowReasons({
        missedBefore: missed,
        adherencePercent: patient.adherencePercent,
        daysInactive: Math.max(daysBetween(since, today), 0),
        distanceKm: distanceToHospitalKm(patient.district),
      });
      return {
        ...f.toJSON(),
        patientId: patient.patientId,
        fullName: patient.fullName,
        phone: patient.phone,
        noShowProbability: Math.round(probability * 100) / 100,
        noShowBand: noShowBand(probability, reasons),
        noShowReasons: reasons,
      };
    })
    .sort((a, b) => b.noShowProbability - a.noShowProbability || a.scheduledDate - b.scheduledDate);
}
