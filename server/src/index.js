import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { createApp } from './app.js';
import { startMissedDoseJob } from './jobs/missedDoseSweep.js';

await connectDB(env.mongodbUri);
const server = createApp().listen(env.port, () => {
  console.log(`DisCharge+ API on http://localhost:${env.port}/api (allowing ${env.clientOrigins.join(', ')})`);
});
const job = startMissedDoseJob();

async function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  job.stop();
  server.close();
  await disconnectDB();
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
