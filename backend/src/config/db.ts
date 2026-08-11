import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// A "pool" keeps a set of reusable DB connections open,
// instead of opening/closing a new connection on every request.
// This is much faster and is the standard pattern for Node + Postgres.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false }, // needed for hosted DBs like Supabase/Neon/Render
});

// Quick helper to test the connection on server startup
export const testConnection = async () => {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('Database connected successfully at', result.rows[0].now);
  } catch (err) {
    console.error('Database connection failed:', err);
    process.exit(1);
  }
};
