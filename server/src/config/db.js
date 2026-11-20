import mongoose from 'mongoose';

const RETRY_DELAY_MS = 3000;

/**
 * Connects, retrying while the database is not up yet. After a PC reboot the API can start
 * before the MongoDB service has finished starting; without retries it would exit for good.
 * (Once connected, the driver reconnects by itself if the database restarts later.)
 */
export async function connectDB(uri, { attempts = 20, log = console.log } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      break;
    } catch (err) {
      if (attempt >= attempts) throw err;
      log(`Database not reachable (attempt ${attempt}/${attempts}): ${err.message}. Retrying in ${RETRY_DELAY_MS / 1000} s`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
  // Build the unique indexes before accepting requests, so duplicates are rejected from the start.
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
  return mongoose.connection;
}

export function disconnectDB() {
  return mongoose.disconnect();
}
