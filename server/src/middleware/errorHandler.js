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
  // Other request-body problems from express.json(): too large (413), unknown charset or
  // encoding (415). They carry their own 4xx status and a message that is safe to show.
  if (err?.expose && err.status >= 400 && err.status < 500) {
    const code = err.status === 413 ? 'BODY_TOO_LARGE' : 'BAD_REQUEST_BODY';
    return res.status(err.status).json({ error: { code, message: err.message } });
  }
  // The database is down or restarting (the driver reconnects by itself): ask the client to retry.
  if (mongoose.connection.readyState !== 1 || err?.name === 'MongooseServerSelectionError') {
    return res.status(503).json({ error: { code: 'DB_UNAVAILABLE', message: 'The service is starting up. Please try again in a moment' } });
  }
  if (!env.isTest) console.error(err);
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
}
