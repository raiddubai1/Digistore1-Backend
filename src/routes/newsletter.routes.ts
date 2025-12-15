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

// Send promotional email to all subscribers (admin only)
router.post(
  '/send-promotion',
  authenticate,
  authorize('ADMIN'),
  [
    body('subject').notEmpty().withMessage('Subject is required'),
    body('title').notEmpty().withMessage('Title is required'),
    body('body').notEmpty().withMessage('Body is required'),
  ],
  validate,
  newsletterController.sendPromotion
);

export default router;

