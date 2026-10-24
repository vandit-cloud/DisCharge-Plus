import mongoose from 'mongoose';
import { FOLLOW_UP_STATUSES, FOLLOW_UP_TYPES } from './enums.js';
import { toJSON } from './toJSON.js';

const followUpSchema = new mongoose.Schema({
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'DischargePlan', required: true },
  scheduledDate: { type: Date, required: true },
  type: { type: String, required: true, enum: FOLLOW_UP_TYPES },
  description: { type: String, required: true, trim: true, maxlength: 300 },
  status: { type: String, required: true, enum: FOLLOW_UP_STATUSES, default: 'scheduled' },
  completedDate: { type: Date },
});

// A custom field validator is skipped when the value is missing, so this rule lives here.
followUpSchema.pre('validate', function checkCompletion() {
  const completed = this.status === 'completed';
  if (completed && !this.completedDate) this.invalidate('completedDate', 'Required when completed');
  if (!completed && this.completedDate) this.invalidate('completedDate', 'Only allowed when completed');
});

followUpSchema.index({ planId: 1, scheduledDate: 1 });
followUpSchema.plugin(toJSON('followUpId'));

export const FollowUp = mongoose.model('FollowUp', followUpSchema);
