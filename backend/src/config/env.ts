import dotenv from 'dotenv';

dotenv.config();

// Fail fast on missing/weak config so prod never boots with demo secrets.
const required = (key: string): string => {
  const v = process.env[key];
  if (!v || v.trim() === '') {
    throw new Error(`Missing required env var: ${key}`);
  }
  return v;
};

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET || '';

if (!process.env.MONGODB_URI) {
  throw new Error('Missing required env var: MONGODB_URI (e.g. mongodb+srv://user:pass@cluster/dbname)');
}
if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters. Generate with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
}

export const env = {
  nodeEnv,
  isProd: nodeEnv === 'production',
  port: parseInt(process.env.PORT || '5000', 10),
  mongoUri: required('MONGODB_URI'),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  // Comma-separated allowed origins, e.g. https://app.example.com,https://admin.example.com
  frontendUrls: (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};
