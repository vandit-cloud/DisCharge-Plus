// Robustness: every endpoint, hit with every kind of bad request, must answer with a 4xx in the
// standard error shape (NFR-18), never a 500 or a crash. Happy paths are covered by the other files.
import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { User } from '../../src/models/index.js';
import {
  api, bearer, cardiacPlanBody, createClinician, createMedications, registerPatient, setNow, useTestDb,
} from '../helpers.js';

useTestDb();

const MISSING_ID = new mongoose.Types.ObjectId().toString(); // valid shape, no such record
const BAD_IDS = ['abc', '123', 'null', '%20', 'aaaaaaaaaaaa' /* 12 chars: Mongo accepts this shape */];

// Every route in src/routes.js. ":id" is replaced by real, missing and malformed ids.
const ROUTES = [
  ['get', '/api/health'],
  ['post', '/api/auth/register'],
  ['post', '/api/auth/login'],
  ['get', '/api/auth/me'],
  ['patch', '/api/auth/me'],
  ['get', '/api/meta'],
  ['get', '/api/patients'],
  ['get', '/api/patients/lookup'],
  ['get', '/api/patients/:patientId'],
  ['get', '/api/patients/:patientId/plan'],
  ['get', '/api/patients/:patientId/followups'],
  ['get', '/api/patients/:patientId/doses'],
  ['get', '/api/patients/:patientId/adherence'],
  ['get', '/api/patients/:patientId/symptoms'],
  ['patch', '/api/doses/:adherenceId'],
  ['post', '/api/symptoms'],
  ['get', '/api/medications'],
  ['post', '/api/medications'],
  ['post', '/api/plans'],
  ['patch', '/api/plans/:planId'],
  ['patch', '/api/followups/:followUpId'],
  ['get', '/api/escalations'],
  ['get', '/api/escalations/:escalationId'],
  ['patch', '/api/escalations/:escalationId/acknowledge'],
  ['patch', '/api/escalations/:escalationId/resolve'],
  ['get', '/api/dashboard'],
  ['post', '/api/dev/run-sweep'],
  ['get', '/api/no-such-route'],
];

const BODIES = [
  undefined,
  {},
  [],
  [1, 2, 3],
  { status: 'taken', notes: 'x', symptoms: 'CHEST_PAIN', severity: '5' }, // wrong types
  { phone: { $gt: '' }, password: { $ne: null } }, // NoSQL-injection shape
  { patientId: { $ne: null }, prescriptions: [{}], redFlags: [null] },
  { fullName: 'x'.repeat(5000), notes: 'y'.repeat(5000), q: 'z'.repeat(5000) },
  { __proto__: { isAdmin: true }, constructor: { prototype: {} } },
];

const QUERIES = [
  '',
  '?search=a&search=b', // repeated parameter arrives as an array
  '?risk=extreme&status=nope&tier=,,,&from=2026-02-30&to=yesterday',
  '?q=ab',
  '?q[$gt]=',
  `?patientId=${MISSING_ID}&from=2026-12-01&to=2026-01-01`,
  '?q=.*(a+)+$',
];

function expectHandled(res, label) {
  // Collected rather than thrown, so one run lists every failing case.
  if (res.status >= 500 || (res.status >= 400 && typeof res.body?.error?.code !== 'string')) {
    return `${label} -> ${res.status} ${JSON.stringify(res.body).slice(0, 200)}`;
  }
  return null;
}

async function buildWorld() {
  setNow('2026-10-06T01:00:00Z');
  const meds = await createMedications();
  const doctor = await createClinician();
  const otherDoctor = await createClinician('Dr. Other');
  const patient = await registerPatient();
  const loner = await registerPatient({ fullName: 'No Plan Patient' }); // never given a plan
  const plan = (await api().post('/api/plans').set(bearer(doctor.token)).send(cardiacPlanBody(patient.patientId, meds))).body;
  setNow('2026-10-06T03:00:00Z');
  await api().post('/api/symptoms').set(bearer(patient.token)).send({ symptoms: ['BREATHLESS'], severity: 3 });
  const escalationId = (await api().get('/api/escalations').set(bearer(doctor.token))).body.escalations[0].escalationId;
  const followUpId = (await api().get(`/api/patients/${patient.patientId}/followups`).set(bearer(patient.token))).body.followUps[0].followUpId;
  const doseId = (await api().get(`/api/patients/${patient.patientId}/doses`).set(bearer(patient.token))).body.doses[0].adherenceId;

  // A token whose user no longer exists: what a browser holds after the database is reseeded.
  const ghost = await registerPatient({ fullName: 'Deleted User' });
  await User.deleteOne({ _id: ghost.userId });

  return {
    ids: {
      patientId: patient.patientId,
      planId: plan.plan.planId,
      followUpId,
      adherenceId: doseId,
      escalationId,
    },
    tokens: {
      none: null,
      garbage: 'not-a-jwt',
      forged: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.c2lnbmF0dXJl',
      deletedUser: ghost.token,
      patient: patient.token,
      loner: loner.token,
      doctor: doctor.token,
      otherDoctor: otherDoctor.token,
    },
  };
}

function send(method, url, token, body) {
  let req = api()[method](url);
  if (token) req = req.set(bearer(token));
  return body === undefined ? req : req.send(body);
}

describe('robustness: no endpoint answers 500', () => {
  it('handles every route x token x id x body x query combination', async () => {
    const { ids, tokens } = await buildWorld();
    const failures = [];
    let succeeded = 0;
    let requests = 0;

    for (const [method, template] of ROUTES) {
      const param = template.match(/:(\w+)/)?.[1];
      const idVariants = param ? [ids[param], MISSING_ID, ...BAD_IDS] : [null];

      for (const id of idVariants) {
        const path = param ? template.replace(`:${param}`, encodeURIComponent(id)) : template;
        for (const [who, token] of Object.entries(tokens)) {
          for (const query of method === 'get' ? QUERIES : ['']) {
            for (const body of method === 'get' ? [undefined] : BODIES) {
              const res = await send(method, path + query, token, body);
              requests += 1;
              if (res.status < 300) succeeded += 1;
              const failure = expectHandled(res, `${method.toUpperCase()} ${path}${query} as ${who} body=${JSON.stringify(body)?.slice(0, 60)}`);
              if (failure) failures.push(failure);
            }
          }
        }
      }
    }
    expect(failures).toEqual([]);
    // Guard against a broken setup where every request is simply refused.
    expect(requests).toBeGreaterThan(5000);
    expect(succeeded).toBeGreaterThan(100);
  }, 240_000);

  it('rejects malformed, oversized and oddly encoded bodies with a 4xx', async () => {
    const failures = [];
    const raw = [
      ['bad JSON', 'application/json', '{"phone": '],
      ['JSON null', 'application/json', 'null'],
      ['JSON string', 'application/json', '"hello"'],
      ['oversized', 'application/json', JSON.stringify({ notes: 'x'.repeat(200 * 1024) })],
      ['form-encoded', 'application/x-www-form-urlencoded', 'phone=9876543210&password=x'],
      ['plain text', 'text/plain', 'hello'],
    ];
    for (const [label, type, payload] of raw) {
      const res = await api().post('/api/auth/login').set('Content-Type', type).send(payload);
      const failure = expectHandled(res, label);
      if (failure) failures.push(failure);
    }
    const charset = await api()
      .post('/api/auth/login')
      .set('Content-Type', 'application/json; charset=klingon')
      .send('{"phone":"9876543210","password":"x"}');
    const failure = expectHandled(charset, 'unknown charset');
    if (failure) failures.push(failure);
    expect(failures).toEqual([]);
  });
});
