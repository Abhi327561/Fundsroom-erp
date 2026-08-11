import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { getChallans, getChallanById, createChallan, confirmChallan, cancelChallan } from '../controllers/challanController';

const router = Router();

router.use(authenticate);

router.get('/', getChallans);
router.get('/:id', getChallanById);
// Only sales and admin create/confirm/cancel challans
router.post('/', authorize('admin', 'sales'), createChallan);
router.patch('/:id/confirm', authorize('admin', 'sales'), confirmChallan);
router.patch('/:id/cancel', authorize('admin', 'sales'), cancelChallan);

export default router;
