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
  });
});
