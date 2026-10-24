import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

// Every error leaves the API in one shape: { error: { code, message, fields? } } (NFR-18).
// Express recognises an error handler by its four parameters, so _next must stay.
export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, fields: err.fields } });
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const fields = Object.fromEntries(Object.entries(err.errors).map(([key, e]) => [key, e.message]));
    return res.status(400).json({ error: { code: 'VALIDATION_FAILED', message: 'Some fields need fixing', fields } });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: { code: 'VALIDATION_FAILED', message: `Invalid ${err.path}` } });
  }
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern ?? {})[0] ?? 'value';
    return res.status(409).json({ error: { code: 'DUPLICATE', message: `This ${field} is already in use`, fields: { [field]: 'Already in use' } } });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'BAD_JSON', message: 'The request body is not valid JSON' } });
  }
  if (!env.isTest) console.error(err);
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
}
