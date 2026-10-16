import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getCustomers, getCustomerById, createCustomer, updateCustomer, addFollowUpNote, deleteCustomer,
} from '../controllers/customerController';

const router = Router();

// All customer routes require login
router.use(authenticate);

router.get('/', getCustomers);
router.get('/:id', getCustomerById);
// Only admin and sales can create/edit customers
router.post('/', authorize('admin', 'sales'), createCustomer);
router.put('/:id', authorize('admin', 'sales'), updateCustomer);
router.post('/:id/notes', authorize('admin', 'sales'), addFollowUpNote);
router.delete('/:id', authorize('admin'), deleteCustomer);

export default router;
