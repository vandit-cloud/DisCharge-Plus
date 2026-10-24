import { DischargePlan, FollowUp } from '../models/index.js';
import { istToday } from '../utils/time.js';
import { listEscalations } from './escalationService.js';
import { clinicianPatients } from './patientService.js';

/** "Which of my patients need attention today?" in one response (FR-6.2). */
export async function getDashboard(clinicianId, now = new Date()) {
  const [patients, escalations, activePlans] = await Promise.all([
    clinicianPatients(clinicianId, now),
    listEscalations(clinicianId),
    DischargePlan.find({ clinicianId, status: 'active' }),
  ]);

  const overdue = await FollowUp.find({
    planId: { $in: activePlans.map((p) => p._id) },
    status: 'scheduled',
    scheduledDate: { $lt: istToday(now) },
  }).sort({ scheduledDate: 1 });
  const patientByPlan = new Map(activePlans.map((p) => [String(p._id), String(p.patientId)]));
  const nameByPatient = new Map(patients.map((p) => [String(p.patientId), p.fullName]));

  const count = (list, key, value) => list.filter((item) => item[key] === value).length;
  return {
    riskBands: {
      high: count(patients, 'riskBand', 'high'),
      moderate: count(patients, 'riskBand', 'moderate'),
      low: count(patients, 'riskBand', 'low'),
    },
    totalPatients: patients.length,
    activePatients: patients.filter((p) => p.riskBand !== null).length,
    // clinicianPatients is already sorted by risk, so the first rows need attention first.
    topRisk: patients.filter((p) => p.riskBand === 'high' || p.riskBand === 'moderate').slice(0, 8),
    openEscalations: {
      emergency: count(escalations, 'tier', 'emergency'),
      urgent: count(escalations, 'tier', 'urgent'),
      teleconsult: count(escalations, 'tier', 'teleconsult'),
      items: escalations.slice(0, 5),
    },
    overdueFollowUps: overdue.map((f) => {
      const patientId = patientByPlan.get(String(f.planId));
      return { ...f.toJSON(), patientId, fullName: nameByPatient.get(patientId) ?? 'Unknown' };
    }),
  };
}
