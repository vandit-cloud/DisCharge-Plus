import mongoose from 'mongoose';
import { LANGUAGES, ROLES } from './enums.js';
import { toJSON } from './toJSON.js';

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  // Login ID: +91 followed by a 10-digit Indian mobile number.
  phone: { type: String, required: true, unique: true, match: /^\+91[6-9]\d{9}$/ },
  passwordHash: { type: String, required: true, maxlength: 60 },
  role: { type: String, required: true, enum: ROLES },
  preferredLanguage: { type: String, required: true, enum: LANGUAGES, default: 'en' },
  isActive: { type: Boolean, required: true, default: true },
});

userSchema.plugin(toJSON('userId', ['passwordHash']));

export const User = mongoose.model('User', userSchema);
