import { Router } from 'express';
import { body } from 'express-validator';
import * as newsletterController from '../controllers/newsletter.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

// Subscribe (public)
router.post(
  '/subscribe',
  [body('email').isEmail().normalizeEmail()],
  validate,
  newsletterController.subscribe
);

// Unsubscribe (public)
router.post(
  '/unsubscribe',
  [body('email').isEmail().normalizeEmail()],
  validate,
  newsletterController.unsubscribe
);

// Get all subscribers (admin only)
router.get(
  '/subscribers',
  authenticate,
  authorize('ADMIN'),
  newsletterController.getSubscribers
);

export default router;

