// All API routes. Each protected route runs: requireAuth -> requireRole -> ownership -> validate.
import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { sweepMissedDoses } from './jobs/missedDoseSweep.js';
import { requireAuth, requirePatientAccess, requireRole } from './middleware/auth.js';
import { validate } from './middleware/validate.js';
import { Medication } from './models/index.js';
import { DEFAULT_RED_FLAGS, SYMPTOM_CODES } from './rules/symptomCodes.js';
import { PROTOCOL_TEMPLATES } from './rules/protocols.js';
import * as auth from './services/authService.js';
import * as adherence from './services/adherenceService.js';
import { getDashboard } from './services/dashboardService.js';
import * as escalations from './services/escalationService.js';
import * as patients from './services/patientService.js';
import * as plans from './services/planService.js';
import * as symptoms from './services/symptomService.js';
import { forbidden, notFound } from './utils/httpError.js';
import * as schemas from './validation.js';
import { phoneDigits } from './validation.js';

const patient = [requireAuth, requireRole('patient')];
const clinician = [requireAuth, requireRole('clinician')];
const anyUser = [requireAuth, requireRole('patient', 'clinician')];
const ownPatient = [requireAuth, requireRole('patient', 'clinician'), requirePatientAccess];
const now = () => new Date();

function objectIdParam(name, label) {
  return (req, _res, next) => {
    if (!mongoose.isValidObjectId(req.params[name])) throw notFound(label);
    next();
  };
}

export function createRouter() {
  const router = Router();

  // FR-1.10: 10 failed logins per 15 minutes per IP + phone. Successful logins don't count. The phone
  // is normalised first, otherwise "98765 43210" and "+919876543210" would each get their own 10 tries.
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${phoneDigits(req.body?.phone)}`,
    handler: (_req, res) =>
      res.status(429).json({ error: { code: 'TOO_MANY_ATTEMPTS', message: 'Too many attempts. Try again in 15 minutes' } }),
  });

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'up' : 'down' });
  });

  // ---------- Auth ----------
  router.post('/auth/register', validate(schemas.registerSchema), async (req, res) => {
    res.status(201).json(await auth.register(req.valid.body));
  });
  router.post('/auth/login', loginLimiter, validate(schemas.loginSchema), async (req, res) => {
    res.json(await auth.login(req.valid.body));
  });
  router.get('/auth/me', anyUser, (req, res) => {
    res.json({ user: { ...req.user.doc.toJSON(), patientId: req.user.patientId ?? null } });
  });
  router.patch('/auth/me', anyUser, validate(schemas.languageSchema), async (req, res) => {
    req.user.doc.preferredLanguage = req.valid.body.preferredLanguage;
    await req.user.doc.save();
    res.json({ user: { ...req.user.doc.toJSON(), patientId: req.user.patientId ?? null } });
  });

  // ---------- Reference data (codes the client needs to build forms) ----------
  router.get('/meta', anyUser, (_req, res) => {
    const protocols = Object.fromEntries(
      Object.entries(PROTOCOL_TEMPLATES).map(([key, t]) => [key, { followUps: t.followUps.length, defaultRedFlags: DEFAULT_RED_FLAGS[key] }]),
    );
    res.json({ symptomCodes: SYMPTOM_CODES, protocols });
  });

  // ---------- Patients (records nested under /patients/:patientId share one ownership check) ----------
  router.get('/patients', clinician, validate(schemas.patientListQuery, 'query'), async (req, res) => {
    res.json({ patients: await patients.listPatients(req.user.userId, req.valid.query, now()) });
  });
  router.get('/patients/lookup', clinician, validate(schemas.patientLookupQuery, 'query'), async (req, res) => {
    res.json({ patient: await patients.lookupPatient(req.valid.query.q, req.user.userId, now()) });
  });
  router.get('/patients/:patientId', ownPatient, async (req, res) => {
    res.json({ patient: await patients.getPatient(req.params.patientId, now()) });
  });
  router.get('/patients/:patientId/plan', ownPatient, async (req, res) => {
    res.json(await plans.getPatientPlan(req.params.patientId));
  });
  router.get('/patients/:patientId/followups', ownPatient, async (req, res) => {
    res.json({ followUps: await plans.listFollowUps(req.params.patientId, now()) });
  });
  router.get('/patients/:patientId/doses', ownPatient, validate(schemas.doseRangeQuery, 'query'), async (req, res) => {
    res.json({ doses: await adherence.listDoses(req.params.patientId, req.valid.query, now()) });
  });
  router.get('/patients/:patientId/adherence', ownPatient, async (req, res) => {
    res.json({ adherence: await adherence.patientAdherence(req.params.patientId, now()) });
  });
  router.get('/patients/:patientId/symptoms', ownPatient, async (req, res) => {
    res.json({ symptomLogs: await symptoms.listSymptoms(req.params.patientId) });
  });

  // ---------- Patient actions ----------
  router.patch('/doses/:adherenceId', patient, objectIdParam('adherenceId', 'Dose'), validate(schemas.markDoseSchema), async (req, res) => {
    res.json({ dose: await adherence.markDoseTaken(req.user, req.params.adherenceId, now()) });
  });
  router.post('/symptoms', patient, validate(schemas.symptomSchema), async (req, res) => {
    if (!req.user.patientId) throw forbidden('No patient profile for this account');
    res.status(201).json(await symptoms.reportSymptoms(req.user.patientId, req.valid.body, now()));
  });

  // ---------- Clinician: medicines, plans, follow-ups ----------
  router.get('/medications', clinician, validate(schemas.medicationQuery, 'query'), async (req, res) => {
    const q = req.valid.query.q;
    const filter = q ? { genericName: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } } : {};
    const medications = await Medication.find(filter).sort({ genericName: 1 }).limit(q ? 50 : 1000);
    res.json({ medications: medications.map((m) => m.toJSON()) });
  });
  router.post('/medications', clinician, validate(schemas.medicationSchema), async (req, res) => {
    res.status(201).json({ medication: (await Medication.create(req.valid.body)).toJSON() });
  });
  router.post('/plans', clinician, validate(schemas.planSchema), async (req, res) => {
    res.status(201).json(await plans.createPlan(req.user.userId, req.valid.body, now()));
  });
  router.patch('/plans/:planId', clinician, objectIdParam('planId', 'Plan'), validate(schemas.planStatusSchema), async (req, res) => {
    res.json({ plan: await plans.changePlanStatus(req.user.userId, req.params.planId, req.valid.body.status, now()) });
  });
  router.patch('/followups/:followUpId', clinician, objectIdParam('followUpId', 'Follow-up'), validate(schemas.followUpUpdateSchema), async (req, res) => {
    res.json({ followUp: await plans.completeFollowUp(req.user, req.params.followUpId, now()) });
  });

  // ---------- Clinician: escalations + dashboard ----------
  router.get('/escalations', clinician, validate(schemas.escalationListQuery, 'query'), async (req, res) => {
    res.json({ escalations: await escalations.listEscalations(req.user.userId, req.valid.query) });
  });
  router.get('/escalations/:escalationId', clinician, objectIdParam('escalationId', 'Escalation'), async (req, res) => {
    res.json({ escalation: await escalations.getEscalation(req.user.userId, req.params.escalationId, now()) });
  });
  router.patch('/escalations/:escalationId/acknowledge', clinician, objectIdParam('escalationId', 'Escalation'), async (req, res) => {
    res.json({ escalation: await escalations.acknowledgeEscalation(req.user.userId, req.params.escalationId, now()) });
  });
  router.patch('/escalations/:escalationId/resolve', clinician, objectIdParam('escalationId', 'Escalation'), validate(schemas.resolveSchema), async (req, res) => {
    res.json({ escalation: await escalations.resolveEscalation(req.user.userId, req.params.escalationId, req.valid.body.notes, now()) });
  });
  router.get('/dashboard', clinician, async (req, res) => {
    res.json(await getDashboard(req.user.userId, now()));
  });

  // ---------- Demo tool: run the sweep now (Render's free tier sleeps, so cron may not fire) ----------
  if (env.enableDemoTools) {
    router.post('/dev/run-sweep', clinician, async (_req, res) => {
      res.json({ result: await sweepMissedDoses(now()) });
    });
  }

  router.use((_req, _res) => {
    throw notFound('Route');
  });
  return router;
}
