import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { generalLimiter } from './middleware/rateLimit';
import { testConnection } from './config/db';
import authRoutes from './routes/authRoutes';
import customerRoutes from './routes/customerRoutes';
import productRoutes from './routes/productRoutes';
import challanRoutes from './routes/challanRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import { notFound, errorHandler } from './middleware/errorHandler';

const app = express();

// Behind Render/Vercel/NGINX — needed for correct client IPs in rate limiting.
app.set('trust proxy', 1);

// ---- Security headers ----
app.use(helmet());

// ---- Locked-down CORS: only configured frontend origins ----
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow same-origin / curl / health checks with no Origin header.
      if (!origin) return cb(null, true);
      if (env.frontendUrls.includes(origin)) return cb(null, true);
      return cb(new Error('CORS blocked for this origin'));
    },
  })
);

app.use(express.json({ limit: '100kb' }));
app.use(morgan(env.isProd ? 'combined' : 'dev'));

// ---- Rate limits ----
app.use(generalLimiter);

// ---- Health check ----
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', message: 'FundsRoom ERP API is running', env: env.nodeEnv });
});

// ---- Feature Routes ----
app.use('/auth', authRoutes);
app.use('/customers', customerRoutes);
app.use('/products', productRoutes);
app.use('/challans', challanRoutes);
app.use('/analytics', analyticsRoutes);

app.use(notFound);
app.use(errorHandler);

// ---- Start server ----
app.listen(env.port, async () => {
  await testConnection();
  console.log(`Server running on http://localhost:${env.port} (${env.nodeEnv})`);
});

