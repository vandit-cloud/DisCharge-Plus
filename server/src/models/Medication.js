import mongoose from 'mongoose';
import { MEDICATION_FORMS } from './enums.js';
import { toJSON } from './toJSON.js';

const medicationSchema = new mongoose.Schema({
  genericName: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 120 },
  form: { type: String, required: true, enum: MEDICATION_FORMS },
  strength: { type: String, required: true, trim: true, maxlength: 30 },
});

medicationSchema.plugin(toJSON('medicationId'));

export const Medication = mongoose.model('Medication', medicationSchema);
