import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection } from './config/db';
import authRoutes from './routes/authRoutes';
import customerRoutes from './routes/customerRoutes';
import productRoutes from './routes/productRoutes';
import challanRoutes from './routes/challanRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ---- Global Middleware ----
app.use(cors());            // allow frontend (different origin) to call this API
app.use(express.json());    // parse incoming JSON request bodies into req.body

// ---- Health check route ----
// Useful to confirm the server is alive, and to test after deployment
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'FundsRoom ERP API is running' });
});

// ---- Feature Routes ----
app.use('/auth', authRoutes);
app.use('/customers', customerRoutes);
app.use('/products', productRoutes);
app.use('/challans', challanRoutes);

// ---- Start server ----
app.listen(PORT, async () => {
  await testConnection();
  console.log(`Server running on http://localhost:${PORT}`);
});
