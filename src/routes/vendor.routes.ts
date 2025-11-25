import { Router } from 'express';
import * as vendorController from '../controllers/vendor.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All routes require vendor authentication
router.use(authenticate);
router.use(authorize('VENDOR', 'ADMIN'));

// Dashboard stats
router.get('/dashboard/stats', vendorController.getDashboardStats);

// Get vendor's products
router.get('/products', vendorController.getVendorProducts);

// Sales & Revenue
router.get('/sales', vendorController.getSales);
router.get('/revenue', vendorController.getRevenue);

// Payouts
router.get('/payouts', vendorController.getPayouts);
router.post('/payouts/request', vendorController.requestPayout);

// Profile
router.get('/profile', vendorController.getProfile);
router.put('/profile', vendorController.updateProfile);

export default router;

