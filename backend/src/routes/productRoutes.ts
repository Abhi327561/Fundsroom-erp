import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getProducts, getProductById, createProduct, updateProduct,
  addStockMovement, getStockMovements, getAllStockMovements, deleteProduct,
} from '../controllers/productController';

const router = Router();

router.use(authenticate);

router.get('/', getProducts);
router.get('/movements/all', getAllStockMovements);
router.get('/:id', getProductById);
router.get('/:id/stock-movements', getStockMovements);

// Only admin and warehouse manage products/stock
router.post('/', authorize('admin', 'warehouse'), createProduct);
router.put('/:id', authorize('admin', 'warehouse'), updateProduct);
router.post('/:id/stock-movements', authorize('admin', 'warehouse'), addStockMovement);
router.delete('/:id', authorize('admin'), deleteProduct);

export default router;
