import bcrypt from 'bcrypt';
import { signToken } from '../middleware/auth.js';
import { Patient, User } from '../models/index.js';
import { conflict, unauthorized } from '../utils/httpError.js';

const BCRYPT_ROUNDS = 10;

function session(user, patientId = null) {
  return { token: signToken(user), user: { ...user.toJSON(), patientId } };
}

/** Patient self-registration: one User (role = patient) + one Patient (FR-1.1). */
export async function register(input) {
  if (await User.exists({ phone: input.phone })) {
    throw conflict('PHONE_TAKEN', 'This mobile number is already registered');
  }
  if (input.abhaId && (await Patient.exists({ abhaId: input.abhaId }))) {
    throw conflict('ABHA_TAKEN', 'This ABHA ID is already registered');
  }

  const user = await User.create({
    fullName: input.fullName,
    phone: input.phone,
    passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
    role: 'patient',
    preferredLanguage: input.preferredLanguage,
  });
  try {
    const patient = await Patient.create({
      userId: user._id,
      abhaId: input.abhaId,
      dateOfBirth: input.dateOfBirth,
      gender: input.gender,
      district: input.district,
    });
    return session(user, patient._id);
  } catch (err) {
    await User.deleteOne({ _id: user._id }); // no half-registered accounts
    throw err;
  }
}

export async function login({ phone, password }) {
  const user = await User.findOne({ phone });
  // Same message whether the phone or the password is wrong, so phone numbers can't be probed.
  const ok = user && user.isActive && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw unauthorized('Phone number or password is wrong');
  const patient = user.role === 'patient' ? await Patient.findOne({ userId: user._id }, { _id: 1 }) : null;
  return session(user, patient?._id ?? null);
}

export function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}
