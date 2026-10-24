// Shared test setup: an in-memory MongoDB per test file, emptied before every test.
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { connectDB } from '../src/config/db.js';
import { Medication, User } from '../src/models/index.js';
import { hashPassword } from '../src/services/authService.js';

export function useTestDb() {
  let mongo;
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await connectDB(mongo.getUri());
  });
  beforeEach(async () => {
    await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
  });
  afterAll(async () => {
    vi.useRealTimers();
    await mongoose.disconnect();
    await mongo?.stop();
  });
}

/** Freeze the clock. Only Date is faked, so the database driver's timers keep working. */
export function setNow(iso) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(iso));
}

export const api = () => request(createApp());
export const bearer = (token) => ({ Authorization: `Bearer ${token}` });

let phoneCounter = 0;
function nextPhone() {
  phoneCounter += 1;
  return `98${String(10000000 + phoneCounter).slice(-8)}`;
}

export async function createClinician(fullName = 'Dr. Test Clinician') {
  const phone = nextPhone();
  await User.create({ fullName, phone: `+91${phone}`, passwordHash: await hashPassword('password123'), role: 'clinician' });
  const res = await api().post('/api/auth/login').send({ phone, password: 'password123' });
  return { token: res.body.token, userId: res.body.user.userId };
}

export async function registerPatient(overrides = {}) {
  const body = {
    fullName: 'Test Patient',
    phone: nextPhone(),
    password: 'password123',
    preferredLanguage: 'gu',
    dateOfBirth: '1965-04-12',
    gender: 'female',
    district: 'Chhota Udepur',
    ...overrides,
  };
  const res = await api().post('/api/auth/register').send(body);
  if (res.status !== 201) throw new Error(`register failed: ${JSON.stringify(res.body)}`);
  return { token: res.body.token, patientId: res.body.user.patientId, userId: res.body.user.userId };
}

export async function createMedications() {
  const [furosemide, metformin] = await Medication.create([
    { genericName: 'furosemide', form: 'tablet', strength: '40 mg' },
    { genericName: 'metformin', form: 'tablet', strength: '500 mg' },
  ]);
  return { furosemide: String(furosemide._id), metformin: String(metformin._id) };
}

/** AC-4 plan: metformin BD x 5 days + furosemide OD x 5 days (critical). */
export function cardiacPlanBody(patientId, meds, overrides = {}) {
  return {
    patientId,
    admissionDate: '2026-10-01',
    dischargeDate: '2026-10-06',
    primaryDiagnosis: 'Heart failure with type 2 diabetes',
    redFlags: ['CHEST_PAIN', 'BREATHLESS', 'SWELLING_LEGS'],
    followUpProtocol: 'cardiac',
    prescriptions: [
      { medicationId: meds.metformin, dosage: '1 tablet', frequency: 'BD', timingSlots: ['morning', 'night'], durationDays: 5, isCritical: false },
      { medicationId: meds.furosemide, dosage: '1 tablet', frequency: 'OD', timingSlots: ['morning'], durationDays: 5, isCritical: true },
    ],
    ...overrides,
  };
}
