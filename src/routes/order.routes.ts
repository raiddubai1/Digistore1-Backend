import { Router } from 'express';
import { body } from 'express-validator';
import * as orderController from '../controllers/order.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get user's orders
router.get('/my-orders', orderController.getMyOrders);

// Get order by ID
router.get('/:id', orderController.getOrderById);

// Create order
router.post(
  '/',
  [
    body('items').isArray({ min: 1 }),
    body('items.*.productId').notEmpty(),
    body('items.*.license').isIn(['PERSONAL', 'COMMERCIAL', 'EXTENDED']),
  ],
  validate,
  orderController.createOrder
);

// Update order status (Admin only)
router.patch(
  '/:id/status',
  [
    body('status').isIn(['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'FAILED']),
    body('sendEmail').optional().isBoolean(),
  ],
  validate,
  orderController.updateOrderStatus
);

export default router;

