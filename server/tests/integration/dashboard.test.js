import { describe, expect, it } from 'vitest';
import { sweepMissedDoses } from '../../src/jobs/missedDoseSweep.js';
import {
  api, bearer, cardiacPlanBody, createClinician, createMedications, registerPatient, setNow, useTestDb,
} from '../helpers.js';

useTestDb();

describe('GET /dashboard', () => {
  it('AC-12: the patient with a missed critical dose and an urgent symptom is at the top', async () => {
    setNow('2026-10-06T01:00:00Z');
    const meds = await createMedications();
    const doctor = await createClinician();
    const kantaben = await registerPatient({ fullName: 'Kantaben Rathwa' });
    const stable = await registerPatient({ fullName: 'Stable Patient' });
    for (const p of [kantaben, stable]) {
      await api().post('/api/plans').set(bearer(doctor.token)).send(cardiacPlanBody(p.patientId, meds));
    }

    // The stable patient takes their morning doses; Kantaben doesn't.
    setNow('2026-10-06T03:00:00Z');
    const doses = (await api().get(`/api/patients/${stable.patientId}/doses`).set(bearer(stable.token))).body.doses;
    for (const d of doses.filter((x) => x.slot === 'morning')) {
      await api().patch(`/api/doses/${d.adherenceId}`).set(bearer(stable.token)).send({ status: 'taken' });
    }
    await sweepMissedDoses(new Date('2026-10-06T04:45:00Z'));
    setNow('2026-10-06T06:00:00Z');
    await api().post('/api/symptoms').set(bearer(kantaben.token)).send({ symptoms: ['BREATHLESS'], severity: 3 });

    const res = await api().get('/api/dashboard').set(bearer(doctor.token));
    expect(res.status).toBe(200);
    expect(res.body.topRisk[0]).toMatchObject({ fullName: 'Kantaben Rathwa', riskBand: 'high', openEscalations: 2, adherencePercent: 0 });
    expect(res.body.riskBands).toEqual({ high: 1, moderate: 1, low: 0 });

    // Trend: each patient had 2 morning doses on 6 Oct. The stable patient took both, the sweep
    // marked Kantaben's 2 missed -> 2 of 4 taken = 50 %. The 13 days before have no doses (null).
    expect(res.body.adherenceTrend.days).toHaveLength(14);
    expect(res.body.adherenceTrend.days.at(-1)).toEqual({ date: '2026-10-06', percent: 50 });
    expect(res.body.adherenceTrend.days[0]).toEqual({ date: '2026-09-23', percent: null });
    expect(res.body.adherenceTrend.percent).toBe(50);
    expect(res.body.dischargedLast7Days).toBe(2);
    expect(res.body.noShowCutoffs.high).toBeGreaterThan(res.body.noShowCutoffs.moderate);
    expect(res.body.openEscalations).toMatchObject({ urgent: 2, emergency: 0 });
    expect(res.body.openEscalations.items.every((e) => e.patient.fullName === 'Kantaben Rathwa')).toBe(true);

    // Patient list: search and risk filter
    const list = await api().get('/api/patients?risk=high').set(bearer(doctor.token));
    expect(list.body.patients.map((p) => p.fullName)).toEqual(['Kantaben Rathwa']);
    const search = await api().get('/api/patients?search=stab').set(bearer(doctor.token));
    expect(search.body.patients.map((p) => p.fullName)).toEqual(['Stable Patient']);
  });

  it('leaves patients without an active plan out of the risk counts', async () => {
    setNow('2026-10-06T01:00:00Z');
    const meds = await createMedications();
    const doctor = await createClinician();
    const patient = await registerPatient();
    const { body } = await api().post('/api/plans').set(bearer(doctor.token)).send(cardiacPlanBody(patient.patientId, meds));
    await api().patch(`/api/plans/${body.plan.planId}`).set(bearer(doctor.token)).send({ status: 'lost_to_followup' });
    const res = await api().get('/api/dashboard').set(bearer(doctor.token));
    expect(res.body).toMatchObject({ totalPatients: 1, activePatients: 0, riskBands: { high: 0, moderate: 0, low: 0 }, topRisk: [] });
  });

  it('lists overdue follow-ups of active plans', async () => {
    setNow('2026-10-06T01:00:00Z');
    const meds = await createMedications();
    const doctor = await createClinician();
    const patient = await registerPatient();
    await api().post('/api/plans').set(bearer(doctor.token)).send(cardiacPlanBody(patient.patientId, meds));
    setNow('2026-10-12T06:00:00Z'); // day 6: day-3 check overdue
    const res = await api().get('/api/dashboard').set(bearer(doctor.token));
    expect(res.body.overdueFollowUps).toHaveLength(1);
    expect(res.body.overdueFollowUps[0]).toMatchObject({ type: 'phone_check', fullName: 'Test Patient' });

    // Next 7 days (12-18 Oct): only the day-7 clinic review, scored by the no-show model.
    expect(res.body.upcomingFollowUps).toHaveLength(1);
    const next = res.body.upcomingFollowUps[0];
    expect(next).toMatchObject({ type: 'in_person', fullName: 'Test Patient' });
    expect(next.noShowProbability).toBeGreaterThan(0);
    expect(next.noShowProbability).toBeLessThan(1);
    // Day-3 check is overdue; nothing done in the app since discharge (6 Oct); Chhota Udepur is ~85 km (< 100).
    expect(next.noShowReasons).toEqual(['Missed an earlier follow-up', 'No app activity for 6 days']);

    // A symptom report counts as activity, and the earlier miss raises the model's score.
    await api().post('/api/symptoms').set(bearer(patient.token)).send({ symptoms: ['DIZZY'], severity: 1 });
    const after = (await api().get('/api/dashboard').set(bearer(doctor.token))).body.upcomingFollowUps[0];
    expect(after.noShowReasons).toEqual(['Missed an earlier follow-up']);
  });
});
