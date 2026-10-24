import mongoose from 'mongoose';
import { DOSE_STATUSES } from './enums.js';
import { toJSON } from './toJSON.js';

// One row per scheduled dose.
const adherenceRecordSchema = new mongoose.Schema({
  prescriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription', required: true },
  scheduledAt: { type: Date, required: true },
  status: { type: String, required: true, enum: DOSE_STATUSES, default: 'pending' },
  recordedAt: { type: Date },
});

adherenceRecordSchema.pre('validate', function checkRecorded() {
  const taken = this.status === 'taken';
  if (taken && !this.recordedAt) this.invalidate('recordedAt', 'Required when the dose is taken');
  if (!taken && this.recordedAt) this.invalidate('recordedAt', 'Only allowed when the dose is taken');
});

// The same dose can never be generated twice.
adherenceRecordSchema.index({ prescriptionId: 1, scheduledAt: 1 }, { unique: true });
// The missed-dose sweep's query.
adherenceRecordSchema.index({ status: 1, scheduledAt: 1 });
adherenceRecordSchema.plugin(toJSON('adherenceId'));

export const AdherenceRecord = mongoose.model('AdherenceRecord', adherenceRecordSchema);
