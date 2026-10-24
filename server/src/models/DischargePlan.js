import mongoose from 'mongoose';
import { PLAN_STATUSES, PROTOCOLS } from './enums.js';
import { SYMPTOM_CODES } from '../rules/symptomCodes.js';
import { toJSON } from './toJSON.js';

const dischargePlanSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  clinicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  admissionDate: { type: Date, required: true },
  dischargeDate: { type: Date, required: true },
  primaryDiagnosis: { type: String, required: true, trim: true, maxlength: 200 },
  redFlags: {
    type: [{ type: String, enum: SYMPTOM_CODES }],
    validate: {
      validator: (list) => list.length >= 1 && list.length <= 20 && new Set(list).size === list.length,
      message: 'Choose 1 to 20 different red flags',
    },
  },
  followUpProtocol: { type: String, required: true, enum: PROTOCOLS },
  status: { type: String, required: true, enum: PLAN_STATUSES, default: 'active' },
});

dischargePlanSchema.pre('validate', function checkDates() {
  if (this.admissionDate && this.dischargeDate && this.dischargeDate < this.admissionDate) {
    this.invalidate('dischargeDate', 'Discharge date must be on or after the admission date');
  }
});

dischargePlanSchema.index({ patientId: 1, status: 1 });
dischargePlanSchema.index({ clinicianId: 1 });
// At most one active plan per patient, enforced by the database (no race between two saves).
dischargePlanSchema.index({ patientId: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });
dischargePlanSchema.plugin(toJSON('planId'));

export const DischargePlan = mongoose.model('DischargePlan', dischargePlanSchema);
