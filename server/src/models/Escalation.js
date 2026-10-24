import mongoose from 'mongoose';
import { ESCALATION_SOURCES, ESCALATION_STATUSES, ESCALATION_TIERS } from './enums.js';
import { toJSON } from './toJSON.js';

const { ObjectId } = mongoose.Schema.Types;

const escalationSchema = new mongoose.Schema(
  {
    // Copied from the source record on purpose, so the queue can group by patient.
    patientId: { type: ObjectId, ref: 'Patient', required: true },
    symptomLogId: { type: ObjectId, ref: 'SymptomLog', default: null },
    adherenceId: { type: ObjectId, ref: 'AdherenceRecord', default: null },
    assignedClinicianId: { type: ObjectId, ref: 'User', required: true },
    source: { type: String, required: true, enum: ESCALATION_SOURCES },
    tier: { type: String, required: true, enum: ESCALATION_TIERS },
    triggeredRules: {
      type: [String],
      validate: { validator: (list) => list.length >= 1, message: 'At least one rule is required' },
    },
    status: { type: String, required: true, enum: ESCALATION_STATUSES, default: 'open' },
    acknowledgedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    notes: { type: String, trim: true, maxlength: 1000, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

escalationSchema.pre('validate', function checkConsistency() {
  // Exactly one source record, and it must match `source`.
  if (this.source === 'symptom_log' && (!this.symptomLogId || this.adherenceId)) {
    this.invalidate('symptomLogId', 'A symptom escalation needs symptomLogId and no adherenceId');
  }
  if (this.source === 'missed_critical_dose' && (!this.adherenceId || this.symptomLogId)) {
    this.invalidate('adherenceId', 'A missed-dose escalation needs adherenceId and no symptomLogId');
  }
  const acknowledged = this.status === 'acknowledged' || this.status === 'resolved';
  if (acknowledged !== Boolean(this.acknowledgedAt)) {
    this.invalidate('acknowledgedAt', 'Set exactly when the escalation is acknowledged or resolved');
  }
  const resolved = this.status === 'resolved';
  if (resolved !== Boolean(this.resolvedAt)) {
    this.invalidate('resolvedAt', 'Set exactly when the escalation is resolved');
  }
  if (resolved && !this.notes) this.invalidate('notes', 'Notes are required to resolve');
});

// The clinician's queue: filter by clinician + status, then sort.
escalationSchema.index({ assignedClinicianId: 1, status: 1, createdAt: 1 });
escalationSchema.index({ patientId: 1, status: 1 });
// At most one escalation per source record, so sweep re-runs and retries can't create duplicates.
escalationSchema.index(
  { adherenceId: 1 },
  { unique: true, partialFilterExpression: { adherenceId: { $type: 'objectId' } } },
);
escalationSchema.index(
  { symptomLogId: 1 },
  { unique: true, partialFilterExpression: { symptomLogId: { $type: 'objectId' } } },
);
escalationSchema.plugin(toJSON('escalationId'));

export const Escalation = mongoose.model('Escalation', escalationSchema);
