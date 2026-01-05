import { Router } from 'express';
import * as giftCardController from '../controllers/giftcard.controller';
import { authenticate, optionalAuth } from '../middleware/auth';

const router = Router();

// Public routes
router.post('/validate', giftCardController.validateGiftCard);
router.get('/balance/:code', giftCardController.checkBalance);

// Purchase routes (optional auth - can be guest)
router.post('/create-order', optionalAuth, giftCardController.createGiftCardOrder);
router.post('/capture-payment', optionalAuth, giftCardController.captureGiftCardPayment);

// Authenticated routes
router.post('/apply', optionalAuth, giftCardController.applyGiftCard);
router.get('/my-gift-cards', authenticate, giftCardController.getMyGiftCards);
router.post('/:giftCardId/resend', authenticate, giftCardController.resendGiftCardEmail);

export default router;

