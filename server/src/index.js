import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { createApp } from './app.js';
import { startMissedDoseJob, sweepMissedDoses } from './jobs/missedDoseSweep.js';

await connectDB(env.mongodbUri);
const server = createApp().listen(env.port, () => {
  console.log(`DisCharge+ API on http://localhost:${env.port}/api (allowing ${env.clientOrigins.join(', ')})`);
});
const job = startMissedDoseJob();

// Catch up at once on doses whose window closed while the server was off (e.g. a reboot),
// instead of waiting up to 15 minutes for the first scheduled run. The sweep is idempotent.
sweepMissedDoses(new Date())
  .then((result) => console.log(`[missed-dose sweep] startup catch-up: ${JSON.stringify(result)}`))
  .catch((err) => console.error('[missed-dose sweep] startup catch-up failed:', err));

async function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  job.stop();
  server.close();
  await disconnectDB();
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
