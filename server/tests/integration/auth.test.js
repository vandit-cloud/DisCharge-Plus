import { describe, expect, it, vi } from 'vitest';
import { api, bearer, cardiacPlanBody, createClinician, createMedications, registerPatient, setNow, useTestDb } from '../helpers.js';

useTestDb();

describe('register and login', () => {
  it('registers a patient and normalises the phone number', async () => {
    const res = await api().post('/api/auth/register').send({
      fullName: 'Kantaben Rathwa', phone: '+91 98765 43210', password: 'password123',
      preferredLanguage: 'gu', dateOfBirth: '1965-04-12', gender: 'female', district: 'Chhota Udepur', abhaId: '12-3456-7890-1234',
    });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ phone: '+919876543210', role: 'patient', preferredLanguage: 'gu' });
    expect(res.body.user.passwordHash).toBeUndefined(); // NFR-4
    expect(res.body.user.patientId).toBeTruthy();
  });

  it('AC-2: rejects a second registration with the same phone', async () => {
    await registerPatient({ phone: '9876500001' });
    const res = await api().post('/api/auth/register').send({
      fullName: 'Someone Else', phone: '9876500001', password: 'password123',
      preferredLanguage: 'en', dateOfBirth: '1990-01-01', gender: 'male', district: 'Vadodara',
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PHONE_TAKEN');
  });

  it('returns field errors for bad input', async () => {
    const res = await api().post('/api/auth/register').send({ phone: '123', password: 'short', abhaId: '99' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.fields)).toEqual(
      expect.arrayContaining(['fullName', 'phone', 'password', 'abhaId', 'dateOfBirth', 'gender', 'district']),
    );
  });

  it('logs in with the right password only, with one message for both mistakes', async () => {
    await registerPatient({ phone: '9876500002' });
    const ok = await api().post('/api/auth/login').send({ phone: '9876500002', password: 'password123' });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();

    const wrongPassword = await api().post('/api/auth/login').send({ phone: '9876500002', password: 'nope-nope' });
    const wrongPhone = await api().post('/api/auth/login').send({ phone: '9876599999', password: 'password123' });
    expect(wrongPassword.status).toBe(401);
    expect(wrongPhone.body.error.message).toBe(wrongPassword.body.error.message);
  });

  it('rate-limits failed logins however the phone number is written (FR-1.10)', async () => {
    await registerPatient({ phone: '9876500009' });
    const spellings = ['9876500009', '09876500009', '+91 98765 00009', '98765-00009', '+919876500009'];
    const statuses = [];
    const app = api(); // one app instance = one rate limiter
    for (let i = 0; i < 12; i += 1) {
      const res = await app.post('/api/auth/login').send({ phone: spellings[i % spellings.length], password: 'wrong-password' });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);
  });

  it('changes the preferred language', async () => {
    const { token } = await registerPatient();
    const res = await api().patch('/api/auth/me').set(bearer(token)).send({ preferredLanguage: 'hi' });
    expect(res.body.user.preferredLanguage).toBe('hi');
  });
});

describe('access control', () => {
  it('AC-3: protected routes need a valid token', async () => {
    expect((await api().get('/api/auth/me')).status).toBe(401);
    expect((await api().get('/api/auth/me').set(bearer('not-a-token'))).status).toBe(401);
  });

  it('rejects an expired token', async () => {
    setNow('2026-10-01T00:00:00Z');
    const { token } = await registerPatient();
    setNow('2026-11-15T00:00:00Z'); // past the token lifetime
    const res = await api().get('/api/auth/me').set(bearer(token));
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/expired/);
    vi.useRealTimers();
  });

  it('AC-1: patient A cannot read patient B', async () => {
    const a = await registerPatient();
    const b = await registerPatient();
    for (const path of ['', '/plan', '/followups', '/doses', '/adherence', '/symptoms']) {
      const res = await api().get(`/api/patients/${b.patientId}${path}`).set(bearer(a.token));
      expect(res.status, path).toBe(403);
    }
    expect((await api().get(`/api/patients/${a.patientId}/plan`).set(bearer(a.token))).status).toBe(200);
  });

  it('a clinician only sees patients they wrote a plan for (D1)', async () => {
    const meds = await createMedications();
    const doctor = await createClinician();
    const otherDoctor = await createClinician();
    const patient = await registerPatient();
    await api().post('/api/plans').set(bearer(doctor.token)).send(cardiacPlanBody(patient.patientId, meds, { dischargeDate: '2026-09-01', admissionDate: '2026-08-28' }));

    expect((await api().get(`/api/patients/${patient.patientId}`).set(bearer(doctor.token))).status).toBe(200);
    expect((await api().get(`/api/patients/${patient.patientId}`).set(bearer(otherDoctor.token))).status).toBe(403);
    const list = await api().get('/api/patients').set(bearer(otherDoctor.token));
    expect(list.body.patients).toHaveLength(0);
  });

  it('enforces roles', async () => {
    const patient = await registerPatient();
    const doctor = await createClinician();
    expect((await api().get('/api/dashboard').set(bearer(patient.token))).status).toBe(403);
    expect((await api().post('/api/symptoms').set(bearer(doctor.token)).send({ symptoms: ['FEVER'], severity: 2 })).status).toBe(403);
  });

  it('finds a patient by exact phone or ABHA for a first plan', async () => {
    const doctor = await createClinician();
    await registerPatient({ phone: '9876500003', abhaId: '11112222333344' });
    const byPhone = await api().get('/api/patients/lookup?q=09876500003').set(bearer(doctor.token));
    const byAbha = await api().get('/api/patients/lookup?q=1111-2222-3333-44').set(bearer(doctor.token));
    expect(byPhone.body.patient.phone).toBe('+919876500003');
    expect(byAbha.body.patient.patientId).toBe(byPhone.body.patient.patientId);
    expect((await api().get('/api/patients/lookup?q=abcdef').set(bearer(doctor.token))).status).toBe(400);
  });
});
