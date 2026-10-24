import mongoose from 'mongoose';
import { FREQUENCIES, TIMING_SLOTS } from './enums.js';
import { toJSON } from './toJSON.js';

// Associative entity: resolves DischargePlan M:N Medication and holds the pair's own data.
const prescriptionSchema = new mongoose.Schema({
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'DischargePlan', required: true, index: true },
  medicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medication', required: true },
  dosage: { type: String, required: true, trim: true, maxlength: 40 },
  frequency: { type: String, required: true, enum: Object.keys(FREQUENCIES) },
  timingSlots: { type: [{ type: String, enum: TIMING_SLOTS }] },
  durationDays: { type: Number, required: true, min: 1, max: 365, validate: Number.isInteger },
  isCritical: { type: Boolean, required: true, default: false },
});

prescriptionSchema.pre('validate', function checkSlots() {
  const slots = this.timingSlots ?? [];
  if (new Set(slots).size !== slots.length) {
    this.invalidate('timingSlots', 'Each timing slot can be used once');
  } else if (this.frequency && slots.length !== FREQUENCIES[this.frequency]) {
    this.invalidate(
      'timingSlots',
      `${this.frequency} needs ${FREQUENCIES[this.frequency]} timing slot(s), got ${slots.length}`,
    );
  }
});

prescriptionSchema.plugin(toJSON('prescriptionId'));

export const Prescription = mongoose.model('Prescription', prescriptionSchema);
