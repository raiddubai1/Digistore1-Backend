import { Router } from 'express';
import * as adminController from '../controllers/admin.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize('ADMIN'));

// Dashboard stats
router.get('/dashboard/stats', adminController.getDashboardStats);

// Orders management
router.get('/orders', adminController.getAllOrders);

// Customers management
router.get('/customers', adminController.getAllCustomers);

export default router;

