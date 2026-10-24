import mongoose from 'mongoose';
import { GENDERS } from './enums.js';
import { toJSON } from './toJSON.js';

const patientSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  // Optional 14-digit ABHA number: unique only when present, so the index is sparse.
  abhaId: { type: String, match: /^\d{14}$/, index: { unique: true, sparse: true } },
  dateOfBirth: {
    type: Date,
    required: true,
    validate: {
      validator: (value) => value < new Date() && value > new Date('1900-01-01'),
      message: 'Date of birth must be in the past',
    },
  },
  gender: { type: String, required: true, enum: GENDERS },
  district: { type: String, required: true, trim: true, maxlength: 60 },
});

patientSchema.plugin(toJSON('patientId'));

export const Patient = mongoose.model('Patient', patientSchema);
