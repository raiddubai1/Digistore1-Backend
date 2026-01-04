import { Router } from 'express';
import * as couponController from '../controllers/coupon.controller';
import { authenticate, authorize, optionalAuth } from '../middleware/auth';

const router = Router();

// Public routes (with optional auth for user context)
router.post('/validate', optionalAuth, couponController.validateCoupon);
router.get('/first-time-buyer', optionalAuth, couponController.checkFirstTimeBuyer);

// Admin routes
router.get('/', authenticate, authorize('ADMIN'), couponController.getAllCoupons);
router.post('/', authenticate, authorize('ADMIN'), couponController.createCoupon);
router.put('/:id', authenticate, authorize('ADMIN'), couponController.updateCoupon);
router.delete('/:id', authenticate, authorize('ADMIN'), couponController.deleteCoupon);

export default router;

