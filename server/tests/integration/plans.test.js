import { describe, expect, it } from 'vitest';
import { AdherenceRecord, DischargePlan, FollowUp, Prescription } from '../../src/models/index.js';
import {
  api, bearer, cardiacPlanBody, createClinician, createMedications, registerPatient, setNow, useTestDb,
} from '../helpers.js';

useTestDb();

async function setup() {
  const meds = await createMedications();
  const doctor = await createClinician();
  const patient = await registerPatient();
  return { meds, doctor, patient };
}

describe('POST /plans', () => {
  it('AC-4: saving a plan creates the follow-ups and exactly 15 doses', async () => {
    setNow('2026-10-06T01:00:00Z'); // 06:30 IST on discharge day, before the first dose
    const { meds, doctor, patient } = await setup();
    const res = await api().post('/api/plans').set(bearer(doctor.token)).send(cardiacPlanBody(patient.patientId, meds));
    expect(res.status).toBe(201);
    expect(res.body.generated).toEqual({ followUps: 4, doses: 15 });
    expect(await AdherenceRecord.countDocuments({ status: 'pending' })).toBe(15);
    expect(await FollowUp.countDocuments({ planId: res.body.plan.planId })).toBe(4);
  });

  it('does not create doses that were due before the plan was saved', async () => {
    setNow('2026-10-06T09:30:00Z'); // 15:00 IST: the discharge-day morning doses are skipped
    const { meds, doctor, patient } = await setup();
    const res = await api().post('/api/plans').set(bearer(doctor.token)).send(cardiacPlanBody(patient.patientId, meds));
    expect(res.body.generated.doses).toBe(13);
  });

  it('AC-5: rejects TDS with 2 timing slots, naming the field', async () => {
    setNow('2026-10-06T01:00:00Z');
    const { meds, doctor, patient } = await setup();
    const body = cardiacPlanBody(patient.patientId, meds);
    body.prescriptions[0].frequency = 'TDS';
    const res = await api().post('/api/plans').set(bearer(doctor.token)).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.fields['prescriptions.0.timingSlots']).toMatch(/timing slots/);
  });

  it('rejects a future discharge date, a discharge before admission and unknown medicines', async () => {
    setNow('2026-10-06T01:00:00Z');
    const { meds, doctor, patient } = await setup();
    const post = (overrides) => api().post('/api/plans').set(bearer(doctor.token)).send(cardiacPlanBody(patient.patientId, meds, overrides));

    expect((await post({ dischargeDate: '2026-10-07' })).body.error.fields.dischargeDate).toMatch(/future/);
    expect((await post({ admissionDate: '2026-10-08' })).body.error.fields.dischargeDate).toMatch(/after/);
    const unknown = cardiacPlanBody(patient.patientId, meds);
    unknown.prescriptions[0].medicationId = '0123456789abcdef01234567';
    expect((await api().post('/api/plans').set(bearer(doctor.token)).send(unknown)).status).toBe(400);
    expect(await DischargePlan.countDocuments()).toBe(0);
  });

  it('allows only one active plan per patient (D5)', async () => {
    setNow('2026-10-06T01:00:00Z');
    const { meds, doctor, patient } = await setup();
    await api().post('/api/plans').set(bearer(doctor.token)).send(cardiacPlanBody(patient.patientId, meds));
    const second = await api().post('/api/plans').set(bearer(doctor.token)).send(cardiacPlanBody(patient.patientId, meds));
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('ACTIVE_PLAN_EXISTS');
  });

  it('lets only one of two simultaneous saves create an active plan', async () => {
    setNow('2026-10-06T01:00:00Z');
    const { meds, doctor, patient } = await setup();
    const body = cardiacPlanBody(patient.patientId, meds);
    const results = await Promise.all([1, 2, 3].map(() => api().post('/api/plans').set(bearer(doctor.token)).send(body)));
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    expect(await DischargePlan.countDocuments({ status: 'active' })).toBe(1);
    expect(await AdherenceRecord.countDocuments()).toBe(15);
  });

  it('rolls back everything if generation fails (FR-2.11)', async () => {
    setNow('2026-10-06T01:00:00Z');
    const { meds, doctor, patient } = await setup();
    // A pre-existing dose with the same (prescriptionId, scheduledAt) can't happen naturally, so
    // break generation by making AdherenceRecord inserts fail.
    const original = AdherenceRecord.insertMany;
    AdherenceRecord.insertMany = () => Promise.reject(new Error('disk full'));
    try {
      const res = await api().post('/api/plans').set(bearer(doctor.token)).send(cardiacPlanBody(patient.patientId, meds));
      expect(res.status).toBe(500);
    } finally {
      AdherenceRecord.insertMany = original;
    }
    expect(await DischargePlan.countDocuments()).toBe(0);
    expect(await Prescription.countDocuments()).toBe(0);
    expect(await FollowUp.countDocuments()).toBe(0);
  });
});

describe('plan status and follow-ups', () => {
  it('closing a plan deletes future pending doses and allows a new plan', async () => {
    setNow('2026-10-06T01:00:00Z');
    const { meds, doctor, patient } = await setup();
    const created = await api().post('/api/plans').set(bearer(doctor.token)).send(cardiacPlanBody(patient.patientId, meds));
    setNow('2026-10-08T06:00:00Z');
    const closed = await api().patch(`/api/plans/${created.body.plan.planId}`).set(bearer(doctor.token)).send({ status: 'readmitted' });
    expect(closed.body.plan.status).toBe('readmitted');
    expect(await AdherenceRecord.countDocuments({ scheduledAt: { $gt: new Date() } })).toBe(0);

    // Planned follow-ups close with the plan: past ones missed, future ones cancelled.
    const followUps = await FollowUp.find({ planId: created.body.plan.planId });
    expect(followUps.map((f) => f.status)).toEqual([]); // day 3 (9 Oct) and later were all still in the future
    const doses = await api().get(`/api/patients/${patient.patientId}/doses`).set(bearer(patient.token));
    expect(doses.body.doses.every((d) => d.canMark === false)).toBe(true);

    const again = await api().patch(`/api/plans/${created.body.plan.planId}`).set(bearer(doctor.token)).send({ status: 'completed' });
    expect(again.status).toBe(409);
    expect((await api().post('/api/plans').set(bearer(doctor.token)).send(cardiacPlanBody(patient.patientId, meds, { admissionDate: '2026-10-07', dischargeDate: '2026-10-08' }))).status).toBe(201);
  });

  it('shows overdue follow-ups and lets the clinician complete one', async () => {
    setNow('2026-10-06T01:00:00Z');
    const { meds, doctor, patient } = await setup();
    await api().post('/api/plans').set(bearer(doctor.token)).send(cardiacPlanBody(patient.patientId, meds));
    setNow('2026-10-10T06:00:00Z'); // day 4: the day-3 phone check is overdue

    const list = await api().get(`/api/patients/${patient.patientId}/followups`).set(bearer(patient.token));
    const [first] = list.body.followUps;
    expect(first.overdue).toBe(true);

    const done = await api().patch(`/api/followups/${first.followUpId}`).set(bearer(doctor.token)).send({ status: 'completed' });
    expect(done.body.followUp).toMatchObject({ status: 'completed', completedDate: '2026-10-10T00:00:00.000Z' });
    expect((await api().patch(`/api/followups/${first.followUpId}`).set(bearer(patient.token)).send({ status: 'completed' })).status).toBe(403);
    const otherDoctor = await createClinician('Dr. Other');
    const [, second] = list.body.followUps;
    expect((await api().patch(`/api/followups/${second.followUpId}`).set(bearer(otherDoctor.token)).send({ status: 'completed' })).status).toBe(403);
  });

  it('records overdue follow-ups as missed when the plan is closed', async () => {
    setNow('2026-10-06T01:00:00Z');
    const { meds, doctor, patient } = await setup();
    const created = await api().post('/api/plans').set(bearer(doctor.token)).send(cardiacPlanBody(patient.patientId, meds));
    setNow('2026-10-15T06:00:00Z'); // after day 3 and day 7, before day 14 and day 30
    await api().patch(`/api/plans/${created.body.plan.planId}`).set(bearer(doctor.token)).send({ status: 'completed' });
    const statuses = (await FollowUp.find({ planId: created.body.plan.planId }).sort({ scheduledDate: 1 })).map((f) => f.status);
    expect(statuses).toEqual(['missed', 'missed']);
  });

  it('returns the plan with medicines for the patient pages', async () => {
    setNow('2026-10-06T01:00:00Z');
    const { meds, doctor, patient } = await setup();
    await api().post('/api/plans').set(bearer(doctor.token)).send(cardiacPlanBody(patient.patientId, meds));
    const res = await api().get(`/api/patients/${patient.patientId}/plan`).set(bearer(patient.token));
    expect(res.body.plan.clinicianName).toBe('Dr. Test Clinician');
    expect(res.body.prescriptions.map((p) => p.medication.genericName).sort()).toEqual(['furosemide', 'metformin']);
  });
});
