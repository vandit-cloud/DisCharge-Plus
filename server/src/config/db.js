import mongoose from 'mongoose';

export async function connectDB(uri) {
  await mongoose.connect(uri);
  // Build the unique indexes before accepting requests, so duplicates are rejected from the start.
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
  return mongoose.connection;
}

export function disconnectDB() {
  return mongoose.disconnect();
}
