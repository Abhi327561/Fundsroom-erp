import mongoose from 'mongoose';
import { env } from './env';

// Single shared connection. Models in src/models/store.ts use it implicitly.
export const connectDb = async () => {
  if (mongoose.connection.readyState === 1) return;
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri);
};

export const testConnection = async () => {
  try {
    await connectDb();
    const admin = mongoose.connection.db?.admin();
    await admin?.ping();
    console.log('MongoDB connected successfully to', mongoose.connection.name);
  } catch (err) {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
  }
};
