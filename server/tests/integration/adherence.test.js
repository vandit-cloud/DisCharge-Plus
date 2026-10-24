import { describe, expect, it } from 'vitest';
import { sweepMissedDoses } from '../../src/jobs/missedDoseSweep.js';
import { AdherenceRecord, Escalation } from '../../src/models/index.js';
import {
  api, bearer, cardiacPlanBody, createClinician, createMedications, registerPatient, setNow, useTestDb,
} from '../helpers.js';

useTestDb();

// Plan saved at 06:30 IST on discharge day (6 Oct). Morning doses are at 08:00 IST = 02:30 UTC.
async function setup() {
  setNow('2026-10-06T01:00:00Z');
  const meds = await createMedications();
  const doctor = await createClinician();
  const patient = await registerPatient();
  await api().post('/api/plans').set(bearer(doctor.token)).send(cardiacPlanBody(patient.patientId, meds));
  return { doctor, patient };
}

const todaysDoses = async (patient) =>
  (await api().get(`/api/patients/${patient.patientId}/doses`).set(bearer(patient.token))).body.doses;

describe('marking doses', () => {
  it("lists today's doses with medicine, slot and whether they can be marked", async () => {
    const { patient } = await setup();
    setNow('2026-10-06T02:00:00Z'); // 07:30 IST
    const doses = await todaysDoses(patient);
    expect(doses).toHaveLength(3); // 2 morning + 1 night
    expect(doses[0]).toMatchObject({ slot: 'morning', status: 'pending', canMark: true });
    expect(doses[0].prescription.medication.genericName).toBeTruthy();
    expect(doses.find((d) => d.slot === 'night').canMark).toBe(false);
  });

  it('marks a dose taken inside its window, and a second tap is harmless', async () => {
    const { patient } = await setup();
    setNow('2026-10-06T03:00:00Z'); // 08:30 IST
    const [dose] = await todaysDoses(patient);
    const first = await api().patch(`/api/doses/${dose.adherenceId}`).set(bearer(patient.token)).send({ status: 'taken' });
    expect(first.body.dose).toMatchObject({ status: 'taken', recordedAt: '2026-10-06T03:00:00.000Z' });
    const second = await api().patch(`/api/doses/${dose.adherenceId}`).set(bearer(patient.token)).send({ status: 'taken' });
    expect(second.status).toBe(200);
  });

  it('refuses doses that are not due yet or whose window has closed', async () => {
    const { patient } = await setup();
    setNow('2026-10-06T03:00:00Z');
    const doses = await todaysDoses(patient);
    const night = doses.find((d) => d.slot === 'night');
    const early = await api().patch(`/api/doses/${night.adherenceId}`).set(bearer(patient.token)).send({ status: 'taken' });
    expect(early.body.error.code).toBe('DOSE_NOT_DUE');

    setNow('2026-10-06T04:45:00Z'); // 10:15 IST, grace (2 h) over for 08:00
    const late = await api().patch(`/api/doses/${doses[0].adherenceId}`).set(bearer(patient.token)).send({ status: 'taken' });
    expect(late.body.error.code).toBe('DOSE_WINDOW_CLOSED');
  });

  it("stops a patient marking someone else's dose", async () => {
    const { patient } = await setup();
    const other = await registerPatient();
    setNow('2026-10-06T03:00:00Z');
    const [dose] = await todaysDoses(patient);
    const res = await api().patch(`/api/doses/${dose.adherenceId}`).set(bearer(other.token)).send({ status: 'taken' });
    expect(res.status).toBe(403);
  });
});

describe('missed-dose sweep', () => {
  it('AC-6: an unmarked critical dose becomes missed and raises exactly one escalation', async () => {
    const { doctor } = await setup();
    const result = await sweepMissedDoses(new Date('2026-10-06T04:45:00Z')); // 10:15 IST
    expect(result).toEqual({ checked: 2, markedMissed: 2, escalationsRaised: 1 });

    const escalations = await Escalation.find();
    expect(escalations).toHaveLength(1);
    expect(escalations[0]).toMatchObject({ source: 'missed_critical_dose', tier: 'urgent', status: 'open', triggeredRules: ['MISSED_CRITICAL_DOSE'] });
    expect(String(escalations[0].assignedClinicianId)).toBe(doctor.userId);

    const again = await sweepMissedDoses(new Date('2026-10-06T05:00:00Z')); // 10:30 IST
    expect(again).toEqual({ checked: 0, markedMissed: 0, escalationsRaised: 0 });
    expect(await Escalation.countDocuments()).toBe(1);
  });

  it('AC-7: a missed non-critical dose only lowers adherence', async () => {
    const { patient } = await setup();
    setNow('2026-10-06T03:00:00Z');
    const doses = await todaysDoses(patient);
    const critical = doses.find((d) => d.slot === 'morning' && d.prescription.isCritical);
    await api().patch(`/api/doses/${critical.adherenceId}`).set(bearer(patient.token)).send({ status: 'taken' });

    await sweepMissedDoses(new Date('2026-10-06T04:45:00Z'));
    expect(await Escalation.countDocuments()).toBe(0);
    setNow('2026-10-06T05:00:00Z');
    const res = await api().get(`/api/patients/${patient.patientId}/adherence`).set(bearer(patient.token));
    expect(res.body.adherence).toMatchObject({ percent: 50, taken: 1, missed: 1 });
  });

  it('recovers if a previous run crashed between escalating and marking', async () => {
    await setup();
    await sweepMissedDoses(new Date('2026-10-06T04:45:00Z'));
    await AdherenceRecord.updateMany({ status: 'missed' }, { $set: { status: 'pending' } }); // simulate the crash
    const rerun = await sweepMissedDoses(new Date('2026-10-06T04:50:00Z'));
    expect(rerun).toMatchObject({ markedMissed: 2, escalationsRaised: 0 });
    expect(await Escalation.countDocuments()).toBe(1);
  });

  it('can be run on demand for the demo', async () => {
    const { doctor } = await setup();
    setNow('2026-10-06T04:45:00Z');
    const res = await api().post('/api/dev/run-sweep').set(bearer(doctor.token));
    expect(res.body.result.escalationsRaised).toBe(1);
  });
});
