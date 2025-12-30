import { Router } from 'express';
import * as paymentController from '../controllers/payment.controller';
import { authenticate, optionalAuth } from '../middleware/auth';

const router = Router();

// PayPal routes
router.post('/paypal/create-order', optionalAuth, paymentController.createPayPalOrderHandler);
router.post('/paypal/capture-order', optionalAuth, paymentController.capturePayPalOrderHandler);
router.post('/paypal/webhook', paymentController.handlePayPalWebhook);

// Free order (for $0 products)
router.post('/free-order', optionalAuth, paymentController.createFreeOrder);

// First purchase discount check
router.get('/first-purchase-discount', optionalAuth, paymentController.checkFirstPurchaseDiscount);

// Legacy Stripe routes (for future)
router.post('/create-intent', authenticate, paymentController.createPaymentIntent);
router.post('/webhook', paymentController.handleWebhook);

// Get payment methods
router.get('/methods', paymentController.getPaymentMethods);

export default router;

