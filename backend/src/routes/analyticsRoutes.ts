import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getDashboardAnalytics } from '../controllers/analyticsController';

const router = Router();

router.use(authenticate);

// All roles can view analytics (dashboard is shared)
router.get('/dashboard', getDashboardAnalytics);

export default router;
