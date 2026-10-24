// Request body / query schemas (zod). The client checks too, but only this check counts (NFR-3).
import { z } from 'zod';
import {
  ESCALATION_STATUSES, ESCALATION_TIERS, FREQUENCIES, GENDERS, LANGUAGES, MEDICATION_FORMS,
  PLAN_STATUSES, PROTOCOLS, TIMING_SLOTS,
} from './models/enums.js';
import { SYMPTOM_CODES } from './rules/symptomCodes.js';
import { parseDateOnly } from './utils/time.js';

// A missing field says "Required" instead of zod's technical default message.
z.config({
  customError: (issue) => (issue.code === 'invalid_type' && issue.input === undefined ? 'Required' : undefined),
});

const dateOnly = z
  .string()
  .refine((value) => parseDateOnly(value) !== null, 'Use a real date in YYYY-MM-DD format')
  .transform(parseDateOnly);

/** "+91 98765 43210", "098765-43210", "9876543210" -> "9876543210" (the 10 digits). */
export const phoneDigits = (value) => String(value ?? '').replace(/[\s-]/g, '').replace(/^(\+91|0)/, '');

// Accepts any of those spellings and stores "+919876543210".
const phone = z
  .string()
  .transform(phoneDigits)
  .refine((digits) => /^[6-9]\d{9}$/.test(digits), 'Enter a 10-digit Indian mobile number')
  .transform((digits) => `+91${digits}`);

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID');

const commaList = (values) =>
  z
    .string()
    .transform((value) => value.split(',').filter(Boolean))
    .pipe(z.array(z.enum(values)));

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name').max(100),
  phone,
  password: z.string().min(8, 'Use at least 8 characters').max(72),
  preferredLanguage: z.enum(LANGUAGES),
  dateOfBirth: dateOnly,
  gender: z.enum(GENDERS),
  district: z.string().trim().min(2, 'Enter your district').max(60),
  abhaId: z
    .string()
    .transform((value) => value.replace(/[\s-]/g, ''))
    .refine((digits) => digits === '' || /^\d{14}$/.test(digits), 'ABHA ID has 14 digits')
    .transform((digits) => digits || undefined)
    .optional(),
});

export const loginSchema = z.object({
  phone,
  password: z.string().min(1, 'Enter your password'),
});

export const languageSchema = z.object({ preferredLanguage: z.enum(LANGUAGES) });

export const patientListQuery = z.object({
  search: z.string().trim().max(60).optional(),
  risk: z.enum(['low', 'moderate', 'high']).optional(),
});

export const patientLookupQuery = z.object({ q: z.string().trim().min(3).max(20) });

export const doseRangeQuery = z
  .object({ from: dateOnly.optional(), to: dateOnly.optional() })
  .refine(({ from, to }) => !from || !to || from <= to, { message: '"from" must be before "to"', path: ['to'] });

export const medicationQuery = z.object({ q: z.string().trim().max(60).optional() });

export const medicationSchema = z.object({
  genericName: z.string().trim().min(2).max(120),
  form: z.enum(MEDICATION_FORMS),
  strength: z.string().trim().min(1).max(30),
});

const prescriptionSchema = z
  .object({
    medicationId: objectId,
    dosage: z.string().trim().min(1, 'Enter the dosage').max(40),
    frequency: z.enum(Object.keys(FREQUENCIES)),
    timingSlots: z.array(z.enum(TIMING_SLOTS)).min(1).max(4),
    durationDays: z.number().int().min(1).max(365),
    isCritical: z.boolean(),
  })
  .refine((p) => new Set(p.timingSlots).size === p.timingSlots.length, {
    message: 'Each timing slot can be used once',
    path: ['timingSlots'],
  })
  .refine((p) => p.timingSlots.length === FREQUENCIES[p.frequency], {
    message: 'The number of timing slots must match the frequency',
    path: ['timingSlots'],
  });

export const planSchema = z
  .object({
    patientId: objectId,
    admissionDate: dateOnly,
    dischargeDate: dateOnly,
    primaryDiagnosis: z.string().trim().min(3, 'Enter the diagnosis').max(200),
    redFlags: z.array(z.enum(SYMPTOM_CODES)).min(1, 'Choose at least one red flag').max(20),
    followUpProtocol: z.enum(PROTOCOLS),
    prescriptions: z.array(prescriptionSchema).min(1, 'Add at least one medicine').max(20),
  })
  .refine((p) => p.dischargeDate >= p.admissionDate, {
    message: 'Discharge date must be on or after the admission date',
    path: ['dischargeDate'],
  });

export const planStatusSchema = z.object({
  status: z.enum(PLAN_STATUSES.filter((status) => status !== 'active')),
});

export const markDoseSchema = z.object({ status: z.literal('taken') });

export const symptomSchema = z.object({
  symptoms: z
    .array(z.enum(SYMPTOM_CODES))
    .min(1, 'Choose at least one symptom')
    .max(10)
    .refine((list) => new Set(list).size === list.length, 'Each symptom can be chosen once'),
  severity: z.number().int().min(1).max(5),
});

export const followUpUpdateSchema = z.object({ status: z.literal('completed') });

export const escalationListQuery = z.object({
  status: commaList(ESCALATION_STATUSES).optional(),
  tier: commaList(ESCALATION_TIERS).optional(),
  patientId: objectId.optional(),
});

export const resolveSchema = z.object({
  notes: z.string().trim().min(1, 'Write what was done').max(1000),
});
