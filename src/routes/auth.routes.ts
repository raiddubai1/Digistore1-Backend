import { Router } from 'express';
import { body } from 'express-validator';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

// Register
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('name').trim().notEmpty(),
    body('role').optional().isIn(['CUSTOMER', 'VENDOR']),
  ],
  validate,
  authController.register
);

// Login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  validate,
  authController.login
);

// Refresh token
router.post('/refresh', authController.refreshToken);

// Logout
router.post('/logout', authenticate, authController.logout);

// Get current user
router.get('/me', authenticate, authController.getCurrentUser);

// Verify email
router.post('/verify-email', authController.verifyEmail);

// Request password reset
router.post(
  '/forgot-password',
  [body('email').isEmail().normalizeEmail()],
  validate,
  authController.forgotPassword
);

// Reset password
router.post(
  '/reset-password',
  [
    body('token').notEmpty(),
    body('password').isLength({ min: 8 }),
  ],
  validate,
  authController.resetPassword
);

// Change password (authenticated)
router.post(
  '/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }),
  ],
  validate,
  authController.changePassword
);

// Social login - Google
router.post(
  '/google',
  [body('token').notEmpty()],
  validate,
  authController.googleLogin
);

// Social login - GitHub
router.post(
  '/github',
  [body('code').notEmpty()],
  validate,
  authController.githubLogin
);

export default router;

