import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createRouter } from './routes.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // Render and Vercel sit behind one proxy; needed for rate limiting by IP
  app.use(cors({ origin: env.clientOrigins }));
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', createRouter());
  app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }));
  app.use(errorHandler);
  return app;
}
