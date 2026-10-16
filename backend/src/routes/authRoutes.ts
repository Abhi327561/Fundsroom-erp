import { Router } from 'express';
import { body, param } from 'express-validator';
import { login, register, signup, me, listUsers, changePassword, updateUserRole } from '../controllers/authController';
import { authenticate, authorize } from '../middleware/auth';
import { handleValidation } from '../middleware/validate';
import { loginLimiter, signupLimiter } from '../middleware/rateLimit';

const router = Router();

const ROLES = ['admin', 'sales', 'warehouse', 'accounts'];
// Public self-signup choices — admin deliberately excluded.
const SELF_SIGNUP_ROLES = ['sales', 'warehouse', 'accounts'];

// POST /auth/login — rate-limited + validated
router.post(
  '/login',
  loginLimiter,
  [body('email').isEmail().withMessage('Enter a valid email'), body('password').notEmpty().withMessage('Password is required')],
  handleValidation,
  login
);

// POST /auth/signup — public. Role picker excludes admin (enforced again in controller).
router.post(
  '/signup',
  signupLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Enter a valid email'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('role').isIn(SELF_SIGNUP_ROLES).withMessage('Role must be sales, warehouse or accounts'),
  ],
  handleValidation,
  signup
);

// Admin creates users directly (any role, including admin for succession)
router.post(
  '/register',
  authenticate,
  authorize('admin'),
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Enter a valid email'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('role').isIn(ROLES).withMessage('Role must be admin, sales, warehouse or accounts'),
  ],
  handleValidation,
  register
);

router.get('/me', authenticate, me);
router.get('/users', authenticate, authorize('admin'), listUsers);

// Only admins promote/demote — including granting admin.
router.patch(
  '/users/:id/role',
  authenticate,
  authorize('admin'),
  [param('id').isMongoId().withMessage('Invalid user id'), body('role').isIn(ROLES).withMessage('Invalid role')],
  handleValidation,
  updateUserRole
);

router.post(
  '/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  ],
  handleValidation,
  changePassword
);

export default router;
