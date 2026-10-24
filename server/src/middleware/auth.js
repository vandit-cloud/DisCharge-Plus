import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { DischargePlan, Patient, User } from '../models/index.js';
import { forbidden, notFound, unauthorized } from '../utils/httpError.js';

export function signToken(user) {
  return jwt.sign({ role: user.role }, env.jwtSecret, {
    subject: String(user._id),
    expiresIn: env.jwtExpiresIn,
  });
}

/** 401 unless the request carries a valid token for an active user. Sets req.user. */
export async function requireAuth(req, _res, next) {
  const [scheme, token] = (req.get('authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) throw unauthorized();

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw unauthorized('Your session has expired. Please log in again');
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw unauthorized();

  req.user = { userId: user._id, role: user.role, doc: user };
  if (user.role === 'patient') {
    const patient = await Patient.findOne({ userId: user._id }, { _id: 1 });
    req.user.patientId = patient?._id ?? null;
  }
  next();
}

/** 403 unless the user has one of the given roles. */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!roles.includes(req.user.role)) throw forbidden('This page is not available for your role');
    next();
  };
}

/**
 * Can this user see this patient's records? (FR-1.9, decision D1)
 * - A patient: only their own patientId.
 * - A clinician: only patients they have written a discharge plan for.
 * A valid token proves who you are, not which records are yours.
 */
async function canAccessPatient(user, patientId) {
  if (!mongoose.isValidObjectId(patientId)) return false;
  if (user.role === 'patient') return String(user.patientId) === String(patientId);
  if (user.role === 'clinician') {
    return Boolean(await DischargePlan.exists({ patientId, clinicianId: user.userId }));
  }
  return false;
}

/** Route guard for /patients/:patientId/... */
export async function requirePatientAccess(req, _res, next) {
  if (!mongoose.isValidObjectId(req.params.patientId)) throw notFound('Patient');
  if (!(await canAccessPatient(req.user, req.params.patientId))) throw forbidden();
  next();
}
