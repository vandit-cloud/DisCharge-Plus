import { describe, expect, it } from 'vitest';
import { SymptomLog } from '../../src/models/index.js';
import {
  api, bearer, cardiacPlanBody, createClinician, createMedications, registerPatient, setNow, useTestDb,
} from '../helpers.js';

useTestDb();

async function setup() {
  setNow('2026-10-06T01:00:00Z');
  const meds = await createMedications();
  const doctor = await createClinician();
  const patient = await registerPatient();
  await api().post('/api/plans').set(bearer(doctor.token)).send(cardiacPlanBody(patient.patientId, meds));
  return { meds, doctor, patient };
}

const report = (patient, symptoms, severity) =>
  api().post('/api/symptoms').set(bearer(patient.token)).send({ symptoms, severity });

describe('report symptom -> escalation', () => {
  it('AC-8: chest pain after a cardiac discharge is an emergency at the top of the queue', async () => {
    const { doctor, patient } = await setup();
    setNow('2026-10-07T03:00:00Z');
    await report(patient, ['DIZZY'], 3); // CARD_DIZZY = teleconsult, reported first
    setNow('2026-10-07T04:00:00Z');
    const res = await report(patient, ['CHEST_PAIN'], 1);

    expect(res.status).toBe(201);
    expect(res.body.symptomLog).toMatchObject({ triageTier: 'emergency' });
    expect(res.body.symptomLog.triggeredRules).toContain('GEN_CHEST_PAIN');
    expect(res.body).toMatchObject({ clinicianAlerted: true, escalation: { tier: 'emergency', status: 'open' } });

    const queue = await api().get('/api/escalations').set(bearer(doctor.token));
    expect(queue.body.escalations.map((e) => e.tier)).toEqual(['emergency', 'teleconsult']);

    // Within a tier, a new open escalation comes before an older acknowledged one.
    await api().patch(`/api/escalations/${queue.body.escalations[1].escalationId}/acknowledge`).set(bearer(doctor.token));
    setNow('2026-10-07T05:00:00Z');
    await report(patient, ['DIZZY'], 3);
    const reordered = await api().get('/api/escalations').set(bearer(doctor.token));
    expect(reordered.body.escalations.slice(1).map((e) => e.status)).toEqual(['open', 'acknowledged']);
    expect(queue.body.escalations[0].reasons).toContain('Chest pain');
  });

  it('AC-10: a harmless report is stored as self_care without an escalation', async () => {
    const { patient } = await setup();
    const res = await report(patient, ['DIZZY'], 1);
    expect(res.body).toMatchObject({ escalation: null, clinicianAlerted: false, symptomLog: { triageTier: 'self_care', triggeredRules: [] } });
    expect(await SymptomLog.countDocuments()).toBe(1); // kept for auditing false negatives
  });

  it('keeps the report of a patient with no plan, without alerting anyone', async () => {
    const lonely = await registerPatient();
    const res = await report(lonely, ['CHEST_PAIN'], 3);
    expect(res.body).toMatchObject({ clinicianAlerted: false, escalation: null, symptomLog: { triageTier: 'emergency' } });
  });

  it('rejects invalid reports', async () => {
    const { patient } = await setup();
    expect((await report(patient, [], 3)).status).toBe(400);
    expect((await report(patient, ['HEADACHE'], 3)).status).toBe(400);
    expect((await report(patient, ['FEVER'], 6)).status).toBe(400);
    expect((await report(patient, ['FEVER', 'FEVER'], 2)).status).toBe(400);
  });
});

describe('escalation handling', () => {
  it('moves open -> acknowledged -> resolved, and only forwards (AC-11)', async () => {
    const { doctor, patient } = await setup();
    const { body } = await report(patient, ['BREATHLESS', 'SWELLING_LEGS'], 4);
    const id = body.escalation.escalationId;
    const as = bearer(doctor.token);

    expect((await api().patch(`/api/escalations/${id}/resolve`).set(as).send({ notes: 'x' })).body.error.code).toBe('INVALID_STATUS');
    const ack = await api().patch(`/api/escalations/${id}/acknowledge`).set(as);
    expect(ack.body.escalation.status).toBe('acknowledged');
    expect((await api().patch(`/api/escalations/${id}/resolve`).set(as).send({ notes: '' })).status).toBe(400);
    const resolved = await api().patch(`/api/escalations/${id}/resolve`).set(as).send({ notes: 'Called patient, OPD today' });
    expect(resolved.body.escalation).toMatchObject({ status: 'resolved', notes: 'Called patient, OPD today' });
    expect((await api().patch(`/api/escalations/${id}/acknowledge`).set(as)).status).toBe(409);

    const open = await api().get('/api/escalations').set(as);
    expect(open.body.escalations).toHaveLength(0);
    const all = await api().get('/api/escalations?status=resolved').set(as);
    expect(all.body.escalations).toHaveLength(1);
  });

  it('shows the source report and plan on the detail page', async () => {
    const { doctor, patient } = await setup();
    const { body } = await report(patient, ['BREATHLESS'], 3);
    const res = await api().get(`/api/escalations/${body.escalation.escalationId}`).set(bearer(doctor.token));
    expect(res.body.escalation.symptomLog.symptoms).toEqual(['BREATHLESS']);
    expect(res.body.escalation.plan.followUpProtocol).toBe('cardiac');
    expect(res.body.escalation.patient.fullName).toBe('Test Patient');
  });

  it("hides another clinician's escalations", async () => {
    const { patient } = await setup();
    const other = await createClinician('Dr. Other');
    const { body } = await report(patient, ['CHEST_PAIN'], 2);
    expect((await api().get(`/api/escalations/${body.escalation.escalationId}`).set(bearer(other.token))).status).toBe(403);
  });
});
