import { Router } from 'express';
import * as paymentController from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Create payment intent
router.post('/create-intent', authenticate, paymentController.createPaymentIntent);

// Stripe webhook (no auth required)
router.post('/webhook', paymentController.handleWebhook);

// Get payment methods
router.get('/methods', authenticate, paymentController.getPaymentMethods);

export default router;

