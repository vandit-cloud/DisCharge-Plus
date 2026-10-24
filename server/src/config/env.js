// Reads configuration once at startup. Node 24 loads .env itself, so no dotenv package.
import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing. Copy .env.example to .env and fill it in.`);
  return value;
}

function integer(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value)) throw new Error(`${name} must be a whole number, got "${raw}"`);
  return value;
}

const nodeEnv = process.env.NODE_ENV || 'development';

export const env = {
  isTest: nodeEnv === 'test',
  port: integer('PORT', 3000),
  // Tests start their own in-memory database, so the URI is only required outside tests.
  mongodbUri: nodeEnv === 'test' ? process.env.MONGODB_URI : required('MONGODB_URI'),
  jwtSecret: nodeEnv === 'test' ? 'test-secret' : required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()),
  cronSchedule: process.env.CRON_SCHEDULE || '*/15 * * * *',
  doseGraceMinutes: integer('DOSE_GRACE_MINUTES', 120),
  enableDemoTools: process.env.ENABLE_DEMO_TOOLS === 'true',
};
