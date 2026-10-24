import mongoose from 'mongoose';
import { TIERS } from './enums.js';
import { SYMPTOM_CODES } from '../rules/symptomCodes.js';
import { toJSON } from './toJSON.js';

const symptomLogSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  reportedAt: { type: Date, required: true, default: Date.now },
  symptoms: {
    type: [{ type: String, enum: SYMPTOM_CODES }],
    validate: {
      validator: (list) => list.length >= 1 && list.length <= 10 && new Set(list).size === list.length,
      message: 'Choose 1 to 10 different symptoms',
    },
  },
  severity: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
  // Stored for every report, escalated or not, so missed red flags can be audited later.
  triageTier: { type: String, required: true, enum: TIERS, default: 'self_care' },
  triggeredRules: { type: [String], default: [] },
});

symptomLogSchema.index({ patientId: 1, reportedAt: -1 });
symptomLogSchema.plugin(toJSON('symptomLogId'));

export const SymptomLog = mongoose.model('SymptomLog', symptomLogSchema);
