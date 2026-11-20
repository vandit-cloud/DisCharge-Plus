import { NO_SHOW_CUTOFFS } from '../ml/noShow.js';
import { AdherenceRecord, DischargePlan, FollowUp, Prescription } from '../models/index.js';
import { addDays, daysBetween, istDayRange, istToday } from '../utils/time.js';
import { listEscalations } from './escalationService.js';
import { scoreUpcomingFollowUps } from './noShowService.js';
import { clinicianPatients } from './patientService.js';

const UPCOMING_DAYS = 7;
const TREND_DAYS = 14;

/**
 * Share of due doses taken on each of the last 14 IST days, across all of the clinician's active
 * plans (the dashboard's trend line). A day with no due doses is null, so the chart shows a gap
 * instead of a fake 0 %. Pending doses don't count, as in decision D7.
 */
async function adherenceTrend(activePlanIds, today) {
  const prescriptionIds = await Prescription.find({ planId: { $in: activePlanIds } }).distinct('_id');
  const rows = await AdherenceRecord.aggregate([
    {
      $match: {
        prescriptionId: { $in: prescriptionIds },
        status: { $in: ['taken', 'missed'] },
        scheduledAt: { $gte: istDayRange(addDays(today, -(TREND_DAYS - 1))).start, $lt: istDayRange(today).end },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$scheduledAt', timezone: '+05:30' } },
        taken: { $sum: { $cond: [{ $eq: ['$status', 'taken'] }, 1, 0] } },
        due: { $sum: 1 },
      },
    },
  ]);
  const byDay = new Map(rows.map((r) => [r._id, r]));
  const days = Array.from({ length: TREND_DAYS }, (_, i) => {
    const date = addDays(today, i - (TREND_DAYS - 1)).toISOString().slice(0, 10);
    const row = byDay.get(date);
    return { date, percent: row ? Math.round((row.taken * 100) / row.due) : null };
  });
  const taken = rows.reduce((sum, r) => sum + r.taken, 0);
  const due = rows.reduce((sum, r) => sum + r.due, 0);
  return { days, percent: due === 0 ? null : Math.round((taken * 100) / due) };
}

/** "Which of my patients need attention today?" in one response (FR-6.2). */
export async function getDashboard(clinicianId, now = new Date()) {
  const [patients, escalations, activePlans] = await Promise.all([
    clinicianPatients(clinicianId, now),
    listEscalations(clinicianId),
    DischargePlan.find({ clinicianId, status: 'active' }),
  ]);

  const today = istToday(now);
  const activePlanIds = activePlans.map((p) => p._id);
  const [overdue, upcoming, trend] = await Promise.all([
    FollowUp.find({ planId: { $in: activePlanIds }, status: 'scheduled', scheduledDate: { $lt: today } }).sort({
      scheduledDate: 1,
    }),
    FollowUp.find({
      planId: { $in: activePlanIds },
      status: 'scheduled',
      scheduledDate: { $gte: today, $lt: addDays(today, UPCOMING_DAYS) },
    }),
    adherenceTrend(activePlanIds, today),
  ]);
  const planById = new Map(activePlans.map((p) => [String(p._id), p]));
  const patientByPlan = new Map(activePlans.map((p) => [String(p._id), String(p.patientId)]));
  const nameByPatient = new Map(patients.map((p) => [String(p.patientId), p.fullName]));
  const summaryByPatient = new Map(patients.map((p) => [String(p.patientId), p]));

  // Upcoming follow-ups with the no-show score and reasons, riskiest first: "whom to phone first".
  const upcomingFollowUps = await scoreUpcomingFollowUps(upcoming, planById, summaryByPatient, today);

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
    upcomingFollowUps,
    noShowCutoffs: NO_SHOW_CUTOFFS,
    adherenceTrend: trend,
    // Active plans whose discharge was in the last 7 days (today included).
    dischargedLast7Days: activePlans.filter((p) => {
      const days = daysBetween(p.dischargeDate, today);
      return days >= 0 && days < 7;
    }).length,
  };
}
